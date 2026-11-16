/**
 * New end-of-lesson questions for a child who has already answered the lesson's own.
 *
 * Hiding questions a child has already got right (`questions/seen.ts`) leaves a carried-over,
 * reviewed or pre-checked lesson with a short quiz, or with the old questions brought back to
 * make up the number. This writes new ones in their place, before the lesson is opened: on the
 * morning the day is planned, and again as the lesson page loads. Questions written after an
 * attempt has started are kept for the next one (see `getVisibleQuestions`), because the page
 * is handed its questions once and a question appearing mid-quiz would be marked as blank.
 */
import { prisma } from "@/lib/db";
import { teacherAgent } from "@/lib/ai/teacher-agent";
import { MIN_CHECK_QUESTIONS, alreadyAnsweredRight, wasAnsweredRight } from "@/lib/questions/seen";

/** How many new questions a quiz is topped back up to, at most. */
const TARGET_CHECK_QUESTIONS = 5;

const running = new Set<string>();

/** How many quiz questions this child would see that they have not already got right. */
export async function freshCheckShortfall(studentId: string, lessonId: string): Promise<number> {
  const questions = await prisma.question.findMany({
    where: {
      lessonId,
      stage: "CHECK",
      excluded: false,
      OR: [
        { source: { not: "AI_GENERATED" } },
        { generatedForStudentId: studentId },
        { generatedForStudentId: null, providerRef: null },
      ],
    },
    select: { id: true, prompt: true, source: true, generatedForStudentId: true },
  });
  // A lesson with no quiz of its own is the end-of-lesson test's job, not this.
  const ownQuiz = questions.filter((q) => q.generatedForStudentId !== studentId).length;
  if (ownQuiz === 0) return 0;

  const right = await alreadyAnsweredRight(studentId, questions);
  const fresh = questions.filter((q) => !wasAnsweredRight(q, right)).length;
  const target = Math.max(MIN_CHECK_QUESTIONS, Math.min(ownQuiz, TARGET_CHECK_QUESTIONS));
  return Math.max(0, target - fresh);
}

/**
 * Writes the missing questions, if any are missing. Never throws; returns how many it wrote.
 *
 * One run per child and lesson at a time: Today and the lesson page can both ask within a
 * second of each other, and two runs would write two sets.
 */
export async function ensureFreshCheckQuestions(studentId: string, lessonId: string): Promise<number> {
  const key = `${studentId}:${lessonId}`;
  if (running.has(key)) return 0;
  running.add(key);
  try {
    const shortfall = await freshCheckShortfall(studentId, lessonId);
    if (shortfall === 0) return 0;
    const written = await teacherAgent.generateLessonPractice({
      studentId,
      lessonId,
      count: shortfall,
      stage: "CHECK",
    });
    return written.length;
  } catch (err) {
    console.error("[fresh-questions] could not write new quiz questions", err);
    return 0;
  } finally {
    running.delete(key);
  }
}
