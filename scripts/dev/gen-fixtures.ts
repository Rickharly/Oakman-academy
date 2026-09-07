/**
 * Generates fixtures/curriculum/*.json from the hand-authored lesson content below.
 *
 * This script is a one-time authoring tool, not part of the app: it exists so the repetitive
 * Oak-response-shape boilerplate (quiz question envelopes, option wrapping, asset lists) is
 * assembled consistently, while every fact, transcript and question below is written by hand
 * for this project. The committed JSON in fixtures/curriculum/ is the artefact — run with
 * `npx tsx scripts/dev/gen-fixtures.ts` to regenerate it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- authoring types ----------

interface McSpec {
  kind: "mc";
  question: string;
  correct: string[];
  distractors: string[];
}
interface ShortSpec {
  kind: "short";
  question: string;
  answers: string[];
}
interface MatchSpec {
  kind: "match";
  question: string;
  pairs: [string, string][];
}
interface OrderSpec {
  kind: "order";
  question: string;
  items: string[];
}
type QuizSpec = McSpec | ShortSpec | MatchSpec | OrderSpec;

interface WorksheetQSpec {
  text: string;
  type?: "numeric" | "short" | "extended";
  answer?: string;
}

interface LessonSpec {
  slug: string;
  title: string;
  pupilLessonOutcome: string;
  keyLearningPoints: string[];
  keywords: { keyword: string; description: string }[];
  misconceptions: { misconception: string; response: string }[];
  teacherTips: string[];
  transcript: string;
  starterQuiz: QuizSpec[];
  exitQuiz: QuizSpec[];
  worksheet: WorksheetQSpec[];
}

interface UnitSpec {
  slug: string;
  title: string;
  description: string;
  whyThisWhyNow: string;
  priorKnowledge: string[];
  nationalCurriculum: string[];
  lessons: LessonSpec[];
}

interface SubjectYearSpec {
  subject: { slug: string; title: string };
  programme: {
    sequenceSlug: string;
    yearGroup: number;
    keyStage: string;
    phase: string;
    title: string;
  };
  units: UnitSpec[];
}

// ---------- Oak-shape builders ----------

function buildQuizQuestion(spec: QuizSpec): unknown {
  switch (spec.kind) {
    case "mc": {
      // Interleave distractor/correct answers (round-robin) so the correct one isn't always first.
      const correct = spec.correct.map((content) => ({ content, distractor: false }));
      const distractors = spec.distractors.map((content) => ({ content, distractor: true }));
      const answers: { content: string; distractor: boolean }[] = [];
      let ci = 0;
      let di = 0;
      while (ci < correct.length || di < distractors.length) {
        if (di < distractors.length) answers.push(distractors[di++]!);
        if (ci < correct.length) answers.push(correct[ci++]!);
      }
      return {
        question: spec.question,
        questionType: "multiple-choice",
        answers: answers.map((a) => ({ type: "text", content: a.content, distractor: a.distractor })),
      };
    }
    case "short":
      return {
        question: spec.question,
        questionType: "short-answer",
        answers: spec.answers.map((content) => ({ type: "text", content })),
      };
    case "match":
      return {
        question: spec.question,
        questionType: "match",
        answers: spec.pairs.map(([left, right]) => ({
          matchOption: { type: "text", content: left },
          correctChoice: { type: "text", content: right },
        })),
      };
    case "order":
      return {
        question: spec.question,
        questionType: "order",
        answers: spec.items.map((content, i) => ({ order: i + 1, type: "text", content })),
      };
  }
}

function buildLesson(lesson: LessonSpec) {
  const summary = {
    lessonTitle: lesson.title,
    pupilLessonOutcome: lesson.pupilLessonOutcome,
    keyLearningPoints: lesson.keyLearningPoints.map((keyLearningPoint) => ({ keyLearningPoint })),
    lessonKeywords: lesson.keywords,
    misconceptionsAndCommonMistakes: lesson.misconceptions,
    teacherTips: lesson.teacherTips.map((teacherTip) => ({ teacherTip })),
    contentGuidance: null,
    supervisionLevel: null,
    canonicalUrl: `https://example-fixture.invalid/lessons/${lesson.slug}`,
    oakUrl: `https://example-fixture.invalid/lessons/${lesson.slug}`,
    downloadsAvailable: true,
  };
  const quiz = {
    starterQuiz: lesson.starterQuiz.map(buildQuizQuestion),
    exitQuiz: lesson.exitQuiz.map(buildQuizQuestion),
  };
  const transcript = { transcript: lesson.transcript };
  const assets = {
    assets: [
      { type: "worksheet", label: "Worksheet", url: `fixture://worksheet/${lesson.slug}.pdf` },
      { type: "video", label: "Video", url: `fixture://video/${lesson.slug}` },
    ],
    attribution: [] as string[],
  };
  const worksheet = {
    questions: lesson.worksheet.map((q, i) => ({
      number: String(i + 1),
      text: q.text,
      ...(q.type ? { type: q.type } : {}),
      ...(q.answer ? { answer: q.answer } : {}),
    })),
  };
  return { summary, quiz, transcript, assets, worksheet };
}

function buildFixtureFile(spec: SubjectYearSpec) {
  const units = spec.units.map((unit, unitIndex) => ({
    unitSlug: unit.slug,
    unitTitle: unit.title,
    unitOrder: unitIndex + 1,
    description: unit.description,
    whyThisWhyNow: unit.whyThisWhyNow,
    priorKnowledgeRequirements: unit.priorKnowledge,
    nationalCurriculumContent: unit.nationalCurriculum,
    threads: [],
    categories: [],
    unitLessons: unit.lessons.map((lesson, i) => ({
      lessonSlug: lesson.slug,
      lessonTitle: lesson.title,
      lessonOrder: i + 1,
      state: "published" as const,
    })),
  }));

  const lessons: Record<string, unknown> = {};
  const licences: Record<string, "ogl-compatible"> = {};
  for (const unit of spec.units) {
    for (const lesson of unit.lessons) {
      lessons[lesson.slug] = buildLesson(lesson);
      licences[lesson.slug] = "ogl-compatible";
    }
  }

  return {
    subject: spec.subject,
    programme: spec.programme,
    units,
    lessons,
    licences,
  };
}

// ---------- content ----------
// Each entry is a full subject + year group. All facts, transcripts, keywords, misconceptions
// and questions are written for this project (English National Curriculum KS2/KS3 aligned).

const SUBJECT_YEARS: SubjectYearSpec[] = [
  {
    subject: { slug: "maths", title: "Maths" },
    programme: {
      sequenceSlug: "maths-secondary",
      yearGroup: 7,
      keyStage: "ks3",
      phase: "secondary",
      title: "Maths — Year 7",
    },
    units: [
      {
        slug: "fractions-and-equivalent-fractions",
        title: "Fractions and equivalent fractions",
        description:
          "Pupils develop a secure understanding of fractions as parts of a whole, learn to generate equivalent fractions, and simplify fractions to their lowest terms.",
        whyThisWhyNow:
          "Building on fraction work from primary school, this unit consolidates fraction notation and equivalence before pupils move on to adding, subtracting and comparing fractions later in the year.",
        priorKnowledge: [
          "Pupils can recognise and write simple fractions, e.g. 1/2, 1/4, 3/4.",
          "Pupils can find fractions of a set of objects or a quantity.",
          "Pupils understand that a fraction represents a part of a whole.",
        ],
        nationalCurriculum: [
          "Use the four operations to carry out calculations involving fractions.",
          "Understand equivalent fractions.",
          "Simplify fractions by cancelling common factors.",
        ],
        lessons: [
          {
            slug: "fractions-as-parts-of-a-whole",
            title: "Understanding fractions as parts of a whole",
            pupilLessonOutcome: "I can represent a fraction as part of a whole and identify the numerator and denominator.",
            keyLearningPoints: [
              "A fraction describes a number of equal parts of a whole, written as numerator/denominator.",
              "The denominator shows how many equal parts the whole is split into; the numerator shows how many of those parts are being counted.",
              "Fractions can represent parts of a shape, a quantity, or a number line position.",
              "The whole must be split into equal-sized parts for the fraction to be valid.",
            ],
            keywords: [
              { keyword: "numerator", description: "The top number of a fraction, showing how many parts are being counted." },
              { keyword: "denominator", description: "The bottom number of a fraction, showing how many equal parts the whole is divided into." },
              { keyword: "equal parts", description: "Parts of a whole that are all exactly the same size." },
            ],
            misconceptions: [
              { misconception: "Pupils think a larger denominator always means a larger fraction.", response: "Show that as the denominator increases (with numerator fixed), each part gets smaller, so the fraction gets smaller, e.g. 1/8 is smaller than 1/2." },
              { misconception: "Pupils believe any shape split into pieces shows fractions, even if the pieces are different sizes.", response: "Emphasise that the parts must be equal in size before we can use fraction notation to describe them." },
            ],
            teacherTips: [
              "Use physical objects (counters, paper strips) to let pupils fold or split wholes into equal parts before introducing the numerator/denominator notation.",
              "Compare unit fractions (1/n) early, since these ground pupils' sense of size before mixed numerators are introduced.",
            ],
            transcript:
              "Hello and welcome to today's maths lesson. We're going to be learning about fractions, and specifically what a fraction actually represents.\n\nA fraction is a way of describing part of a whole. Imagine you have a chocolate bar and you break it into four equal pieces. If you eat one of those pieces, you have eaten one out of four equal parts, which we write as the fraction one quarter, or 1/4.\n\nEvery fraction has two parts. The bottom number is called the denominator. It tells us how many equal parts the whole has been split into. The top number is called the numerator. It tells us how many of those equal parts we are talking about. So in 3/4, the denominator, 4, tells us the whole has been split into four equal parts, and the numerator, 3, tells us we are talking about three of those parts.\n\nIt's really important that the parts are equal in size. If I cut a pizza into four pieces but one piece is huge and the other three are tiny, I can't use fraction notation to describe those pieces fairly, because they aren't equal.\n\nFractions don't just describe parts of shapes. They can describe parts of a quantity too — for example, 1/4 of 20 sweets is 5 sweets, because 20 shared into 4 equal groups gives 5 in each group. Fractions can also be shown as a point on a number line. If we draw a line from 0 to 1 and split it into four equal sections, the first mark along is at 1/4, the second at 2/4, the third at 3/4, and the last mark is at 1, or 4/4.\n\nBy the end of today, you should be able to look at a fraction like 5/8 and explain exactly what the 5 and the 8 mean, and you should be able to represent that fraction using a diagram, a quantity, or a number line. Let's get started with some examples.",
            starterQuiz: [
              { kind: "mc", question: "Which of these correctly describes the fraction 3/5?", correct: ["3 out of 5 equal parts"], distractors: ["5 out of 3 equal parts", "3 add 5", "5 minus 3"] },
              { kind: "mc", question: "In the fraction 7/10, what does the number 10 represent?", correct: ["The number of equal parts the whole is split into"], distractors: ["The number of parts being counted", "The total number of wholes", "The value of the fraction"] },
              { kind: "short", question: "What is 1/4 of 20?", answers: ["5"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "What is the numerator in the fraction 2/9?", correct: ["2"], distractors: ["9", "7", "11"] },
              { kind: "mc", question: "Which of these fractions have a denominator of 6? (select all that apply)", correct: ["1/6", "5/6"], distractors: ["1/3", "6/7"] },
              { kind: "short", question: "Write the fraction that represents 3 out of 8 equal parts.", answers: ["3/8"] },
              { kind: "match", question: "Match each fraction to its correct description.", pairs: [["1/2", "One out of two equal parts"], ["1/3", "One out of three equal parts"], ["3/4", "Three out of four equal parts"]] },
              { kind: "order", question: "Order these fractions from smallest to largest: 1/2, 1/8, 1/4.", items: ["1/8", "1/4", "1/2"] },
            ],
            worksheet: [
              { text: "What fraction of the shape is shaded if 3 out of 8 equal parts are coloured in?", type: "short", answer: "3/8" },
              { text: "Calculate 1/5 of 30.", type: "numeric", answer: "6" },
              { text: "Explain, in your own words, why the parts of a whole must be equal before we can describe them using a fraction.", type: "extended" },
              { text: "A pizza is cut into 6 equal slices. Ali eats 2 slices. What fraction of the pizza has Ali eaten?", type: "short", answer: "2/6" },
            ],
          },
          {
            slug: "finding-equivalent-fractions",
            title: "Finding equivalent fractions",
            pupilLessonOutcome: "I can generate equivalent fractions by multiplying or dividing the numerator and denominator by the same number.",
            keyLearningPoints: [
              "Equivalent fractions represent the same value even though they have different numerators and denominators.",
              "Multiplying (or dividing) both the numerator and denominator of a fraction by the same non-zero number produces an equivalent fraction.",
              "Equivalent fractions can be shown to be equal using diagrams or a number line.",
              "Finding a common denominator is a key skill for comparing and adding fractions later on.",
            ],
            keywords: [
              { keyword: "equivalent fractions", description: "Fractions that have different numerators and denominators but represent the same value." },
              { keyword: "multiply", description: "To scale a number up by repeated addition, e.g. multiplying by 2 doubles a number." },
              { keyword: "common denominator", description: "A denominator that is shared by two or more fractions, allowing them to be compared or combined." },
            ],
            misconceptions: [
              { misconception: "Pupils think you can add the same number to the numerator and denominator to find an equivalent fraction.", response: "Demonstrate with a diagram that adding the same number to top and bottom changes the value, e.g. 1/2 is not equivalent to 2/3 even though we added 1 to both parts; only multiplying or dividing keeps the value the same." },
              { misconception: "Pupils multiply only the numerator or only the denominator, not both.", response: "Stress that both numerator and denominator must be scaled by the same factor, otherwise the value of the fraction changes." },
            ],
            teacherTips: [
              "Use fraction walls or bar models so pupils can see visually that 1/2, 2/4 and 4/8 line up exactly.",
              "Encourage pupils to say the scale factor out loud, e.g. 'multiplying by 3', to reinforce that the same operation applies to both numbers.",
            ],
            transcript:
              "In our last lesson we looked at what a fraction represents. Today we're finding equivalent fractions — fractions that look different but have exactly the same value.\n\nLet's start with 1/2. If I take a bar and split it into two equal parts, one shaded part represents 1/2. Now, if I split that same bar into four equal parts instead, I would need to shade two of those four parts to cover the same amount of the bar. So 1/2 and 2/4 cover exactly the same amount — they are equivalent fractions.\n\nHow do we find equivalent fractions without drawing every time? The rule is: multiply the numerator and the denominator by the same number. Starting with 1/2, if I multiply both the numerator and denominator by 2, I get 2/4. If I multiply both by 3 instead, I get 3/6. If I multiply both by 4, I get 4/8. All of these fractions — 1/2, 2/4, 3/6, 4/8 — are equivalent, because we have applied the same scaling to both parts every time.\n\nThis also works in reverse. If we divide both the numerator and denominator by the same number, we also get an equivalent fraction. For example, 6/8 divided by 2 on the top and bottom gives 3/4.\n\nA common mistake is to add the same number to the numerator and denominator instead of multiplying. This does not work — if you add 1 to the top and bottom of 1/2, you get 2/3, which is not the same value as 1/2 at all. Only multiplying or dividing by the same number keeps the fraction's value unchanged.\n\nBeing able to find equivalent fractions is an essential skill, because later we'll need to find a common denominator before we can add or compare fractions with different denominators. Let's practise finding some equivalent fractions together now.",
            starterQuiz: [
              { kind: "mc", question: "What is the denominator in the fraction 5/9?", correct: ["9"], distractors: ["5", "4", "14"] },
              { kind: "mc", question: "Which fraction is equivalent to 1/2?", correct: ["2/4"], distractors: ["1/3", "2/3", "1/4"] },
              { kind: "short", question: "What do you get if you multiply the numerator and denominator of 1/3 by 2?", answers: ["2/6"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "To find an equivalent fraction, you should multiply the numerator and denominator by...", correct: ["the same number"], distractors: ["different numbers", "zero", "the numerator only"] },
              { kind: "mc", question: "Which of these fractions are equivalent to 2/3? (select all that apply)", correct: ["4/6", "6/9"], distractors: ["3/4", "2/6"] },
              { kind: "short", question: "Write a fraction equivalent to 3/5 by multiplying top and bottom by 2.", answers: ["6/10"] },
              { kind: "match", question: "Match each fraction to an equivalent fraction.", pairs: [["1/4", "2/8"], ["2/5", "4/10"], ["3/4", "6/8"]] },
              { kind: "order", question: "Order these steps for finding an equivalent fraction of 2/3: choose a scale factor, multiply the numerator by it, multiply the denominator by it, write the new fraction.", items: ["choose a scale factor", "multiply the numerator by it", "multiply the denominator by it", "write the new fraction"] },
            ],
            worksheet: [
              { text: "Find an equivalent fraction to 1/3 by multiplying the numerator and denominator by 4.", type: "short", answer: "4/12" },
              { text: "Is 3/6 equivalent to 1/2? Explain how you know.", type: "extended" },
              { text: "Divide the numerator and denominator of 8/12 by 4. What fraction do you get?", type: "short", answer: "2/3" },
              { text: "Write two fractions that are equivalent to 2/5.", type: "extended" },
            ],
          },
          {
            slug: "simplifying-fractions",
            title: "Simplifying fractions to their lowest terms",
            pupilLessonOutcome: "I can simplify a fraction to its lowest terms by dividing the numerator and denominator by their highest common factor.",
            keyLearningPoints: [
              "A fraction is in its simplest form (lowest terms) when the numerator and denominator share no common factor other than 1.",
              "To simplify a fraction, divide both the numerator and denominator by a common factor.",
              "Dividing by the highest common factor simplifies a fraction in one step.",
              "Simplifying a fraction does not change its value, only how it is written.",
            ],
            keywords: [
              { keyword: "simplify", description: "To write a fraction using the smallest possible numerator and denominator while keeping the same value." },
              { keyword: "common factor", description: "A number that divides exactly into two or more other numbers." },
              { keyword: "highest common factor", description: "The largest number that divides exactly into two or more numbers." },
            ],
            misconceptions: [
              { misconception: "Pupils think a fraction is only simplified if the numerator is 1.", response: "Show examples like 4/6 simplifying to 2/3, where the simplified numerator is not 1, to demonstrate that 'simplest form' just means no common factor remains, not that the numerator must be 1." },
              { misconception: "Pupils stop simplifying too early, dividing by a common factor that isn't the highest one.", response: "Model checking the result again after each division to see if a further common factor still exists, e.g. 8/12 → 4/6 (still has common factor 2) → 2/3." },
            ],
            teacherTips: [
              "Encourage pupils to list factors of the numerator and denominator to spot the highest common factor before dividing.",
              "Link simplifying back to equivalent fractions from the previous lesson — simplifying is just finding an equivalent fraction with smaller numbers.",
            ],
            transcript:
              "Today we're building on equivalent fractions to learn how to simplify a fraction — writing it using the smallest possible numbers while keeping exactly the same value.\n\nLet's look at the fraction 6/8. Both 6 and 8 can be divided by 2. If we divide the numerator, 6, by 2, we get 3. If we divide the denominator, 8, by 2, we get 4. So 6/8 simplifies to 3/4. These two fractions have the same value — we've just written it using smaller numbers.\n\nHow do we know when a fraction is fully simplified? A fraction is in its simplest form, or lowest terms, when the numerator and denominator share no common factor other than 1. Let's check 3/4: the factors of 3 are 1 and 3; the factors of 4 are 1, 2 and 4. The only factor they share is 1, so 3/4 cannot be simplified any further.\n\nSometimes a fraction needs more than one step. Take 8/12. Both numbers can be divided by 2, giving 4/6. But 4 and 6 can still both be divided by 2, giving 2/3. Now the factors of 2 are 1 and 2, and the factors of 3 are 1 and 3 — the only shared factor is 1, so we've reached the simplest form.\n\nA quicker way is to find the highest common factor of the numerator and denominator straight away, then divide by that in one step. For 8 and 12, the highest common factor is 4, so dividing both by 4 immediately gives 2/3 — the same answer, in one step instead of two.\n\nA common mistake is thinking a fraction is only fully simplified if the numerator is 1. That's not true — 2/3 is fully simplified even though the numerator is 2, because 2 and 3 share no common factor. Let's practise simplifying some fractions together now.",
            starterQuiz: [
              { kind: "mc", question: "What are the factors of 8?", correct: ["1, 2, 4, 8"], distractors: ["1, 3, 8", "2, 4, 6, 8", "1, 8"] },
              { kind: "mc", question: "Which fraction is equivalent to 4/8?", correct: ["1/2"], distractors: ["2/3", "1/4", "3/4"] },
              { kind: "short", question: "Divide the numerator and denominator of 4/8 by 4. What fraction do you get?", answers: ["1/2"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "A fraction is in its simplest form when the numerator and denominator share no common factor other than...", correct: ["1"], distractors: ["2", "0", "the denominator"] },
              { kind: "mc", question: "Which of these fractions are already in their simplest form? (select all that apply)", correct: ["3/5", "2/3"], distractors: ["4/8", "6/9"] },
              { kind: "short", question: "Simplify 9/12 to its lowest terms.", answers: ["3/4"] },
              { kind: "match", question: "Match each fraction to its simplified form.", pairs: [["6/8", "3/4"], ["4/10", "2/5"], ["10/15", "2/3"]] },
              { kind: "order", question: "Order the steps for simplifying 12/16: find the highest common factor, divide the numerator by it, divide the denominator by it, write the simplified fraction.", items: ["find the highest common factor", "divide the numerator by it", "divide the denominator by it", "write the simplified fraction"] },
            ],
            worksheet: [
              { text: "Simplify 10/15 to its lowest terms.", type: "short", answer: "2/3" },
              { text: "What is the highest common factor of 12 and 18?", type: "numeric", answer: "6" },
              { text: "Explain why 5/9 cannot be simplified any further.", type: "extended" },
              { text: "Simplify 14/21 to its lowest terms.", type: "short", answer: "2/3" },
            ],
          },
        ],
      },
      {
        slug: "introduction-to-algebra",
        title: "Introduction to algebra",
        description:
          "Pupils are introduced to algebraic notation, learn to simplify expressions by collecting like terms, and substitute numerical values into expressions.",
        whyThisWhyNow:
          "Algebra is a foundational topic for the rest of secondary mathematics; this unit builds pupils' fluency with symbols before they meet equations and formulae.",
        priorKnowledge: [
          "Pupils can use the four operations (+, -, ×, ÷) with whole numbers.",
          "Pupils understand the concept of an unknown quantity, e.g. missing number problems.",
          "Pupils can evaluate simple numerical expressions using the correct order of operations.",
        ],
        nationalCurriculum: [
          "Use and interpret algebraic notation.",
          "Simplify and manipulate algebraic expressions by collecting like terms.",
          "Substitute numerical values into formulae and expressions.",
        ],
        lessons: [
          {
            slug: "letters-to-represent-unknown-numbers",
            title: "Using letters to represent unknown numbers",
            pupilLessonOutcome: "I can use a letter to represent an unknown number and write simple algebraic expressions.",
            keyLearningPoints: [
              "In algebra, a letter (such as x or n) stands in for a number we don't yet know or that can vary.",
              "'n + 5' means 'a number, plus 5'; the letter can represent any value unless we're told otherwise.",
              "We write multiplication without the × sign in algebra, e.g. 3 × n is written 3n.",
              "Algebraic expressions let us describe general rules and patterns concisely.",
            ],
            keywords: [
              { keyword: "variable", description: "A letter used in algebra to represent a number that can change or is not yet known." },
              { keyword: "expression", description: "A collection of numbers, letters and operations, e.g. 3n + 2, that does not contain an equals sign." },
              { keyword: "term", description: "A single number, variable, or the product of numbers and variables, within an expression." },
            ],
            misconceptions: [
              { misconception: "Pupils think a letter in algebra always represents the same fixed number, like a code to crack.", response: "Explain that a variable can represent any number depending on the context; sometimes it is unknown and fixed (as in an equation), and sometimes it varies (as in a formula)." },
              { misconception: "Pupils write '3 × n' as '3 × n' or 'n3' instead of '3n'.", response: "Model the convention clearly: in algebra we write the number before the letter with no multiplication sign, e.g. 3n, not n3 or 3 × n." },
            ],
            teacherTips: [
              "Link algebraic expressions to real contexts, e.g. 'the cost of n pencils at 20p each is 20n pence', to make the abstraction concrete.",
              "Address the 3n vs n3 convention explicitly and repeatedly, as it is a very common early error.",
            ],
            transcript:
              "Welcome to our first lesson on algebra. Algebra might look mysterious at first because it uses letters instead of numbers, but really, a letter is just standing in for a number that we don't know yet, or a number that can change.\n\nLet's imagine I have a bag of marbles, but I don't know how many are inside. Instead of guessing a number, I can call the number of marbles 'n'. If someone gives me 3 more marbles, I now have 'n + 3' marbles. This expression, n + 3, describes the total number of marbles whatever n turns out to be. If n was 5, I'd have 8 marbles. If n was 10, I'd have 13 marbles. The expression works for any value of n.\n\nWe call a letter used this way a variable, because its value can vary. A group of numbers and variables joined by operations, like n + 3, is called an expression. Notice an expression does not have an equals sign — it's just a description, not a statement that two things are equal.\n\nNow let's look at multiplication in algebra. If I want to describe three times a number n, mathematicians don't write '3 × n'. Instead, we drop the multiplication sign and simply write '3n'. So 3n means 'three lots of n', or 'n multiplied by 3'. This is just a convention — a way mathematicians agree to write things — but it's really important to get right, because if you write it the wrong way round, like n3, it can be read as an entirely different thing.\n\nAlgebra becomes really powerful because a single expression can describe a whole pattern or rule at once, instead of us having to write out lots of separate number examples. Over the next few lessons we'll learn to simplify expressions and substitute numbers into them. Let's start practising writing some simple expressions now.",
            starterQuiz: [
              { kind: "mc", question: "What do we call a letter used in algebra to represent a number?", correct: ["a variable"], distractors: ["an operator", "a constant", "an equation"] },
              { kind: "mc", question: "How do we write 'three times n' in algebra?", correct: ["3n"], distractors: ["n3", "3 × n only", "n + 3"] },
              { kind: "short", question: "Write an expression for 'a number, x, plus 7'.", answers: ["x + 7", "x+7"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "Which of these is an algebraic expression?", correct: ["2n + 5"], distractors: ["2 + 5 = 7", "n = 3", "5 × 5"] },
              { kind: "mc", question: "Which of these are examples of a variable? (select all that apply)", correct: ["x", "n"], distractors: ["5", "+"] },
              { kind: "short", question: "Write 'five times a number, y' using correct algebraic notation.", answers: ["5y"] },
              { kind: "match", question: "Match each word description to its algebraic expression.", pairs: [["a number plus 4", "n + 4"], ["three times a number", "3n"], ["a number minus 2", "n - 2"]] },
              { kind: "order", question: "Order these from fewest to most terms: 5, n, n + 5.", items: ["5", "n", "n + 5"] },
            ],
            worksheet: [
              { text: "Write an expression for 'a number, m, plus 9'.", type: "short", answer: "m + 9" },
              { text: "Write 'four times a number, p' using correct algebraic notation.", type: "short", answer: "4p" },
              { text: "Explain what a variable is, using an example.", type: "extended" },
              { text: "A café charges 20p per cup of tea, t. Write an expression for the total cost in pence.", type: "short", answer: "20t" },
            ],
          },
          {
            slug: "collecting-like-terms",
            title: "Simplifying algebraic expressions by collecting like terms",
            pupilLessonOutcome: "I can simplify an algebraic expression by collecting like terms.",
            keyLearningPoints: [
              "Like terms contain exactly the same variable (or combination of variables), e.g. 3x and 5x are like terms.",
              "We simplify an expression by adding or subtracting the coefficients of like terms.",
              "Unlike terms, such as 3x and 3y, cannot be combined into a single term.",
              "Collecting like terms does not change the value of an expression, only how it is written.",
            ],
            keywords: [
              { keyword: "like terms", description: "Terms that contain the same variable(s), e.g. 4x and 7x." },
              { keyword: "coefficient", description: "The number multiplying a variable in a term, e.g. the coefficient of 5x is 5." },
              { keyword: "simplify", description: "To rewrite an expression in a shorter, equivalent form by combining like terms." },
            ],
            misconceptions: [
              { misconception: "Pupils combine unlike terms, e.g. saying 3x + 2y = 5xy.", response: "Show with real quantities (e.g. 3 apples + 2 bananas is not 5 'apple-bananas') that only terms with the exact same variable can be combined." },
              { misconception: "Pupils forget that a lone variable like x has an invisible coefficient of 1, e.g. treating x + x as 'x' instead of 2x.", response: "Explicitly write x as 1x when first collecting like terms, so pupils see 1x + 1x = 2x clearly." },
            ],
            teacherTips: [
              "Use coloured counters or shapes to represent different variables, so pupils can physically group 'like' items before collecting like terms symbolically.",
              "Get pupils to underline or colour-code like terms in a longer expression before they start combining them.",
            ],
            transcript:
              "Last lesson we learned to write algebraic expressions using variables. Today we're learning how to simplify expressions by collecting like terms.\n\nLike terms are terms that contain exactly the same variable. For example, 3x and 5x are like terms, because they both contain the variable x. But 3x and 3y are not like terms, because one has x and the other has y — they represent different things.\n\nLet's simplify the expression 3x + 5x. Since both terms have the variable x, we can combine them by adding the numbers in front, which are called coefficients. Three lots of x, plus five lots of x, gives us eight lots of x, so 3x + 5x simplifies to 8x.\n\nWhat about an expression like 4x + 3y + 2x? Here we have two different variables, x and y. We can only combine the like terms — the x terms. 4x and 2x are like terms, so they combine to 6x. The 3y term is unlike the others, so it stays on its own. The simplified expression is 6x + 3y.\n\nA common mistake is to combine terms that are not alike, for example thinking 3x + 2y equals 5xy. This is incorrect — imagine x represents apples and y represents bananas. Three apples plus two bananas doesn't become five 'apple-bananas'; they stay as three apples and two bananas, or in algebra, 3x + 2y, unless there's more information linking them.\n\nAnother thing to watch for is a lone variable on its own, like x. This actually means 1x, so x + x is the same as 1x + 1x, which simplifies to 2x, not just x.\n\nCollecting like terms doesn't change the value of the expression — it's still describing exactly the same amount — it just writes it more simply. Let's practise collecting like terms in some expressions together now.",
            starterQuiz: [
              { kind: "mc", question: "Which pair of terms are 'like terms'?", correct: ["4x and 9x"], distractors: ["4x and 9y", "4x and 9", "4 and 9y"] },
              { kind: "mc", question: "What do we call the number in front of a variable, e.g. the 5 in 5x?", correct: ["coefficient"], distractors: ["variable", "exponent", "operator"] },
              { kind: "short", question: "Simplify: 2x + 3x.", answers: ["5x"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "Simplify: 6x + 2x.", correct: ["8x"], distractors: ["8x^2", "6x2", "4x"] },
              { kind: "mc", question: "Which of these expressions contain a pair of like terms that could be collected? (select all that apply)", correct: ["3x + 5x + y", "4a + 2a + b"], distractors: ["3x + 5y", "2a + 3b"] },
              { kind: "short", question: "Simplify: 7y + 2y - 3y.", answers: ["6y"] },
              { kind: "match", question: "Match each expression to its simplified form.", pairs: [["3x + 4x", "7x"], ["5y - 2y", "3y"], ["2a + a", "3a"]] },
              { kind: "order", question: "Order the steps for simplifying 4x + 3y + 2x: identify the like terms, add their coefficients, write the final simplified expression.", items: ["identify the like terms", "add their coefficients", "write the final simplified expression"] },
            ],
            worksheet: [
              { text: "Simplify: 5x + 3x.", type: "short", answer: "8x" },
              { text: "Simplify: 6a + 2b + 3a.", type: "short", answer: "9a + 2b" },
              { text: "Explain why 4x and 4y are not like terms.", type: "extended" },
              { text: "Simplify: 8y - 3y + y.", type: "short", answer: "6y" },
            ],
          },
          {
            slug: "substituting-values-into-expressions",
            title: "Substituting values into expressions",
            pupilLessonOutcome: "I can substitute given numerical values into an algebraic expression and evaluate it.",
            keyLearningPoints: [
              "Substitution means replacing a variable in an expression with a given number.",
              "After substituting, we use the correct order of operations to work out the value of the expression.",
              "The same expression gives a different value depending on the number substituted.",
              "Substitution is used to check whether a value satisfies a formula or a rule.",
            ],
            keywords: [
              { keyword: "substitute", description: "To replace a variable in an expression with a specific numerical value." },
              { keyword: "evaluate", description: "To work out the numerical value of an expression." },
              { keyword: "order of operations", description: "The agreed sequence for carrying out calculations: brackets, indices, multiplication/division, addition/subtraction." },
            ],
            misconceptions: [
              { misconception: "Pupils substitute the value but then don't apply the correct order of operations, e.g. calculating 2 + 3x with x=4 as (2+3)×4 instead of 2+(3×4).", response: "Remind pupils that multiplication between a coefficient and a variable happens first, before any addition or subtraction, exactly as in numerical order of operations." },
              { misconception: "Pupils think substituting a negative number only affects the sign of the final answer, applying it inconsistently.", response: "Work through an example carefully with a negative substitution, e.g. x = -2 in 3x, showing 3 × (-2) = -6." },
            ],
            teacherTips: [
              "Always have pupils rewrite the expression with the number substituted in brackets before calculating, e.g. 3x becomes 3 × (4), to avoid sign and order-of-operation errors.",
              "Use real-world formulae, such as calculating cost or distance, to show why substitution matters in practice.",
            ],
            transcript:
              "In our previous two lessons, we learned to write algebraic expressions and to simplify them by collecting like terms. Today, we're learning how to substitute a number into an expression to find its value.\n\nSubstitution means replacing a variable with a specific number. Let's take the expression 3x + 2. If we're told that x = 4, we substitute 4 in place of x, giving us 3 × 4 + 2. Following the order of operations, we do the multiplication first: 3 × 4 = 12. Then we add 2, giving us a final answer of 14. So when x = 4, the expression 3x + 2 has a value of 14.\n\nIt's really important to remember the order of operations when substituting. In the expression 2 + 3x, if x = 5, we must calculate 3 × 5 first, which is 15, and then add 2, giving 17. It would be wrong to add 2 and 3 first — the multiplication between the coefficient and the variable always happens before addition or subtraction.\n\nThe same expression will give a different answer depending on what number we substitute. If we used the expression 3x + 2 again, but this time x = 10, we'd get 3 × 10 + 2, which is 30 + 2, equalling 32 — a completely different answer to when x was 4.\n\nWe also need to take care when substituting negative numbers. If x = -2 in the expression 3x, we calculate 3 × (-2), which gives -6. A helpful habit is to always write the substituted number in brackets before calculating, especially with negative numbers, so you don't lose track of the sign.\n\nSubstitution is a really useful skill because it lets us check formulae and rules with real numbers — for example, working out the cost of buying a certain number of items, or the perimeter of a shape with a given side length. Let's practise substituting some values now.",
            starterQuiz: [
              { kind: "mc", question: "What does 'substitute' mean in algebra?", correct: ["replace a variable with a given number"], distractors: ["simplify an expression", "add two expressions together", "remove a variable"] },
              { kind: "mc", question: "For 2 + 3x, once x is substituted, which operation happens first?", correct: ["multiply, then add"], distractors: ["add, then multiply", "divide first", "subtract first"] },
              { kind: "short", question: "If x = 5, what is the value of 2x?", answers: ["10"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "If x = 3, what is the value of 4x + 1?", correct: ["13"], distractors: ["16", "12", "7"] },
              { kind: "mc", question: "Which of these expressions equal 10 when x = 2? (select all that apply)", correct: ["3x + 4", "5x"], distractors: ["2x + 1", "x + 4"] },
              { kind: "short", question: "If y = 6, what is the value of 2y - 5?", answers: ["7"] },
              { kind: "match", question: "Match each expression (with x = 4) to its correct value.", pairs: [["3x", "12"], ["x + 5", "9"], ["2x - 1", "7"]] },
              { kind: "order", question: "Order the steps for evaluating 5x - 2 when x = 3: substitute x with 3, multiply 5 by 3, subtract 2 from the result.", items: ["substitute x with 3", "multiply 5 by 3", "subtract 2 from the result"] },
            ],
            worksheet: [
              { text: "If x = 6, find the value of 2x + 3.", type: "numeric", answer: "15" },
              { text: "If a = 4, find the value of 5a - 2.", type: "numeric", answer: "18" },
              { text: "Explain why the order of operations matters when substituting a value into 2 + 3x.", type: "extended" },
              { text: "If x = -2, find the value of 4x.", type: "numeric", answer: "-8" },
            ],
          },
        ],
      },
    ],
  },
  {
    subject: { slug: "english", title: "English" },
    programme: {
      sequenceSlug: "english-secondary",
      yearGroup: 7,
      keyStage: "ks3",
      phase: "secondary",
      title: "English — Year 7",
    },
    units: [
      {
        slug: "narrative-writing-descriptive-settings",
        title: "Narrative writing: descriptive settings",
        description:
          "Pupils learn to write vivid, sensory descriptions of settings using figurative language and precise word choices to create atmosphere in narrative writing.",
        whyThisWhyNow:
          "Descriptive setting-writing is a foundational narrative skill that pupils will draw on throughout KS3 for creative writing tasks and analysing published fiction.",
        priorKnowledge: [
          "Pupils can write in full sentences using a range of simple punctuation.",
          "Pupils are familiar with adjectives and simple similes from primary school.",
          "Pupils can identify the five senses.",
        ],
        nationalCurriculum: [
          "Write for a range of purposes and audiences, including narrative and descriptive writing.",
          "Use a range of vocabulary and sentence structures for effect.",
          "Use figurative language, including simile and metaphor, to create effects.",
        ],
        lessons: [
          {
            slug: "using-the-five-senses",
            title: "Using the five senses to build a setting",
            pupilLessonOutcome: "I can use sensory detail to describe a setting vividly.",
            keyLearningPoints: [
              "Skilled descriptive writing appeals to more than one of the five senses: sight, sound, smell, touch and taste.",
              "Choosing specific, concrete details is more effective than vague, general statements.",
              "Sensory description helps the reader imagine they are physically present in the setting.",
              "Not every sense needs to be used in every description — writers select senses that suit the mood they want to create.",
            ],
            keywords: [
              { keyword: "sensory detail", description: "Descriptive language that appeals to one or more of the five senses to help the reader imagine a scene." },
              { keyword: "setting", description: "The time and place in which a story or scene happens." },
              { keyword: "atmosphere", description: "The mood or feeling created in a piece of writing, e.g. tense, peaceful, eerie." },
            ],
            misconceptions: [
              { misconception: "Pupils think good description just means using lots of adjectives.", response: "Show that precise, well-chosen details (e.g. 'the damp smell of moss') are more powerful than piling up adjectives (e.g. 'the big, dark, scary, old forest')." },
              { misconception: "Pupils believe they must use all five senses in every paragraph.", response: "Explain that skilled writers choose the senses that best suit the mood — for instance, a description of a bakery might focus on smell and taste rather than sound." },
            ],
            teacherTips: [
              "Model annotating a short published extract to identify which senses the writer has used and why.",
              "Give pupils a simple setting (e.g. a beach, a forest) and ask them to brainstorm one detail for each sense before they start writing, to build the habit.",
            ],
            transcript:
              "Today we're starting a new unit on narrative writing, and we're focusing on how to describe a setting vividly using our five senses.\n\nWhen we write a story, the setting is the time and place where the action happens. A weak description might simply say, 'The forest was dark and scary.' That tells the reader something, but it doesn't help them really imagine being there. Strong descriptive writing appeals to the reader's senses — sight, sound, smell, touch, and taste — so they can picture, hear, and even smell the scene in their mind.\n\nLet's take that forest example and add sensory detail. Instead of just 'dark and scary', we might write: 'Twisted branches blotted out the last of the daylight, and the damp smell of moss clung to the air. Somewhere close by, a twig snapped.' Notice how this description uses sight — the twisted branches blotting out light — smell — the damp moss — and sound — the snapping twig. Together, these specific, concrete details do far more work than a vague adjective like 'scary'.\n\nIt's a common misconception that good description simply means using lots of adjectives. Actually, one precise, carefully chosen detail is far more powerful than a string of general adjectives. Compare 'the big, dark, scary, old forest' with 'the damp smell of moss and rotting leaves' — the second version, using a single sensory detail, creates a much stronger picture in the reader's mind.\n\nYou also don't need to use all five senses in every description. Skilled writers choose the senses that best fit the atmosphere, or mood, they want to create. A description of a busy bakery might focus on smell — the scent of fresh bread — and sound — the chatter of customers — rather than touch.\n\nToday, you'll be practising writing sensory descriptions of a setting of your choice, thinking carefully about which senses will create the atmosphere you want.",
            starterQuiz: [
              { kind: "mc", question: "How many senses can descriptive writing appeal to?", correct: ["Five"], distractors: ["Three", "Two", "Ten"] },
              { kind: "mc", question: "What is the 'setting' of a story?", correct: ["The time and place in which the story happens"], distractors: ["The main character", "The problem in the story", "The ending"] },
              { kind: "short", question: "Name one of the five senses.", answers: ["sight", "sound", "smell", "touch", "taste"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "Which sentence uses sensory detail most effectively?", correct: ["The damp smell of moss clung to the cold morning air."], distractors: ["The forest was scary.", "It was a forest.", "The forest was big and dark and scary and old."] },
              { kind: "mc", question: "Which of these are examples of sensory detail? (select all that apply)", correct: ["the sharp tang of salt in the air", "the crunch of gravel underfoot"], distractors: ["the story had three chapters", "the character was called Sam"] },
              { kind: "short", question: "Name the mood or feeling created in a piece of writing.", answers: ["atmosphere"] },
              { kind: "match", question: "Match each sense to an example detail.", pairs: [["sight", "the flickering orange glow of the fire"], ["smell", "the sweet scent of fresh bread"], ["sound", "the distant rumble of thunder"]] },
              { kind: "order", question: "Order these from vaguest to most vivid: 'It was dark.', 'The forest was dark and scary.', 'Twisted branches blotted out the last of the daylight.'", items: ["It was dark.", "The forest was dark and scary.", "Twisted branches blotted out the last of the daylight."] },
            ],
            worksheet: [
              { text: "Write one sentence describing a beach using the sense of sound.", type: "extended" },
              { text: "Name two senses other than sight that a writer could use to describe a busy kitchen.", type: "short", answer: "smell and sound" },
              { text: "Explain why one precise sensory detail is often more effective than several vague adjectives.", type: "extended" },
              { text: "Rewrite this sentence to include sensory detail: 'The room was cold.'", type: "extended" },
            ],
          },
          {
            slug: "creating-atmosphere-with-figurative-language",
            title: "Creating atmosphere with figurative language",
            pupilLessonOutcome: "I can use simile, metaphor and personification to create a particular atmosphere in a description.",
            keyLearningPoints: [
              "A simile compares one thing to another using 'like' or 'as'.",
              "A metaphor describes one thing as if it were another, without using 'like' or 'as'.",
              "Personification gives human qualities or actions to non-human things.",
              "Figurative language should be chosen deliberately to reinforce the atmosphere a writer wants to create.",
            ],
            keywords: [
              { keyword: "simile", description: "A comparison between two different things using 'like' or 'as', e.g. 'as cold as ice'." },
              { keyword: "metaphor", description: "A description of one thing as though it were another, without using 'like' or 'as', e.g. 'the classroom was a zoo'." },
              { keyword: "personification", description: "Giving human qualities or actions to something that is not human, e.g. 'the wind howled'." },
            ],
            misconceptions: [
              { misconception: "Pupils confuse similes and metaphors, thinking any comparison is a simile.", response: "Contrast the two directly: 'the fog was like a blanket' (simile, uses 'like') versus 'the fog was a blanket' (metaphor, no 'like' or 'as')." },
              { misconception: "Pupils use figurative language randomly, without considering whether it fits the intended atmosphere.", response: "Discuss how a metaphor like 'the sun was a golden coin' suits a cheerful mood, while 'the sun was a burning eye' suits a threatening one — the same idea, different effect." },
            ],
            teacherTips: [
              "Give pupils pairs of similes/metaphors describing the same thing with opposite moods, and ask them to identify which mood each creates.",
              "Encourage pupils to draft a simile or metaphor and then ask themselves: 'does this fit the atmosphere I want?'",
            ],
            transcript:
              "In our last lesson we looked at using our five senses to describe a setting. Today we're adding another powerful tool to our writing: figurative language, specifically simile, metaphor and personification.\n\nA simile compares one thing to another using the words 'like' or 'as'. For example: 'The lake was as still as glass.' Here we're comparing the stillness of the lake to glass, using the word 'as' to make the comparison clear.\n\nA metaphor also compares two things, but it does so without using 'like' or 'as' — instead, it describes one thing as if it actually were the other. For example: 'The lake was a sheet of glass.' Notice there's no 'like' or 'as' here; we are saying the lake is glass, even though we know it isn't literally glass. This creates a stronger, more direct image than a simile.\n\nPersonification is when we give human qualities or actions to something that isn't human. For example: 'The wind howled through the trees' — wind can't literally howl like an animal or a person crying out, but describing it that way makes it feel alive and threatening.\n\nThe most important thing to remember is that figurative language should always be chosen deliberately, to support the atmosphere you want to create. Let's compare two descriptions of the sun. 'The sun was a golden coin in the sky' creates a warm, cheerful atmosphere. But 'the sun was a burning eye, watching everything below' creates a much more threatening, uncomfortable atmosphere — even though both are metaphors describing the sun. The choice of figurative language completely changes how the reader feels.\n\nA common error is mixing up similes and metaphors. Remember: if you see 'like' or 'as', it's a simile; if there's a direct comparison with no 'like' or 'as', it's a metaphor. Today, you'll practise writing similes, metaphors and personification, thinking carefully about the atmosphere each choice creates.",
            starterQuiz: [
              { kind: "mc", question: "Which words does a simile use to compare two things?", correct: ["like or as"], distractors: ["is or was", "and or but", "if or then"] },
              { kind: "mc", question: "What is personification?", correct: ["Giving human qualities to non-human things"], distractors: ["Comparing two things using 'like'", "Describing a setting using only sound", "Repeating a word for effect"] },
              { kind: "short", question: "Is 'the lake was like glass' a simile or a metaphor?", answers: ["simile"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "Which sentence is a metaphor?", correct: ["The classroom was a zoo."], distractors: ["The classroom was like a zoo.", "The classroom was as loud as a zoo.", "The classroom had many animals."] },
              { kind: "mc", question: "Which of these sentences use personification? (select all that apply)", correct: ["The wind howled through the trees.", "The old house groaned in the storm."], distractors: ["The wind was strong.", "The house was old."] },
              { kind: "short", question: "Write a simile describing snow.", answers: ["as white as snow", "white as cotton wool"] },
              { kind: "match", question: "Match each term to its definition.", pairs: [["simile", "a comparison using like or as"], ["metaphor", "describing one thing as if it were another"], ["personification", "giving human qualities to non-human things"]] },
              { kind: "order", question: "Order these techniques from most direct comparison to least direct: metaphor, simile, plain description.", items: ["metaphor", "simile", "plain description"] },
            ],
            worksheet: [
              { text: "Write a simile describing a thunderstorm.", type: "extended" },
              { text: "Write a metaphor describing the moon.", type: "extended" },
              { text: "Explain the difference between a simile and a metaphor, using an example of each.", type: "extended" },
              { text: "Write a sentence using personification to describe the sea.", type: "extended" },
            ],
          },
          {
            slug: "choosing-precise-vocabulary",
            title: "Choosing precise vocabulary for effect",
            pupilLessonOutcome: "I can select precise, ambitious vocabulary to strengthen the effect of a description.",
            keyLearningPoints: [
              "Precise vocabulary creates a clearer, more specific image than general or overused words.",
              "Verbs and adjectives can be upgraded to more powerful synonyms to strengthen a description.",
              "Word choice affects the connotations, or associated feelings, a reader experiences.",
              "Writers should avoid overusing the same words and instead vary vocabulary for effect.",
            ],
            keywords: [
              { keyword: "connotation", description: "The feeling or idea a word suggests beyond its literal meaning, e.g. 'stroll' suggests calm, while 'stride' suggests purpose." },
              { keyword: "synonym", description: "A word with a similar meaning to another word." },
              { keyword: "precise", description: "Exact and specific, rather than vague or general." },
            ],
            misconceptions: [
              { misconception: "Pupils think a 'better' word is simply a longer or more unusual word.", response: "Show that the most effective word choice is the one that most precisely fits the meaning and atmosphere, not necessarily the longest or most obscure word." },
              { misconception: "Pupils believe all synonyms are interchangeable.", response: "Compare synonyms with different connotations, e.g. 'thin' versus 'skeletal', to show that word choice changes the reader's feeling, not just the literal meaning." },
            ],
            teacherTips: [
              "Build a class 'word bank' upgrading common overused words (e.g. 'said', 'walked', 'big') into more precise alternatives.",
              "Discuss connotation directly by comparing near-synonyms and asking pupils which feels more positive or negative.",
            ],
            transcript:
              "Over the last two lessons, we've explored sensory detail and figurative language. Today we're focusing on something just as important: choosing precise vocabulary.\n\nPrecise vocabulary means choosing the exact word that best captures your meaning, rather than a vague, general, or overused one. Let's compare two sentences: 'He walked into the room' and 'He crept into the room.' Both use a verb meaning to move into a space, but 'crept' is far more precise — it tells us he moved quietly and carefully, perhaps because he didn't want to be noticed. 'Walked' doesn't give us any of that extra information.\n\nA common misconception is thinking that a 'better' word is just a longer or more unusual one. That's not true. The best word choice is the one that most precisely matches your meaning and the atmosphere you want to create — sometimes that will be a simple word, and sometimes a more ambitious one, but the key is precision, not length.\n\nWe also need to think about connotation — the feelings or ideas a word suggests beyond its basic dictionary meaning. Consider the words 'thin' and 'skeletal'. Both technically describe someone who isn't heavy, but 'thin' is fairly neutral, while 'skeletal' suggests something much more alarming — perhaps illness or starvation. Choosing between these words completely changes how a reader feels about a character, even though the literal meaning is similar.\n\nIt's also important to vary your vocabulary rather than repeating the same words again and again. If every character in your story 'said' something, your writing can feel flat. Building a bank of precise synonyms — 'whispered', 'demanded', 'muttered', 'exclaimed' — lets you show exactly how something was said, adding both precision and variety.\n\nToday, you'll be revising a piece of your own descriptive writing, hunting for vague or overused words and replacing them with more precise, deliberate choices.",
            starterQuiz: [
              { kind: "mc", question: "What does 'precise' mean?", correct: ["Exact and specific"], distractors: ["Long and unusual", "Simple and short", "Repeated often"] },
              { kind: "mc", question: "What is a synonym?", correct: ["A word with a similar meaning to another word"], distractors: ["A word that means the opposite of another word", "A type of punctuation", "A figure of speech"] },
              { kind: "short", question: "Give a more precise synonym for 'walked' that suggests moving quietly.", answers: ["crept", "tiptoed", "sneaked"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "What is 'connotation'?", correct: ["The feeling or idea a word suggests beyond its literal meaning"], distractors: ["The opposite meaning of a word", "The spelling of a word", "The number of syllables in a word"] },
              { kind: "mc", question: "Which of these words have a negative connotation? (select all that apply)", correct: ["skeletal", "stench"], distractors: ["slender", "aroma"] },
              { kind: "short", question: "Give a precise synonym for 'said' that shows someone spoke angrily.", answers: ["shouted", "snapped", "demanded", "yelled"] },
              { kind: "match", question: "Match each overused word to a more precise alternative.", pairs: [["walked", "strolled"], ["said", "whispered"], ["big", "enormous"]] },
              { kind: "order", question: "Order these words from most neutral to most negative connotation: 'slim', 'thin', 'skeletal'.", items: ["slim", "thin", "skeletal"] },
            ],
            worksheet: [
              { text: "Give a more precise synonym for 'happy'.", type: "short", answer: "delighted" },
              { text: "Explain the difference in connotation between 'confident' and 'arrogant'.", type: "extended" },
              { text: "Rewrite this sentence with more precise vocabulary: 'The dog ran across the field.'", type: "extended" },
              { text: "Give a precise synonym for 'sad' that suggests deep grief.", type: "short", answer: "devastated" },
            ],
          },
        ],
      },
      {
        slug: "introduction-to-poetry-form-and-language",
        title: "Introduction to poetry: form and language",
        description:
          "Pupils explore how poets use form, structure and language choices to create meaning and effect, developing skills to read and analyse unfamiliar poems.",
        whyThisWhyNow:
          "This unit introduces the key terminology and analytical approaches pupils will use throughout KS3 and KS4 when studying poetry.",
        priorKnowledge: [
          "Pupils have encountered rhyme and rhythm in poems read at primary school.",
          "Pupils can identify a simile and a metaphor.",
          "Pupils understand what a stanza is.",
        ],
        nationalCurriculum: [
          "Read and appreciate the depth and power of the English literary heritage through poetry.",
          "Analyse the language, structure and form of texts.",
          "Develop the confident use of Standard English in analytical writing.",
        ],
        lessons: [
          {
            slug: "exploring-rhyme-and-rhythm",
            title: "Exploring rhyme and rhythm",
            pupilLessonOutcome: "I can identify rhyme schemes and describe the effect of rhythm in a poem.",
            keyLearningPoints: [
              "A rhyme scheme is the pattern of rhyming words at the end of each line, often described using letters, e.g. ABAB.",
              "Rhythm is the pattern of stressed and unstressed syllables in a line of poetry.",
              "Regular rhyme and rhythm can create a sense of order, musicality, or momentum.",
              "Poets sometimes break a regular rhyme or rhythm pattern deliberately, to draw attention to a particular line.",
            ],
            keywords: [
              { keyword: "rhyme scheme", description: "The pattern of rhyming words at the ends of lines in a poem, labelled with letters such as ABAB." },
              { keyword: "rhythm", description: "The pattern of stressed and unstressed syllables in a line of poetry." },
              { keyword: "stanza", description: "A group of lines forming a unit within a poem, similar to a paragraph in prose." },
            ],
            misconceptions: [
              { misconception: "Pupils think all poems must rhyme.", response: "Introduce free verse as an example of poetry with no fixed rhyme scheme, to show rhyme is a choice, not a requirement." },
              { misconception: "Pupils believe rhythm is only about how a poem sounds, with no meaning or effect.", response: "Demonstrate how a fast, bouncing rhythm can create excitement or urgency, while a slow, heavy rhythm can create solemnity, linking rhythm directly to meaning." },
            ],
            teacherTips: [
              "Read poems aloud so pupils can hear rhythm and rhyme in action, rather than only seeing them on the page.",
              "Use letters (A, B, C...) on the board to help pupils physically map out a rhyme scheme before naming it.",
            ],
            transcript:
              "Welcome to our new unit on poetry. Today we're exploring two of the building blocks of poetry: rhyme and rhythm.\n\nA rhyme scheme is the pattern of rhyming words at the end of each line in a poem. We describe rhyme schemes using letters. If the first and second lines rhyme with each other, and the third and fourth lines rhyme with each other, we call that an AABB rhyme scheme. If instead the first and third lines rhyme, and the second and fourth lines rhyme, we call that ABAB.\n\nIt's a common misconception that all poems must rhyme. That's not true — many poems, called free verse, have no fixed rhyme scheme at all. Rhyme is a choice a poet makes, not a rule they must follow. A poet chooses to rhyme, or not to rhyme, depending on the effect they want to create.\n\nRhythm is a different but related idea. Rhythm is the pattern of stressed and unstressed syllables in a line — think of it like the poem's heartbeat. If you read a nursery rhyme aloud, like 'Twinkle, twinkle, little star', you can hear a strong, bouncy rhythm. That regular, bouncy rhythm suits a poem meant to be light-hearted or playful.\n\nRhythm isn't just about sound for its own sake — it affects meaning too. A fast, bouncing rhythm can create a sense of excitement or urgency, while a slow, heavy rhythm, full of long words and pauses, can create a solemn or serious mood. Poets choose their rhythm deliberately to match what they want the reader to feel.\n\nSometimes, a poet will deliberately break their own regular pattern of rhyme or rhythm. If a poem has been rhyming steadily and then suddenly a line doesn't rhyme, that's not a mistake — it's often a deliberate choice to make that line stand out and draw the reader's attention. Today, we'll read some poems aloud and practise identifying rhyme schemes and describing the effect of rhythm.",
            starterQuiz: [
              { kind: "mc", question: "What is a rhyme scheme?", correct: ["The pattern of rhyming words at the end of each line"], distractors: ["The number of lines in a poem", "The topic of a poem", "The number of syllables in a word"] },
              { kind: "mc", question: "How is a rhyme scheme usually labelled?", correct: ["Using letters, e.g. ABAB"], distractors: ["Using numbers, e.g. 1234", "Using colours", "Using punctuation marks"] },
              { kind: "short", question: "What do we call a group of lines forming a unit within a poem?", answers: ["stanza"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "Which of these is true about rhyme in poetry?", correct: ["Not all poems rhyme."], distractors: ["All poems must rhyme.", "Only old poems rhyme.", "Rhyme has no effect on meaning."] },
              { kind: "mc", question: "Which of these effects can rhythm create in a poem? (select all that apply)", correct: ["excitement or urgency", "a solemn or serious mood"], distractors: ["the poem's exact word count", "the poem's publication date"] },
              { kind: "short", question: "Name the pattern of stressed and unstressed syllables in a line of poetry.", answers: ["rhythm"] },
              { kind: "match", question: "Match each rhyme scheme label to its description.", pairs: [["AABB", "lines 1&2 rhyme, lines 3&4 rhyme"], ["ABAB", "lines 1&3 rhyme, lines 2&4 rhyme"], ["free verse", "no fixed rhyme scheme"]] },
              { kind: "order", question: "Order these poem types from most regular rhyme to least regular rhyme: strict AABB rhyme scheme, occasional rhyme, free verse.", items: ["strict AABB rhyme scheme", "occasional rhyme", "free verse"] },
            ],
            worksheet: [
              { text: "What rhyme scheme label would you give a poem where lines 1 and 2 rhyme, and lines 3 and 4 rhyme?", type: "short", answer: "AABB" },
              { text: "Explain how a fast, bouncy rhythm might affect the mood of a poem.", type: "extended" },
              { text: "What is 'free verse'?", type: "short", answer: "poetry with no fixed rhyme scheme" },
              { text: "Why might a poet deliberately break their rhyme scheme on one line?", type: "extended" },
            ],
          },
          {
            slug: "understanding-stanza-and-structure",
            title: "Understanding stanza and structure",
            pupilLessonOutcome: "I can identify how a poem is structured into stanzas and explain how structure shapes meaning.",
            keyLearningPoints: [
              "A stanza is a group of lines forming a unit within a poem, similar to a paragraph in prose.",
              "Poets can use stanza length and line length to control pace and emphasis.",
              "A change in structure (e.g. a shorter stanza, or a single-line stanza) can signal a shift in tone or idea.",
              "Structure includes features such as enjambment (a sentence running over from one line to the next) and caesura (a pause within a line).",
            ],
            keywords: [
              { keyword: "stanza", description: "A group of lines forming a unit within a poem, similar to a paragraph in prose." },
              { keyword: "enjambment", description: "When a sentence or phrase runs on from one line of poetry to the next without a pause." },
              { keyword: "caesura", description: "A deliberate pause or break within a line of poetry, often marked by punctuation." },
            ],
            misconceptions: [
              { misconception: "Pupils think stanza breaks are random and have no purpose.", response: "Show an example where a stanza break marks a clear shift in time, place, or idea, to demonstrate that structure is a deliberate choice." },
              { misconception: "Pupils confuse enjambment with just 'a long sentence'.", response: "Clarify that enjambment specifically means a sentence continues across a line break without punctuation, forcing the reader onward, which is a specific structural technique, not just sentence length." },
            ],
            teacherTips: [
              "Show a poem with its stanza breaks removed, and ask pupils to guess where they think the breaks should go and why.",
              "Read a poem with enjambment aloud, pausing to show how it creates a sense of momentum or urgency.",
            ],
            transcript:
              "In our last lesson we looked at rhyme and rhythm. Today we're looking at another key building block of poetry: structure, including stanzas.\n\nA stanza is a group of lines that form a unit within a poem — you can think of it like a paragraph in prose writing. Just as a new paragraph often signals a new idea in an essay, a new stanza in a poem often signals a shift — perhaps in time, place, mood, or idea.\n\nIt's a misconception to think stanza breaks are random. They're not — poets choose exactly where to break a stanza for a reason. For example, if a poem describes a calm, peaceful scene for two long stanzas, and then suddenly has one very short stanza, that short stanza is likely to signal an important change — perhaps a sudden event, or a shift to a darker mood.\n\nPoets also use two techniques within lines to control pace: enjambment and caesura. Enjambment is when a sentence or phrase continues from one line to the next without a pause, forcing the reader to move quickly onward to complete the sense of the sentence. This can create a feeling of momentum, or of thoughts tumbling out urgently.\n\nCaesura is the opposite in some ways — it's a deliberate pause within a single line, often marked by punctuation like a comma, dash, or full stop. A caesura slows the reader down and can create a moment of reflection, hesitation, or emphasis.\n\nIt's important not to confuse enjambment with simply 'a long sentence'. Enjambment specifically refers to a sentence continuing across a line break with no punctuation at the end of the line — it's about how the poem is laid out on the page, not just about sentence length.\n\nToday, we'll look at how structure — stanza length, enjambment and caesura — shapes the meaning and pace of a poem, using a poem we'll read together.",
            starterQuiz: [
              { kind: "mc", question: "What is a stanza similar to in prose writing?", correct: ["A paragraph"], distractors: ["A sentence", "A chapter", "A footnote"] },
              { kind: "mc", question: "What is enjambment?", correct: ["A sentence running on from one line to the next without a pause"], distractors: ["A pause within a line", "A rhyme at the end of a line", "A repeated word"] },
              { kind: "short", question: "What do we call a deliberate pause within a line of poetry?", answers: ["caesura"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "A sudden, very short stanza after several long stanzas is most likely to signal...", correct: ["an important shift or change"], distractors: ["a printing error", "the end of the poem only", "nothing significant"] },
              { kind: "mc", question: "Which of these are structural features of a poem? (select all that apply)", correct: ["enjambment", "caesura"], distractors: ["simile", "alliteration"] },
              { kind: "short", question: "What is a group of lines forming a unit within a poem called?", answers: ["stanza"] },
              { kind: "match", question: "Match each term to its definition.", pairs: [["stanza", "a group of lines forming a unit"], ["enjambment", "a sentence running over a line break"], ["caesura", "a pause within a line"]] },
              { kind: "order", question: "Order these from most flowing/fast-paced to most paused/slow: strong enjambment, no enjambment or caesura, frequent caesura.", items: ["strong enjambment", "no enjambment or caesura", "frequent caesura"] },
            ],
            worksheet: [
              { text: "What effect might enjambment create for the reader?", type: "extended" },
              { text: "What punctuation is often used to create a caesura?", type: "short", answer: "a comma or dash" },
              { text: "Explain why a poet might use a very short stanza after several long ones.", type: "extended" },
              { text: "What is a stanza?", type: "short", answer: "a group of lines forming a unit in a poem" },
            ],
          },
          {
            slug: "analysing-word-choice-in-poetry",
            title: "Analysing word choice in poetry",
            pupilLessonOutcome: "I can analyse a poet's word choices and explain their effect on the reader.",
            keyLearningPoints: [
              "Poets choose individual words very deliberately for their precise meaning and connotation.",
              "Analysis should explain the effect of a word choice, not just identify or describe it.",
              "Sound devices such as alliteration and onomatopoeia can reinforce a word's meaning.",
              "The 'point, evidence, explain' structure helps organise clear analytical writing about language.",
            ],
            keywords: [
              { keyword: "alliteration", description: "The repetition of the same consonant sound at the start of nearby words, e.g. 'the wild wind whispered'." },
              { keyword: "onomatopoeia", description: "A word that imitates the sound it describes, e.g. 'crash', 'buzz', 'hiss'." },
              { keyword: "analyse", description: "To explain in detail how and why a writer's choices create a particular effect on the reader." },
            ],
            misconceptions: [
              { misconception: "Pupils identify a technique (e.g. 'this is alliteration') without explaining its effect.", response: "Model the difference between spotting a technique and analysing it: 'this is alliteration' is identification; explaining that the repeated sound mimics wind and makes the description feel more immersive is analysis." },
              { misconception: "Pupils think there is only one 'correct' interpretation of a word choice.", response: "Show that thoughtful analytical writing can offer more than one valid interpretation, as long as it is supported by evidence from the text." },
            ],
            teacherTips: [
              "Use sentence starters like 'This suggests...' or 'This creates an effect of...' to push pupils from identification into explanation.",
              "Model close analysis of a single word choice in detail before asking pupils to attempt a whole line independently.",
            ],
            transcript:
              "Over this unit we've explored rhyme, rhythm and structure. Today we're focusing on the smallest building block of a poem: individual word choices, and how to analyse them.\n\nPoets choose their words extremely deliberately. Every single word in a well-crafted poem has been considered for its precise meaning and its connotation — the feeling or idea it suggests beyond its literal meaning. When we analyse poetry, our job is to explain the effect of these choices on the reader, not just to spot them.\n\nLet's look at an example. Imagine a poem describes 'the wild wind whispered through the trees'. First, we might notice the alliteration — the repeated 'w' sound in 'wild wind whispered'. But simply saying 'this is alliteration' is only identification, not analysis. To analyse it properly, we need to explain the effect: the soft, repeated 'w' sound mimics the continuous, breathy sound of wind itself, making the description feel more immersive and realistic — almost as if we can hear the wind as we read.\n\nThis example also uses onomatopoeia — a word that imitates the sound it describes. 'Whispered' doesn't just tell us the wind made a sound; the word itself sounds soft and breathy, reinforcing the meaning through its very sound.\n\nA really useful structure for analytical writing is 'point, evidence, explain', sometimes shortened to PEE. First, make a clear point about the effect the poet creates. Second, give a quotation as evidence. Third, and most importantly, explain in detail how the specific words in that evidence create that effect.\n\nIt's worth remembering there isn't always only one correct interpretation. Poetry can be read in more than one valid way, as long as your interpretation is properly supported with evidence from the text. Today, you'll practise close analysis of word choices in a short poem, focusing on explaining effect, not just spotting technique.",
            starterQuiz: [
              { kind: "mc", question: "What is alliteration?", correct: ["The repetition of the same consonant sound at the start of nearby words"], distractors: ["A word that imitates a sound", "A rhyme at the end of a line", "A pause within a line"] },
              { kind: "mc", question: "What is onomatopoeia?", correct: ["A word that imitates the sound it describes"], distractors: ["A comparison using 'like'", "A repeated consonant sound", "A type of rhyme scheme"] },
              { kind: "short", question: "Give an example of an onomatopoeic word.", answers: ["crash", "buzz", "hiss", "bang", "pop"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "What does 'PEE' stand for in analytical writing?", correct: ["Point, evidence, explain"], distractors: ["Poem, extract, ending", "Point, example, evaluate", "Prose, evidence, effect"] },
              { kind: "mc", question: "Which of these are examples of analysis, rather than just identification? (select all that apply)", correct: ["The repeated 'w' sound mimics the sound of wind, making the scene feel more immersive.", "The onomatopoeic word 'crash' makes the impact feel sudden and violent."], distractors: ["This is alliteration.", "This is onomatopoeia."] },
              { kind: "short", question: "What does 'connotation' mean?", answers: ["the feeling or idea a word suggests beyond its literal meaning"] },
              { kind: "match", question: "Match each technique to its example.", pairs: [["alliteration", "the wild wind whispered"], ["onomatopoeia", "the branch snapped"], ["metaphor", "the moon was a silver coin"]] },
              { kind: "order", question: "Order these steps for analysing a word choice: make a point, give a quotation as evidence, explain the effect.", items: ["make a point", "give a quotation as evidence", "explain the effect"] },
            ],
            worksheet: [
              { text: "Identify the alliteration in this line: 'the silent snow settled softly'.", type: "short", answer: "silent, settled, softly" },
              { text: "Explain the effect of the onomatopoeic word 'crash' in a description of a storm.", type: "extended" },
              { text: "Write a point, evidence, explain paragraph analysing the word 'whispered' in a description of wind.", type: "extended" },
              { text: "What is the difference between identifying a technique and analysing it?", type: "extended" },
            ],
          },
        ],
      },
    ],
  },
  // INSERT_HERE
];

// ---------- write ----------

const outDir = path.resolve(__dirname, "../../fixtures/curriculum");
fs.mkdirSync(outDir, { recursive: true });

for (const spec of SUBJECT_YEARS) {
  const file = buildFixtureFile(spec);
  const outPath = path.join(outDir, `${spec.subject.slug}-year-${spec.programme.yearGroup}.json`);
  fs.writeFileSync(outPath, JSON.stringify(file, null, 2) + "\n", "utf-8");
  const lessonCount = spec.units.reduce((n, u) => n + u.lessons.length, 0);
  console.log(`wrote ${outPath} (${spec.units.length} units, ${lessonCount} lessons)`);
}
