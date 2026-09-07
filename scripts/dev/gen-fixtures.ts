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
import type { LessonSpec, QuizSpec, SubjectYearSpec } from "./content/types";
import { SUBJECT_YEARS } from "./content";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
