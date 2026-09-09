/**
 * The lesson's own worksheet, made answerable on the screen.
 *
 * Oak ships a lot of practice as a PDF. A PDF cannot be marked, teaches us nothing about what
 * a child got wrong, and on a Chromebook cannot realistically be downloaded, written on and
 * sent back. So the worksheet's real questions are extracted and become questions in the app —
 * the actual worksheet, not questions invented in its place.
 *
 * The second thing this fixes is subtler and worse. School worksheets are written for a class:
 * "discuss with your partner", "swap books", "in your group". A child learning at home has no
 * partner, so those tasks silently become impossible and she skips them. Here the teacher is
 * the partner — the task is rewritten so it can be done with her, and it still gets marked, so
 * "she understands open questions" is recorded rather than assumed.
 *
 * The PDF stays as a resource either way. Nothing here deletes the original.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAiProvider } from "@/lib/ai/provider";
import type { Question } from "@/generated/prisma/client";
import { extractWorksheetText, splitWorksheetQuestions } from "@/lib/questions/worksheet-pipeline";
import { fetchProviderAsset } from "@/lib/curriculum/asset-fetch";

/** More than this and it is a booklet, not a period's practice. */
const MAX_TASKS = 8;

const taskSchema = z.object({
  /** The question as the child reads it, rewritten only as far as it must be. */
  prompt: z.string(),
  type: z.enum(["SHORT_ANSWER", "NUMERIC", "EXTENDED_TEXT"]),
  /**
   * Every answer a child could reasonably write. Empty for open tasks.
   *
   * Required, not defaulted: structured outputs run in strict mode, and a defaulted field is an
   * optional one, which makes the whole schema invalid and the call fail.
   */
  acceptedAnswers: z.array(z.string()),
  /**
   * What a good answer contains, for the open ones. This is what the teacher marks against,
   * so it has to describe understanding rather than wording.
   */
  rubric: z.string().nullable(),
  /** Set when the original needed a partner, a group, or equipment we do not have. */
  adapted: z.boolean(),
});

export const worksheetSchema = z.object({
  /** Null when the pages hold nothing a child could actually answer. */
  tasks: z.array(taskSchema),
});

export type WorksheetTask = z.infer<typeof taskSchema>;

/** The worksheet's bytes, from disk if we downloaded it, else from the provider. */
async function readResourceBytes(resource: {
  storedPath: string | null;
  providerUrl: string | null;
}): Promise<Buffer | null> {
  if (resource.storedPath) {
    // storedPath is written by our own sync, never by a request.
    const base = process.env.ASSET_STORAGE_DIR || "./storage/assets";
    const full = path.resolve(resource.storedPath.startsWith("/") ? resource.storedPath : path.resolve(base, "..", resource.storedPath));
    const onDisk = await readFile(full).catch(() => null);
    if (onDisk) return onDisk;
  }

  const url = resource.providerUrl;
  if (!url) return null;

  // Through the shared fetcher: the stored URL is the provider's asset endpoint, which answers
  // with a signed link rather than the PDF. Reading that JSON as a PDF is why worksheets came
  // back empty. The key stays server-side either way.
  const res = await fetchProviderAsset(url).catch(() => null);
  if (!res?.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Turns this lesson's worksheet into questions the child can answer in the app.
 *
 * Returns the questions, or an empty array when there is no worksheet, it cannot be read, or
 * it holds nothing answerable — in which case the caller falls back to practice written from
 * the lesson. Idempotent: run twice and the same worksheet produces the same rows.
 */
export async function buildWorksheetPractice(lessonId: string): Promise<Question[]> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      unit: { include: { programme: { include: { subject: true } } } },
      resources: true,
    },
  });
  if (!lesson) return [];

  const worksheet = lesson.resources.find((r) => r.type === "WORKSHEET");
  if (!worksheet) return [];

  // Already done for this lesson: hand back what is stored rather than paying again.
  const existing = await prisma.question.findMany({
    where: { lessonId, source: "OAK_WORKSHEET", stage: "PRACTICE" },
    orderBy: { order: "asc" },
  });
  if (existing.length > 0) return existing;

  const bytes = await readResourceBytes(worksheet);
  if (!bytes) return [];

  const text = await extractWorksheetText(bytes).catch(() => "");
  if (text.trim().length < 40) return [];

  const split = splitWorksheetQuestions(text);
  // A worksheet with no numbered questions is usually a diagram or a table. Rather than give
  // up, hand the model the page text — it can still find what is being asked.
  const source =
    split.length > 0
      ? split.map((q) => `${q.number}. ${q.text}`).join("\n")
      : text.slice(0, 8000);

  const answersResource = lesson.resources.find((r) => r.type === "WORKSHEET_ANSWERS");
  const answersBytes = answersResource ? await readResourceBytes(answersResource) : null;
  const answersText = answersBytes ? await extractWorksheetText(answersBytes).catch(() => "") : "";

  const yearGroup = lesson.unit.programme.yearGroup;
  const ai = getAiProvider();
  const { data } = await ai.structured({
    model: "strong",
    schemaName: "worksheet_tasks",
    schema: worksheetSchema,
    system: [
      `You are preparing a school worksheet so one Year ${yearGroup} child can do it on a screen,`,
      "on their own, with their teacher available to talk to. Keep the worksheet's own questions:",
      "this is that worksheet, not a new one.",
      "",
      "Rules:",
      "- Keep each question's wording as close to the original as you can. Fix only what has to change.",
      "- A task that needs a partner, a group, the class, a printed sheet, scissors, or anything",
      "  physical must be rewritten so it can be done alone, in writing, with the teacher as the",
      "  other person. 'Discuss with your partner what makes a question open' becomes 'Write down",
      "  what makes a question open — I'll tell you what I think once you've had a go.' Set",
      "  adapted: true on those, and only those.",
      "- Never drop a task because it is awkward. A skipped task is a skill not practised.",
      "- Use EXTENDED_TEXT for anything asking them to explain, describe, compare or write more",
      "  than a phrase. Those get a rubric and no accepted answers.",
      "- The rubric says what a good answer shows they understand, not what words it uses — it is",
      "  marked by a teacher reading the child's own writing.",
      "- Use NUMERIC or SHORT_ANSWER only where there really is one right answer. List every form",
      "  a child might reasonably write, including spellings.",
      `- At most ${MAX_TASKS} tasks. If the worksheet has more, keep the ones that carry the lesson's`,
      "  main skill and drop repetition of the same step.",
      "- Answer key text, where given, is the marking answer — never put it in a prompt.",
      "- UK English.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          `Lesson: ${lesson.title} (${lesson.unit.programme.subject.title}, Year ${yearGroup})`,
          lesson.pupilOutcome ? `By the end they should be able to: ${lesson.pupilOutcome}` : "",
          "",
          "The worksheet:",
          source,
          answersText ? `\nThe answer sheet:\n${answersText.slice(0, 4000)}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  const tasks = data.tasks.slice(0, MAX_TASKS);
  if (tasks.length === 0) return [];

  const created: Question[] = [];
  for (const [i, task] of tasks.entries()) {
    const open = task.type === "EXTENDED_TEXT" || task.acceptedAnswers.length === 0;

    let answerKey: unknown;
    if (task.type === "NUMERIC") {
      const value = Number(String(task.acceptedAnswers[0] ?? "").replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(value)) continue;
      answerKey = { value, tolerance: 0, acceptedStrings: task.acceptedAnswers };
    } else if (open) {
      // Marked by the teacher against the rubric; there is no string to compare.
      answerKey = { rubric: task.rubric ?? "A clear answer in the child's own words." };
    } else {
      answerKey = { accepted: task.acceptedAnswers, caseSensitive: false };
    }

    // Stable across re-runs, so a re-import updates rather than duplicating.
    const providerRef = createHash("sha1").update(`${worksheet.id}:${i}:${task.prompt}`).digest("hex").slice(0, 32);

    const question = await prisma.question
      .create({
        data: {
          lessonId,
          source: "OAK_WORKSHEET",
          stage: "PRACTICE",
          order: 500 + i,
          type: open ? "EXTENDED_TEXT" : task.type,
          prompt: task.prompt,
          answerKey: answerKey as object,
          rubric: task.rubric,
          gradingMode: open ? "AI" : "DETERMINISTIC",
          maxScore: open ? 2 : 1,
          providerRef,
          generationContext: { fromWorksheet: worksheet.id, adapted: task.adapted },
        },
      })
      .catch(() => null);
    if (question) created.push(question);
  }

  return created;
}
