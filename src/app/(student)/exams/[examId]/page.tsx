import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getExamForStudent } from "@/lib/exams/service";
import { letterGrade } from "@/lib/exams/grade";
import { ExamPaper, type ExamPaperQuestion } from "@/components/student/ExamPaper";

export default async function ExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const user = await requireStudent();

  const exists = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true } });
  if (!exists) notFound();

  const { exam, questions } = await getExamForStudent(examId, user.studentProfile.id);

  /**
   * A marked paper is shown as its result, not as a form to fill in again.
   *
   * Reopening a finished exam and finding the questions blank would read as the work having
   * been lost, which is the one thing an exam must never do.
   */
  const graded =
    exam.status === "GRADED"
      ? await (async () => {
          const rows = await prisma.examQuestion.findMany({
            where: { examId },
            include: {
              lesson: {
                include: { unit: { include: { programme: { include: { subject: true } } } } },
              },
            },
          });
          const byTopic = new Map<string, { lessonTitle: string; subject: string; asked: number; right: number }>();
          for (const row of rows) {
            const key = row.lessonId;
            if (!byTopic.has(key)) {
              byTopic.set(key, {
                lessonTitle: row.lesson.title,
                subject: row.lesson.unit.programme.subject.title,
                asked: 0,
                right: 0,
              });
            }
            const topic = byTopic.get(key)!;
            topic.asked += 1;
            if (row.isCorrect) topic.right += 1;
          }
          const topics = [...byTopic.values()];
          const pct = exam.scorePct ?? 0;
          return {
            scorePct: Math.round(pct),
            grade: exam.grade ?? letterGrade(pct).letter,
            meaning: letterGrade(pct).meaning,
            topics,
            weakTopics: topics.filter((t) => t.right < t.asked),
          };
        })()
      : null;

  return (
    <div className="px-4 py-6 sm:px-6">
      <ExamPaper
        examId={exam.id}
        title={exam.title}
        questions={questions as unknown as ExamPaperQuestion[]}
        alreadyGraded={graded}
      />
    </div>
  );
}
