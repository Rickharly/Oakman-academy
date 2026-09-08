import { z } from "zod";
import { jsonError, requireStudentApi } from "@/lib/auth/api";
import { submitReadingResponse } from "@/lib/reading/service";

const bodySchema = z.object({
  readingTextId: z.string().min(1),
  /** null means the longer written piece; a number selects one of the short prompts. */
  promptIndex: z.number().int().min(0).max(20).nullable(),
  response: z.string().min(1).max(20_000),
  assignmentId: z.string().min(1).optional(),
  /** Seconds spent on the passage before answering. */
  readingSeconds: z.number().min(0).max(60 * 60 * 8).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireStudentApi(req);
    const input = bodySchema.parse(await req.json());

    const entry = await submitReadingResponse({
      studentId: user.studentProfile.id,
      readingTextId: input.readingTextId,
      promptIndex: input.promptIndex,
      response: input.response,
      assignmentId: input.assignmentId,
      readingSeconds: input.readingSeconds,
    });

    // Only what the child is allowed to see: the parent-facing reasoning stays server-side.
    return Response.json({
      id: entry.id,
      kind: entry.kind,
      prompt: entry.prompt,
      response: entry.response,
      feedback: entry.feedback,
      score: entry.score,
      maxScore: entry.maxScore,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "That doesn't look right. Try again." }, { status: 400 });
    }
    return jsonError(err);
  }
}
