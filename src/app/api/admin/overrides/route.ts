import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireParentApi, jsonError, ApiError } from "@/lib/auth/api";
import { applyOverride } from "@/lib/admin/overrides";

const bodySchema = z.object({
  studentId: z.string(),
  type: z.enum([
    "SCORE",
    "MARK_CORRECT",
    "MASTERY",
    "LESSON_COMPLETE",
    "RESET_QUIZ",
    "REOPEN_LESSON",
    "EXCLUDE_QUESTION",
    "COMMENT",
  ]),
  questionAttemptId: z.string().optional(),
  lessonAttemptId: z.string().optional(),
  lessonId: z.string().optional(),
  questionId: z.string().optional(),
  value: z.unknown().optional(),
  comment: z.string().optional(),
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

    const override = await applyOverride(parent.id, body);
    return Response.json({ override });
  } catch (err) {
    return jsonError(err);
  }
}
