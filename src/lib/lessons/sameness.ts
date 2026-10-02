/**
 * When two lessons are the same lesson.
 *
 * A child finishes a topic, presses "next", and gets the same thing again — "sometimes it
 * changes a little bit, but usually it's absolutely the same content." Three causes, each of
 * which the app was blind to:
 *
 * - The same lesson exists as several rows: Oak's own, the sample curriculum's, and one written
 *   here when the provider could not be reached. Different ids, identical teaching. "Done" was
 *   matched on the id, so finishing one row left its twins looking untaught.
 * - The "next topic" button took the next row by order and nothing else. It never asked whether
 *   that lesson was already done, or the same as the one just finished.
 * - Lesson writing was told not to repeat itself and nothing checked that it hadn't.
 *
 * So there is one definition of "the same teaching", and everything that decides what a child
 * does next goes through it. A title is not enough on its own — "Adding fractions" and "Adding
 * fractions with the same denominator" are worded differently and taught identically — so the
 * key learning points are compared too: two lessons that establish the same things are the same
 * lesson, whatever either is called.
 */
import { prisma } from "@/lib/db";
import { isLessonDone } from "@/lib/progress/aggregate";

export interface LessonShape {
  id: string;
  title: string;
  keyLearningPoints?: unknown;
}

export function normaliseTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Words that carry no meaning in a lesson title or a learning point. */
const FILLER = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "by", "is", "are",
  "be", "can", "how", "what", "why", "using", "use", "understand", "understanding", "learn",
  "learning", "about", "that", "this", "it", "its", "we", "you", "pupils", "will", "when",
  "where", "if", "does", "do", "not", "possible", "your", "their", "they", "them", "there",
  "so", "as", "at", "from", "which", "each", "any", "some", "more", "most", "than", "then",
  "into", "out", "up", "way", "ways", "know", "make", "made", "get", "help",
]);

/**
 * "Adding", "added" and "add" are one word for this purpose.
 *
 * Without it a lesson and its own paraphrase scored 0.64 — barely above two genuinely different
 * lessons at 0.50 — because the same idea was written in different tenses. Crude on purpose:
 * this only has to make word forms meet, not be linguistics.
 */
function stem(word: string): string {
  return word.length > 4 ? word.replace(/(ings|ing|ed|es|s)$/, "") : word;
}

function words(text: string): Set<string> {
  return new Set(
    normaliseTitle(text)
      .split(" ")
      // Numbers always survive, however short. This filtered out anything of one character,
      // which dropped the digit from "Fractions 1" and "Fractions 2" and made them the same
      // lesson — so every numbered part after the first would have been skipped as a repeat.
      // A number is often the only thing telling two lessons in a sequence apart.
      .filter((w) => /^\d+$/.test(w) || (w.length > 1 && !FILLER.has(w)))
      .map((w) => (/^\d+$/.test(w) ? w : stem(w))),
  );
}

/** How much of the smaller set the larger one contains, 0–1. */
function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

function points(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Whether two lessons teach the same thing.
 *
 * Deliberately conservative in the direction that matters. Calling two genuinely different
 * lessons "the same" skips a real lesson, which is a gap in what the child is taught; calling
 * two identical lessons "different" sets the same lesson twice, which is the complaint. The
 * thresholds lean towards catching repeats, and the learning-point test only fires when both
 * lessons have enough points to compare — two lessons with one vague point each prove nothing.
 */
export function sameTeaching(a: LessonShape, b: LessonShape): boolean {
  if (a.id === b.id) return true;

  // Same name, give or take punctuation and casing.
  if (normaliseTitle(a.title) === normaliseTitle(b.title)) return true;

  // Names that say the same thing in different words.
  const titleA = words(a.title);
  const titleB = words(b.title);
  const titlesAgree = titleA.size >= 2 && titleB.size >= 2 && overlap(titleA, titleB) >= 0.85;

  /**
   * What they actually establish. This is the real test: identical teaching under two names.
   *
   * 0.7 is measured, not chosen: the same lesson reworded scored 0.73–0.86 on real examples
   * (fractions, photosynthesis), and genuinely different neighbouring lessons scored 0.17–0.50
   * (adding vs multiplying fractions, the Romans vs the Vikings). The threshold sits in the gap
   * with room either side. Those cases are the unit tests, so it cannot drift silently.
   */
  const pointsA = points(a.keyLearningPoints);
  const pointsB = points(b.keyLearningPoints);
  let teachingAgrees = false;
  if (pointsA.length >= 2 && pointsB.length >= 2) {
    const wordsA = new Set(pointsA.flatMap((p) => [...words(p)]));
    const wordsB = new Set(pointsB.flatMap((p) => [...words(p)]));
    teachingAgrees = overlap(wordsA, wordsB) >= 0.7;
  }

  // Either the teaching matches, or the names match closely and nothing says the teaching differs.
  if (teachingAgrees) return true;
  if (titlesAgree && (pointsA.length < 2 || pointsB.length < 2)) return true;
  return false;
}

/**
 * Everything this child has already been taught in this subject.
 *
 * Across every row and every provider — which is the point. A lesson finished on Oak's row is
 * finished on the sample curriculum's row and on ours too.
 */
export async function lessonsTaught(studentId: string, subjectId: string): Promise<LessonShape[]> {
  const rows = await prisma.studentLessonProgress.findMany({
    where: { studentId, lesson: { unit: { programme: { subjectId } } } },
    select: {
      status: true,
      completedAt: true,
      lesson: { select: { id: true, title: true, keyLearningPoints: true } },
    },
  });
  return rows.filter(isLessonDone).map((r) => r.lesson);
}

/**
 * The next lesson that is actually new to this child.
 *
 * What "Start the next topic" used to be was the next row by order. Now: walk the programme in
 * order from just after this lesson, and take the first one that is neither done nor the same
 * teaching as anything done — including the lesson they have just finished, which may not be
 * recorded as done yet when this is asked.
 *
 * Wraps to the beginning of the programme if nothing new is left after this point, because a
 * child may have skipped ahead and left something unseen behind them. Returns null only when the
 * whole programme is behind them.
 */
export async function nextNewLesson(
  studentId: string,
  lessonId: string,
): Promise<{ id: string; title: string } | null> {
  const current = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { unit: { include: { programme: true } } },
  });
  if (!current) return null;

  const units = await prisma.unit.findMany({
    where: { programmeId: current.unit.programmeId },
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  const sequence = units
    .flatMap((u) => u.lessons)
    // The sample curriculum is never next, whatever order it sits in.
    .filter((l) => l.provider !== "fixture");

  const taught = await lessonsTaught(studentId, current.unit.programme.subjectId);
  const behind: LessonShape[] = [...taught, current];

  const position = sequence.findIndex((l) => l.id === current.id);
  const after = position >= 0 ? sequence.slice(position + 1) : sequence;
  const before = position >= 0 ? sequence.slice(0, position) : [];

  for (const candidate of [...after, ...before]) {
    if (behind.some((done) => sameTeaching(done, candidate))) continue;
    return { id: candidate.id, title: candidate.title };
  }
  return null;
}
