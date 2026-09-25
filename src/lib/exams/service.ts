/**
 * Exams: what a child can do with nobody helping.
 *
 * Everything else in this app is teaching, and teaching is supposed to help — the teacher
 * explains, re-explains, gives a hint, marks a retry. That is right for a lesson and it means
 * no lesson score ever answers the only question a parent actually has: does my child know this
 * on their own?
 *
 * So an exam is deliberately unlike a lesson. No teacher, no hints, no retries, no re-marking.
 * It is built from the real questions of the real lessons they were taught, because an exam
 * that invents its own questions tests something other than what was covered. And when it is
 * over, every topic they got wrong comes back as work — the point of finding a gap is that
 * something happens about it.
 */
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth/api";
import type { Exam, ExamQuestion, Question } from "@/generated/prisma/client";
import { gradeQuestion, type GradingContext } from "@/lib/grading/grade";
import { isLessonDone } from "@/lib/progress/aggregate";
import { letterGrade } from "./grade";
import { plainQuestion } from "@/lib/questions/display";

/** Long enough to be a real measurement, short enough to sit in one period. */
const MAX_QUESTIONS = 20;
/** No topic gets to dominate: an exam is a sweep, not a deep dive. */
const MAX_PER_LESSON = 2;

export interface ExamTopicResult {
  lessonId: string;
  lessonTitle: string;
  subject: string;
  asked: number;
  right: number;
}

/**
 * The lessons an exam may draw on: ones this child actually worked through in the window.
 *
 * A lesson they never reached is not on the exam. Testing someone on material nobody gave them
 * is how a child learns that the number at the end is about them rather than about the work.
 */
async function lessonsCovered(studentId: string, from: Date | null, to: Date) {
  const progress = await prisma.studentLessonProgress.findMany({
    where: {
      studentId,
      ...(from ? { completedAt: { gte: from, lte: to } } : { completedAt: { lte: to } }),
    },
    include: {
      lesson: { include: { unit: { include: { programme: { include: { subject: true } } } } } },
    },
    orderBy: { completedAt: "asc" },
  });

  // Worked through, and actually taught here — a lesson they said they already knew was never
  // taught by us and is not ours to examine them on.
  return progress.filter((p) => isLessonDone(p) && p.status !== "ALREADY_KNOWN");
}

/** Spreads a fixed number of questions across topics, so every topic is represented first. */
function spread<T>(byLesson: Map<string, T[]>, total: number, perLesson: number): T[] {
  const picked: T[] = [];
  for (let round = 0; round < perLesson; round += 1) {
    for (const items of byLesson.values()) {
      if (picked.length >= total) return picked;
      const item = items[round];
      if (item) picked.push(item);
    }
  }
  return picked;
}

export interface BuildExamOptions {
  kind: "WEEKLY" | "CATCH_UP";
  /** Null means everything they have ever done. */
  from: Date | null;
  to: Date;
  title: string;
}

/**
 * Builds an exam, or returns null when there is not enough studied work to examine.
 *
 * Never throws for "no material": a Friday with nothing behind it is a quiet Friday, not an
 * error page in front of a child.
 */
export async function buildExam(studentId: string, opts: BuildExamOptions): Promise<Exam | null> {
  const covered = await lessonsCovered(studentId, opts.from, opts.to);
  if (covered.length === 0) return null;

  const lessonIds = covered.map((p) => p.lessonId);
  const questions = await prisma.question.findMany({
    where: {
      lessonId: { in: lessonIds },
      excluded: false,
      stage: { in: ["CHECK", "PRACTICE"] },
      // Nothing a machine cannot mark without a conversation: an exam has no teacher in it, so
      // an essay question would sit unmarked or be marked by a model nobody could argue with.
      type: { in: ["MULTIPLE_CHOICE", "MULTI_SELECT", "TRUE_FALSE", "NUMERIC", "SHORT_ANSWER", "MATCHING", "ORDERING"] },
      source: { not: "AI_GENERATED" },
    },
    orderBy: [{ lessonId: "asc" }, { stage: "asc" }, { order: "asc" }],
  });
  if (questions.length === 0) return null;

  const byLesson = new Map<string, Question[]>();
  for (const question of questions) {
    if (!byLesson.has(question.lessonId)) byLesson.set(question.lessonId, []);
    byLesson.get(question.lessonId)!.push(question);
  }

  const chosen = spread(byLesson, MAX_QUESTIONS, MAX_PER_LESSON);
  if (chosen.length === 0) return null;

  return prisma.exam.create({
    data: {
      studentId,
      kind: opts.kind,
      title: opts.title,
      coversFrom: opts.from,
      coversTo: opts.to,
      questions: {
        create: chosen.map((question, i) => ({
          questionId: question.id,
          lessonId: question.lessonId,
          order: i,
          maxScore: question.maxScore,
        })),
      },
    },
  });
}

/** The exam as a child sees it: the questions, and nothing that would give an answer away. */
export async function getExamForStudent(examId: string, studentId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { question: true, lesson: { select: { title: true } } },
      },
    },
  });
  if (!exam) throw new ApiError(404, "Exam not found");
  if (exam.studentId !== studentId) throw new ApiError(403, "Not your exam");

  return {
    exam,
    questions: exam.questions.map((row) => {
      const { answerKey: _key, rubric: _rubric, explanation: _explanation, ...rest } = row.question;
      void _key;
      void _rubric;
      void _explanation;
      return {
        ...plainQuestion({ ...rest, explanation: null }),
        examQuestionId: row.id,
        // The exam's own order, not the question's place in whichever lesson it came from.
        order: row.order,
        response: row.response,
      };
    }),
  };
}

/** Saves an answer as they go, so a closed tab does not cost them the paper. */
export async function saveExamAnswer(
  examQuestionId: string,
  studentId: string,
  response: unknown,
): Promise<void> {
  const row = await prisma.examQuestion.findUnique({
    where: { id: examQuestionId },
    include: { exam: true },
  });
  if (!row) throw new ApiError(404, "Question not found");
  if (row.exam.studentId !== studentId) throw new ApiError(403, "Not your exam");
  if (row.exam.status === "GRADED") throw new ApiError(400, "That exam has been marked already");

  await prisma.examQuestion.update({
    where: { id: examQuestionId },
    data: { response: response as never, answeredAt: new Date() },
  });
}

export interface ExamResult {
  exam: Exam;
  scorePct: number;
  grade: string;
  meaning: string;
  topics: ExamTopicResult[];
  weakTopics: ExamTopicResult[];
}

/**
 * Marks the paper.
 *
 * Marked the same way lesson questions are, so a child cannot be right in a lesson and wrong in
 * an exam for the same answer. Every topic they missed becomes a review item, which is how the
 * planner brings it back — an exam that produces a number and no consequence is a number.
 */
export async function submitExam(examId: string, studentId: string): Promise<ExamResult> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: {
          question: true,
          lesson: { include: { unit: { include: { programme: { include: { subject: true } } } } } },
        },
      },
    },
  });
  if (!exam) throw new ApiError(404, "Exam not found");
  if (exam.studentId !== studentId) throw new ApiError(403, "Not your exam");

  const student = await prisma.studentProfile.findUniqueOrThrow({ where: { id: studentId } });

  const marked = await Promise.all(
    exam.questions.map(async (row) => {
      if (exam.status === "GRADED") return row;
      const ctx: GradingContext = {
        studentYearGroup: student.yearGroup,
        lesson: {
          title: row.lesson.title,
          keyLearningPoints: (row.lesson.keyLearningPoints as string[] | null) ?? [],
          misconceptions:
            (row.lesson.misconceptions as { misconception: string; response: string }[] | null) ?? [],
        },
      };
      const graded = await gradeQuestion(row.question, row.response, ctx);
      return prisma.examQuestion
        .update({
          where: { id: row.id },
          data: {
            isCorrect: graded.correct,
            score: graded.score,
            maxScore: graded.maxScore,
            feedback: graded.feedbackForStudent,
          },
        })
        .then((updated) => ({ ...row, ...updated }));
    }),
  );

  const score = marked.reduce((sum, r) => sum + (r.score ?? 0), 0);
  const maxScore = marked.reduce((sum, r) => sum + r.maxScore, 0);
  const scorePct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const { letter, meaning } = letterGrade(scorePct);

  const byTopic = new Map<string, ExamTopicResult>();
  for (const row of marked) {
    const source = exam.questions.find((q) => q.id === row.id)!;
    const key = source.lessonId;
    if (!byTopic.has(key)) {
      byTopic.set(key, {
        lessonId: key,
        lessonTitle: source.lesson.title,
        subject: source.lesson.unit.programme.subject.title,
        asked: 0,
        right: 0,
      });
    }
    const topic = byTopic.get(key)!;
    topic.asked += 1;
    if (row.isCorrect) topic.right += 1;
  }

  const topics = [...byTopic.values()];
  const weakTopics = topics.filter((t) => t.right < t.asked);

  /**
   * What they got wrong comes back.
   *
   * One review item per topic missed, which is what the planner reads — so a wrong answer on
   * Friday is a piece of work on Monday rather than a line in a report nobody acts on.
   */
  for (const topic of weakTopics) {
    const existing = await prisma.reviewItem.findFirst({
      where: { studentId, lessonId: topic.lessonId, status: "PENDING", reason: "LOW_SCORE" },
    });
    if (existing) continue;
    await prisma.reviewItem.create({
      data: {
        studentId,
        lessonId: topic.lessonId,
        reason: "LOW_SCORE",
        detail: `Missed ${topic.asked - topic.right} of ${topic.asked} on the ${exam.title}.`,
        dueAt: new Date(),
      },
    });
  }

  const updated = await prisma.exam.update({
    where: { id: exam.id },
    data: {
      status: "GRADED",
      scorePct,
      grade: letter,
      submittedAt: exam.submittedAt ?? new Date(),
    },
  });

  await prisma.activityLog.create({
    data: {
      studentId,
      kind: "exam_graded",
      data: {
        examId: exam.id,
        title: exam.title,
        scorePct,
        grade: letter,
        weakTopics: weakTopics.map((t) => t.lessonTitle),
      },
    },
  });

  return { exam: updated, scorePct, grade: letter, meaning, topics, weakTopics };
}

export type { Exam, ExamQuestion };
