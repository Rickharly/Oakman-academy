import { prisma } from "@/lib/db";
import { requireStudentApi, jsonError } from "@/lib/auth/api";

/**
 * Records that this student has seen the welcome, so it shows exactly once.
 *
 * Stored in `StudentProfile.preferences` rather than its own column: it is a UI preference,
 * not part of the learning record, and it needs no migration.
 */
export async function POST(req: Request) {
  try {
    const user = await requireStudentApi(req);
    const profile = await prisma.studentProfile.findUnique({
      where: { id: user.studentProfile.id },
      select: { preferences: true },
    });
    const preferences = (profile?.preferences ?? {}) as Record<string, unknown>;

    await prisma.studentProfile.update({
      where: { id: user.studentProfile.id },
      data: { preferences: { ...preferences, welcomeSeenAt: new Date().toISOString() } },
    });

    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
