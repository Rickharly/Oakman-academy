import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireParentApi, jsonError, ApiError } from "@/lib/auth/api";
import { upsertSchedule } from "@/lib/admin/schedule";

const bodySchema = z.object({
  studentId: z.string(),
  rules: z.array(
    z.object({
      subjectId: z.string(),
      weeklyFrequency: z.number().int().min(0).max(5),
      preferredDays: z.array(z.number().int().min(1).max(5)),
      priority: z.number().int().optional(),
    })
  ),
});

async function requireLinkedStudent(parentId: string, studentProfileId: string) {
  const student = await prisma.studentProfile.findUnique({ where: { id: studentProfileId } });
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
    await requireLinkedStudent(parent.id, body.studentId);

    await upsertSchedule(body.studentId, body.rules);
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
