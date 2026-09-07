import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireParentApi, jsonError, ApiError } from "@/lib/auth/api";

/** ~350 KB of base64 — comfortably above a 256px JPEG, far below anything abusive. */
const MAX_AVATAR_CHARS = 350_000;

const bodySchema = z.object({
  studentId: z.string().min(1),
  /** A `data:image/...` URL, or null to clear the photo. */
  avatar: z.string().nullable(),
});

export async function POST(req: Request) {
  try {
    const parent = await requireParentApi(req);
    const body = bodySchema.parse(await req.json());

    // A parent may only change a student they are actually linked to.
    const profile = await prisma.studentProfile.findUnique({
      where: { id: body.studentId },
      include: { user: true },
    });
    if (!profile) throw new ApiError(404, "Student not found");

    const link = await prisma.parentStudentLink.findUnique({
      where: { parentId_studentId: { parentId: parent.id, studentId: profile.userId } },
    });
    if (!link) throw new ApiError(403, "Not your student");

    if (body.avatar !== null) {
      if (!body.avatar.startsWith("data:image/")) {
        throw new ApiError(400, "That doesn't look like an image.");
      }
      if (body.avatar.length > MAX_AVATAR_CHARS) {
        throw new ApiError(413, "That photo is too large. Try a smaller one.");
      }
    }

    await prisma.user.update({
      where: { id: profile.userId },
      // Clearing the photo falls back to an emoji rather than leaving a blank circle.
      data: { avatar: body.avatar ?? "🙂" },
    });

    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: "Invalid request" }, { status: 400 });
    return jsonError(err);
  }
}
