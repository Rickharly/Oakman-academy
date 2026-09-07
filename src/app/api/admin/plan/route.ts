import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireParentApi, jsonError, ApiError } from "@/lib/auth/api";
import { planWeek } from "@/lib/scheduling/planner";
import { weekStartKey } from "@/lib/dates";

const bodySchema = z.object({ studentId: z.string(), date: z.string() });

async function requireLinkedStudent(parentId: string, studentProfileId: string) {
  const student = await prisma.studentProfile.findUnique({ where: { id: studentProfileId } });
  if (!student) throw new ApiError(404, "Student not found");
  const link = await prisma.parentStudentLink.findUnique({
    where: { parentId_studentId: { parentId, studentId: student.userId } },
  });
  if (!link) throw new ApiError(404, "Student not found");
  return student;
}

/** Re-plans the whole week containing `date` (the planner only operates on full weeks). */
export async function POST(req: Request) {
  try {
    const parent = await requireParentApi(req);
    const body = bodySchema.parse(await req.json());
    await requireLinkedStudent(parent.id, body.studentId);

    const assignments = await planWeek(body.studentId, weekStartKey(body.date), { replace: true });
    return Response.json({ assignments });
  } catch (err) {
    return jsonError(err);
  }
}
