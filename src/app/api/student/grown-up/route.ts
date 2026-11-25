/**
 * POST — a parent, at the child's own tablet, moves them on.
 *
 * "If he comes to me and he's stuck, I just press a button and he moves to the next lesson,
 * under my control." The child is signed in; the parent proves who they are with their own
 * password (the one they use for Admin), checked against the parents linked to this child.
 * Nothing is trusted from the child's session alone.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, requireStudentApi } from "@/lib/auth/api";
import { verifyPassword } from "@/lib/auth/password";
import { endPeriodNow, moveToNextLesson } from "@/lib/lessons/parent-move";

const bodySchema = z.object({
  password: z.string().min(1).max(200),
  action: z.enum(["next-lesson", "end-period"]),
});

export async function POST(req: Request) {
  try {
    const user = await requireStudentApi(req);
    const body = bodySchema.parse(await req.json());

    const links = await prisma.parentStudentLink.findMany({
      where: { studentId: user.id },
      include: { parent: { select: { passwordHash: true, role: true } } },
    });
    let ok = false;
    for (const link of links) {
      if (link.parent.role === "PARENT" && (await verifyPassword(body.password, link.parent.passwordHash))) ok = true;
    }
    if (!ok) {
      await new Promise((r) => setTimeout(r, 800)); // slow down guessing
      return Response.json({ error: "That isn't the parent password." }, { status: 403 });
    }

    const studentId = user.studentProfile.id;
    const result = body.action === "next-lesson" ? await moveToNextLesson(studentId) : await endPeriodNow(studentId);
    return Response.json({ ...result, href: "/today" });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: "Enter the parent password." }, { status: 400 });
    return jsonError(err);
  }
}
