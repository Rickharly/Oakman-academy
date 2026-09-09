/**
 * POST /api/student/report-bug — a child telling us something is broken.
 *
 * Open to students, because they are the ones who see it. The context is taken from what the
 * page says they were looking at; the words are theirs.
 */
import { z } from "zod";
import { ApiError, jsonError, requireStudentApi } from "@/lib/auth/api";
import { reportBug } from "@/lib/admin/report-to-github";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  what: z.string().min(3).max(2000),
  lessonTitle: z.string().max(200).optional(),
  subject: z.string().max(80).optional(),
  stage: z.string().max(40).optional(),
  questionPrompt: z.string().max(600).optional(),
  url: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireStudentApi(req);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Tell us a little more about what happened.");
    const body = parsed.data;

    const result = await reportBug({
      what: body.what,
      studentName: user.displayName,
      yearGroup: user.studentProfile.yearGroup,
      context: {
        lessonTitle: body.lessonTitle,
        subject: body.subject,
        stage: body.stage,
        questionPrompt: body.questionPrompt,
        url: body.url,
      },
    });

    // A child should never be told their report bounced because of a server setting. It is
    // logged either way, and the failure is ours to notice.
    if (!result.ok) console.error("[report-bug] could not send", result.problem);
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
