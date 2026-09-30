/**
 * POST /api/admin/placement — set a child a paper that finds their level.
 *
 * For a child who finishes everything correctly and quickly: the score tells you the work is
 * too easy and never how much too easy. This builds a ladder in one subject and puts it on
 * their board for today.
 *
 * GET returns the verdict of the last one they sat, which is the part a parent acts on.
 */
import { z } from "zod";
import { jsonError, requireParentApi } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { buildPlacementExam, readPlacement } from "@/lib/exams/placement";
import { schoolDayKey, toDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({ studentId: z.string(), subject: z.string().min(1) });

/** Only ever this parent's own children. */
async function ownedStudent(parentId: string, studentId: string) {
  return prisma.studentProfile.findFirst({
    where: { id: studentId, user: { studentLinks: { some: { parentId } } } },
    include: { user: { select: { displayName: true } } },
  });
}

export async function POST(req: Request) {
  try {
    const parent = await requireParentApi(req);
    const body = bodySchema.parse(await req.json());
    const student = await ownedStudent(parent.id, body.studentId);
    if (!student) return Response.json({ error: "Not your student" }, { status: 403 });

    const exam = await buildPlacementExam(student.id, body.subject);
    if (!exam) {
      return Response.json(
        {
          error:
            "Not enough imported material in that subject to build a real ladder yet. A paper made of three questions measures nothing.",
        },
        { status: 400 },
      );
    }

    await prisma.dailyAssignment.create({
      data: {
        studentId: student.id,
        date: toDateOnly(schoolDayKey()),
        order: -2,
        kind: "EXAM",
        source: "PARENT",
        status: "PLANNED",
        examId: exam.id,
        customTitle: exam.title,
        estimatedMinutes: 40,
      },
    });

    return Response.json({ ok: true, examId: exam.id, title: exam.title });
  } catch (err) {
    return jsonError(err);
  }
}

export async function GET(req: Request) {
  try {
    const parent = await requireParentApi(req);
    const students = await prisma.studentProfile.findMany({
      where: { user: { studentLinks: { some: { parentId: parent.id } } } },
      include: { user: { select: { displayName: true } } },
    });

    const results = [];
    for (const student of students) {
      const exam = await prisma.exam.findFirst({
        where: { studentId: student.id, kind: "PLACEMENT", status: "GRADED" },
        orderBy: { submittedAt: "desc" },
      });
      if (!exam) continue;
      const verdict = await readPlacement(exam.id);
      results.push({
        name: student.user.displayName,
        title: exam.title,
        grade: exam.grade,
        scorePct: exam.scorePct == null ? null : Math.round(exam.scorePct),
        ...verdict,
      });
    }

    return Response.json({ results });
  } catch (err) {
    return jsonError(err);
  }
}
