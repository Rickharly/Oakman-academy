/**
 * Questions that cannot be answered, taken off the screen.
 *
 * "What is the missing place value heading?" with no table. "Which of these shapes is a
 * quadrilateral?" with no shapes. Some of the provider's questions are about a picture, and
 * where that picture did not come through with the import there is nothing on the page to
 * answer from.
 *
 * A child cannot tell that apart from a question they should know. They stare at it, guess,
 * get it wrong, and learn that they are the thing that is broken — and then the app marks them
 * down for it and offers to re-teach a topic they may understand perfectly well. That is worse
 * than the question simply not being there.
 *
 * So it is not there. Excluded, which every other part of the app already respects, and
 * reported so it can be fixed properly rather than silently thinning the quizzes.
 */
import { prisma } from "@/lib/db";
import { imageSchema, optionSchema } from "./types";
import { z } from "zod";

/**
 * Wording that only makes sense with something to look at.
 *
 * Deliberately narrow. "Shown below" and "in the diagram" cannot be answered from prose;
 * "describe the water cycle" can, and wrongly hiding a good question is its own harm.
 */
const NEEDS_A_PICTURE =
  /\b(in|from|on|using)\s+the\s+(image|picture|diagram|table|chart|graph|grid|number\s*line|shape|model)\b|\b(shown|pictured|displayed)\s+(below|above|here)\b|\bthe\s+(image|picture|diagram)\s+(above|below|shows)\b|\bmissing\s+(place\s+value\s+)?heading\b|\bthis\s+(diagram|picture|image|table)\b/i;

const optionsSchema = z.object({ choices: z.array(optionSchema) }).partial();

/** True when the question talks about a picture and has none — its own or on its answers. */
export function isUnanswerableWithoutPicture(question: {
  prompt: string;
  promptImage: unknown;
  options: unknown;
}): boolean {
  if (imageSchema.safeParse(question.promptImage).success) return false;

  const options = optionsSchema.safeParse(question.options);
  const optionHasImage = options.success && (options.data.choices ?? []).some((c) => c.image?.url);
  if (optionHasImage) return false;

  return NEEDS_A_PICTURE.test(question.prompt);
}

/**
 * Excludes this lesson's picture-less picture questions.
 *
 * Runs when a lesson is opened, so a child never meets one. Idempotent, and it only ever
 * excludes — a question a parent has deliberately re-enabled is left alone, because `excluded`
 * is also how a parent removes a question and their choice is not ours to overwrite.
 */
export async function hideUnanswerableQuestions(lessonId: string): Promise<number> {
  const questions = await prisma.question.findMany({
    where: { lessonId, excluded: false },
    select: { id: true, prompt: true, promptImage: true, options: true },
  });

  const broken = questions.filter(isUnanswerableWithoutPicture);
  if (broken.length === 0) return 0;

  await prisma.question.updateMany({
    where: { id: { in: broken.map((q) => q.id) } },
    data: { excluded: true },
  });
  return broken.length;
}
