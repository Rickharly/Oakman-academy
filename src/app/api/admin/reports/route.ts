import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireParentApi, jsonError, ApiError } from "@/lib/auth/api";
import { generateReport } from "@/lib/reports/generate";

const bodySchema = z.object({
  studentId: z.string(),
  period: z.enum(["WEEKLY", "MONTHLY"]),
  start: z.string(),
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

    const report = await generateReport(body.studentId, body.period, body.start);
    return Response.json({ report });
  } catch (err) {
    return jsonError(err);
  }
}
