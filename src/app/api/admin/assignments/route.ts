import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireParentApi, jsonError, ApiError } from "@/lib/auth/api";
import { addCustomAssignment, moveAssignment, skipAssignment, repeatLesson } from "@/lib/admin/schedule";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    studentId: z.string(),
    dateKey: z.string(),
    title: z.string().min(1),
    instructions: z.string().optional(),
    estimatedMinutes: z.number().int().positive().optional(),
    lessonId: z.string().optional(),
  }),
  z.object({ action: z.literal("move"), studentId: z.string(), assignmentId: z.string(), toDateKey: z.string() }),
  z.object({ action: z.literal("skip"), studentId: z.string(), assignmentId: z.string() }),
  z.object({ action: z.literal("repeat"), studentId: z.string(), lessonId: z.string(), dateKey: z.string() }),
]);

async function requireLinkedStudent(parentId: string, studentProfileId: string) {
  const student = await prisma.studentProfile.findUnique({ where: { id: studentProfileId } });
  if (!student) throw new ApiError(404, "Student not found");
  const link = await prisma.parentStudentLink.findUnique({
    where: { parentId_studentId: { parentId, studentId: student.userId } },
  });
  if (!link) throw new ApiError(404, "Student not found");
  return student;
}

async function requireOwnedAssignment(studentId: string, assignmentId: string) {
  const assignment = await prisma.dailyAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment || assignment.studentId !== studentId) throw new ApiError(404, "Assignment not found");
  return assignment;
}

export async function POST(req: Request) {
  try {
    const parent = await requireParentApi(req);
    const body = bodySchema.parse(await req.json());
    await requireLinkedStudent(parent.id, body.studentId);

    if (body.action === "add") {
      const assignment = await addCustomAssignment(parent.id, {
        studentId: body.studentId,
        dateKey: body.dateKey,
        title: body.title,
        instructions: body.instructions,
        estimatedMinutes: body.estimatedMinutes,
        lessonId: body.lessonId,
      });
      return Response.json({ assignment });
    }

    if (body.action === "move") {
      await requireOwnedAssignment(body.studentId, body.assignmentId);
      const assignment = await moveAssignment(body.assignmentId, body.toDateKey);
      return Response.json({ assignment });
    }

    if (body.action === "skip") {
      await requireOwnedAssignment(body.studentId, body.assignmentId);
      const assignment = await skipAssignment(body.assignmentId);
      return Response.json({ assignment });
    }

    // repeat
    const assignment = await repeatLesson(parent.id, body.studentId, body.lessonId, body.dateKey);
    return Response.json({ assignment });
  } catch (err) {
    return jsonError(err);
  }
}
