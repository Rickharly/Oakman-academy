/**
 * POST /api/teacher/chat — CONTRACTS.md HTTP section. Streams the AI teacher's reply
 * as `text/plain` text deltas, with the conversation id in `X-Conversation-Id`.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireStudentApi } from "@/lib/auth/api";
import { teacherAgent } from "@/lib/ai/teacher-agent";

/**
 * What the player says is on screen. Every field is capped and optional: this is a hint about
 * what the child can see, and a hostile value should make the answer vaguer, never leak
 * anything. The server decides the teacher's mode; this can only tighten it.
 */
const viewSchema = z.object({
  stage: z.enum(["STARTER", "LEARN", "PRACTICE", "CHECK", "FEEDBACK", "COMPLETE"]).optional(),
  section: z.string().max(120).optional(),
  questionPrompt: z.string().max(600).optional(),
  options: z.array(z.string().max(200)).max(8).optional(),
  unanswered: z.boolean().optional(),
  draft: z.string().max(600).optional(),
});

const chatBodySchema = z.object({
  message: z.string().min(1, "message is required"),
  conversationId: z.string().optional(),
  lessonAttemptId: z.string().optional(),
  questionId: z.string().optional(),
  view: viewSchema.optional(),
});

function toReadableStream(iterable: AsyncIterable<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = iterable[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(value));
    },
    async cancel(reason) {
      await iterator.return?.(reason);
    },
  });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const student = await requireStudentApi(req);

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ApiError(400, "Invalid JSON body");
    }
    const parsed = chatBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues.map((i) => i.message).join("; "));
    }
    const body = parsed.data;

    if (body.lessonAttemptId) {
      const attempt = await prisma.lessonAttempt.findFirst({
        where: { id: body.lessonAttemptId, studentId: student.studentProfile.id },
        select: { id: true },
      });
      if (!attempt) throw new ApiError(404, "Lesson attempt not found");
    }

    const result = await teacherAgent.chat({
      studentId: student.studentProfile.id,
      message: body.message,
      conversationId: body.conversationId,
      lessonAttemptId: body.lessonAttemptId,
      questionId: body.questionId,
      view: body.view,
    });

    return new Response(toReadableStream(result.stream), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Conversation-Id": result.conversationId,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
