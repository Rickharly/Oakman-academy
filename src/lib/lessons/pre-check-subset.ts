/**
 * Which of the lesson's quiz questions the "do you already know this?" check asks.
 *
 * It used to ask the whole end-of-lesson quiz. A child who did not pass it then sat the lesson
 * and was asked the very same questions at the end of it — "he's getting the same questions
 * again". With six or more, the check takes the first half, so the quiz at the end still has
 * questions they have not seen; anything they got right in the check is left out of that quiz
 * too (`questions/seen.ts`). Shared by the page and the route, so both mean the same questions.
 */
export function preCheckQuestions<T>(checkQuestions: T[]): T[] {
  if (checkQuestions.length < 6) return checkQuestions;
  return checkQuestions.slice(0, Math.max(3, Math.ceil(checkQuestions.length / 2)));
}
