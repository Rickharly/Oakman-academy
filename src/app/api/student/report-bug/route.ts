/**
 * POST /api/student/report-bug — a child telling us something is broken.
 *
 * Open to students, because they are the ones who see it. The context is taken from what the
 * page says they were looking at; the words are theirs.
 */
import { z } from "zod";
import { ApiError, jsonError, requireStudentApi } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { reportBug } from "@/lib/admin/report-to-github";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  what: z.string().min(3).max(2000),
  lessonTitle: z.string().max(200).optional(),
  subject: z.string().max(80).optional(),
  stage: z.string().max(40).optional(),
  questionPrompt: z.string().max(600).optional(),
  url: z.string().max(500).optional(),
  /** What the player had on screen where the video goes, in its own words. */
  videoState: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireStudentApi(req);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Tell us a little more about what happened.");
    const body = parsed.data;

    /**
     * Written down before it is sent anywhere.
     *
     * This used to go straight to GitHub and nowhere else, and when the server had no token it
     * failed into a `console.error` nobody reads. Every report the children wrote was destroyed
     * on arrival, while the app thanked them for it. A child's report is evidence and it is
     * kept here first — the sending is best-effort on top.
     */
    const log = await prisma.activityLog.create({
      data: {
        studentId: user.studentProfile.id,
        kind: "bug_report",
        data: {
          what: body.what,
          lessonTitle: body.lessonTitle ?? null,
          subject: body.subject ?? null,
          stage: body.stage ?? null,
          questionPrompt: body.questionPrompt ?? null,
          videoState: body.videoState ?? null,
          url: body.url ?? null,
          sent: false,
        },
      },
    });

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
        videoState: body.videoState,
      },
    });

    // Whether it got out is recorded too, so "did anyone ever see this?" has an answer.
    await prisma.activityLog
      .update({
        where: { id: log.id },
        data: {
          data: {
            what: body.what,
            lessonTitle: body.lessonTitle ?? null,
            subject: body.subject ?? null,
            stage: body.stage ?? null,
            questionPrompt: body.questionPrompt ?? null,
            videoState: body.videoState ?? null,
            url: body.url ?? null,
            sent: result.ok,
            problem: result.ok ? null : (result.problem ?? "unknown"),
          },
        },
      })
      .catch(() => undefined);

    // A child should never be told their report bounced because of a server setting. It is
    // logged either way, and the failure is ours to notice.
    if (!result.ok) console.error("[report-bug] could not send", result.problem);
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
