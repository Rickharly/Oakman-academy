/**
 * POST /api/teacher/chat — CONTRACTS.md HTTP section. Streams the AI teacher's reply
 * as `text/plain` text deltas, with the conversation id in `X-Conversation-Id`.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireStudentApi } from "@/lib/auth/api";
import { teacherAgent } from "@/lib/ai/teacher-agent";

/** Cuts a string down to a limit rather than rejecting it — this is display context, not
 * something a child typed, and a picture question's prompt or a longer worked answer should
 * still get through, just trimmed. */
function capped(max: number) {
  return z
    .string()
    .transform((s) => s.slice(0, max));
}

/**
 * What the player says is on screen. Every field is capped and optional: this is a hint about
 * what the child can see, and a hostile value should make the answer vaguer, never leak
 * anything. The server decides the teacher's mode; this can only tighten it.
 *
 * Capped by truncating rather than rejecting: a picture question's prompt (which describes the
 * image at length) or a long worked answer used to 400 the whole chat, leaving a child unable to
 * ask for help on exactly the questions that most needed it.
 */
const viewSchema = z.object({
  stage: z.enum(["STARTER", "LEARN", "PRACTICE", "CHECK", "FEEDBACK", "COMPLETE"]).optional(),
  section: capped(300).optional(),
  questionPrompt: capped(2000).optional(),
  options: z.array(capped(500)).max(8).optional(),
  unanswered: z.boolean().optional(),
  draft: capped(600).optional(),
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
