import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireParentApi, jsonError, ApiError } from "@/lib/auth/api";
import { hashPassword } from "@/lib/auth/password";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    displayName: z.string().min(1),
    username: z.string().min(3),
    pin: z.string().min(4).max(6),
    yearGroup: z.number().int().min(1).max(13),
    keyStage: z.string().min(1),
    avatar: z.string().optional(),
  }),
  z.object({
    action: z.literal("update"),
    studentId: z.string(),
    displayName: z.string().min(1).optional(),
    avatar: z.string().optional(),
    yearGroup: z.number().int().min(1).max(13).optional(),
    keyStage: z.string().min(1).optional(),
  }),
  z.object({ action: z.literal("resetPin"), studentId: z.string(), pin: z.string().min(4).max(6) }),
]);

async function requireLinkedStudent(parentId: string, studentProfileId: string) {
  const student = await prisma.studentProfile.findUnique({ where: { id: studentProfileId }, include: { user: true } });
  if (!student) throw new ApiError(404, "Student not found");
  const link = await prisma.parentStudentLink.findUnique({
    where: { parentId_studentId: { parentId, studentId: student.userId } },
  });
  if (!link) throw new ApiError(404, "Student not found");
  return student;
}

export async function POST(req: Request) {
  try {
    const parent = await requireParentApi(req);
    const body = bodySchema.parse(await req.json());

    if (body.action === "create") {
      const existing = await prisma.user.findUnique({ where: { username: body.username } });
      if (existing) throw new ApiError(409, "That username is already taken");

      const passwordHash = await hashPassword(body.pin);
      const student = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            role: "STUDENT",
            username: body.username,
            passwordHash,
            displayName: body.displayName,
            avatar: body.avatar ?? null,
          },
        });
        await tx.parentStudentLink.create({ data: { parentId: parent.id, studentId: user.id } });
        return tx.studentProfile.create({
          data: { userId: user.id, yearGroup: body.yearGroup, keyStage: body.keyStage },
          include: { user: true },
        });
      });
      return Response.json({ student });
    }

    if (body.action === "update") {
      const existing = await requireLinkedStudent(parent.id, body.studentId);
      const [student] = await prisma.$transaction([
        prisma.studentProfile.update({
          where: { id: existing.id },
          data: {
            ...(body.yearGroup != null ? { yearGroup: body.yearGroup } : {}),
            ...(body.keyStage != null ? { keyStage: body.keyStage } : {}),
          },
          include: { user: true },
        }),
        prisma.user.update({
          where: { id: existing.userId },
          data: {
            ...(body.displayName != null ? { displayName: body.displayName } : {}),
            ...(body.avatar != null ? { avatar: body.avatar } : {}),
          },
        }),
      ]);
      return Response.json({ student });
    }

    // resetPin
    const existing = await requireLinkedStudent(parent.id, body.studentId);
    const passwordHash = await hashPassword(body.pin);
    await prisma.user.update({ where: { id: existing.userId }, data: { passwordHash } });
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
