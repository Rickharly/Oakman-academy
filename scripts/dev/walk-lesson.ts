/**
 * Walks a whole lesson as a student against a running dev server, answering every question
 * the way a child who understood the lesson would, and checks the marking.
 *
 * This is the spec §58 loop as an executable check: log in → Today → start a lesson →
 * every stage → feedback → complete, then assert the record it left behind.
 *
 *   pnpm dev                       # in one terminal (port 3100)
 *   pnpm verify:loop               # in another
 *
 * Open-ended questions are marked by the AI against a model answer, so a canned response is
 * *meant* to lose marks; only the deterministic types are asserted.
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import type { Question } from "@/generated/prisma/client";

const BASE = process.env.WALK_BASE_URL ?? "http://localhost:3100";
const STUDENT = { username: process.env.WALK_USERNAME ?? "eva", pin: process.env.WALK_PIN ?? "1234" };

let cookie = "";

async function req(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(BASE + path, {
    ...init,
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
      ...(cookie ? { cookie } : {}),
    },
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    if (c.startsWith("fs_session=")) cookie = c.split(";")[0]!;
  }
  return res;
}

async function json<T>(res: Response): Promise<T | Record<string, never>> {
  try {
    return (await res.json()) as T;
  } catch {
    return {};
  }
}

interface SubmitResult {
  activity?: { score?: number; maxScore?: number; percentage?: number };
  results?: { questionId: string; isCorrect: boolean | null }[];
}

/** The response a child would give if they had answered correctly. */
function correctResponse(q: Question): unknown {
  const key = (q.answerKey ?? {}) as Record<string, unknown>;
  switch (q.type) {
    case "MULTIPLE_CHOICE":
      return { optionId: key.correctOptionId };
    case "MULTI_SELECT":
      return { optionIds: key.correctOptionIds };
    case "TRUE_FALSE":
      return { value: key.value };
    case "NUMERIC": {
      const accepted = key.acceptedStrings as string[] | undefined;
      return { text: String(accepted?.[0] ?? key.value ?? "") };
    }
    case "SHORT_ANSWER":
      return { text: (key.accepted as string[] | undefined)?.[0] ?? "" };
    case "EXTENDED_TEXT":
      return { text: (key.modelAnswer as string | undefined) ?? "A full answer explaining the idea." };
    case "MATCHING":
      return { pairs: key.pairs };
    case "ORDERING":
      return { order: key.order };
    default:
      return { text: "" };
  }
}

let failures = 0;
function report(pass: boolean, label: string, detail = ""): void {
  if (!pass) failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
}

async function main(): Promise<void> {
  const login = await req("/api/auth/student-login", {
    method: "POST",
    body: JSON.stringify(STUDENT),
  });
  report(login.status < 400 && Boolean(cookie), "student login", `[${login.status}]`);
  if (!cookie) return;

  const today = await req("/today");
  const todayHtml = await today.text();
  const greeting = todayHtml.match(/Good [a-z]+, [A-Za-z]+\./)?.[0];
  report(today.status < 400, "GET /today", `[${today.status}] ${greeting ?? "no greeting found"}`);

  const lesson = await prisma.lesson.findFirst({
    where: { questions: { some: {} } },
    orderBy: { providerSlug: "asc" },
  });
  if (!lesson) {
    report(false, "find a lesson with questions", "none in the database — run pnpm db:seed");
    return;
  }
  console.log(`\nlesson: ${lesson.title}`);

  const start = await req(`/api/lessons/${lesson.id}/attempts`, { method: "POST" });
  const { attemptId } = await json<{ attemptId?: string }>(start);
  report(Boolean(attemptId), "start attempt", attemptId ?? `[${start.status}]`);
  if (!attemptId) return;

  for (const stage of ["STARTER", "PRACTICE", "CHECK"] as const) {
    const questions = await prisma.question.findMany({
      where: { lessonId: lesson.id, stage },
      orderBy: { order: "asc" },
    });

    for (const q of questions) {
      await req(`/api/attempts/${attemptId}/answers`, {
        method: "POST",
        body: JSON.stringify({ questionId: q.id, response: correctResponse(q) }),
      });
    }

    const submit = await req(`/api/attempts/${attemptId}/submit`, {
      method: "POST",
      body: JSON.stringify({ stage }),
    });
    const body = (await json<SubmitResult>(submit)) as SubmitResult;
    const activity = body.activity ?? {};

    const deterministic = questions.filter((q) => q.type !== "EXTENDED_TEXT");
    const graded = body.results ?? [];
    const allDeterministicCorrect = deterministic.every((q) =>
      graded.some((r) => r.questionId === q.id && r.isCorrect === true),
    );

    report(
      submit.status < 400 && allDeterministicCorrect,
      `submit ${stage}`,
      `${activity.score ?? "-"}/${activity.maxScore ?? "-"} ` +
        `(${Math.round(activity.percentage ?? 0)}%) [${questions.map((q) => q.type).join(", ")}]`,
    );

    if (stage === "STARTER") {
      const learn = await req(`/api/attempts/${attemptId}/stage`, {
        method: "POST",
        body: JSON.stringify({ stage: "LEARN", action: "complete" }),
      });
      report(learn.status < 400, "complete LEARN", `[${learn.status}]`);
    }
  }

  for (const stage of ["FEEDBACK", "COMPLETE"] as const) {
    const res = await req(`/api/attempts/${attemptId}/stage`, {
      method: "POST",
      body: JSON.stringify({ stage, action: "complete" }),
    });
    report(res.status < 400, `complete ${stage}`, `[${res.status}]`);
  }

  const chat = await req("/api/teacher/chat", {
    method: "POST",
    body: JSON.stringify({ message: "I don't understand this", lessonAttemptId: attemptId }),
  });
  const reply = (await chat.text()).trim().replace(/\s+/g, " ");
  report(chat.status < 400 && reply.length > 0, "teacher chat", `${reply.slice(0, 80)}…`);

  const attempt = await prisma.lessonAttempt.findUnique({ where: { id: attemptId } });
  const progress = await prisma.studentLessonProgress.findFirst({
    where: { lessonId: lesson.id, studentId: attempt?.studentId },
  });

  console.log(
    `\nattempt:  status=${attempt?.status} mastery=${attempt?.masteryScore?.toFixed(2) ?? "-"} ` +
      `completed=${attempt?.completedAt ? "yes" : "no"}`,
  );
  console.log(
    `progress: status=${progress?.status} best=${progress?.bestScorePct ?? "-"}% ` +
      `mastery=${progress?.mastery?.toFixed(2) ?? "-"}`,
  );

  report(Boolean(attempt?.completedAt), "lesson recorded as completed");
  report(progress?.status === "COMPLETED" || progress?.status === "MASTERED", "progress updated");

  console.log(failures ? `\n${failures} failure(s)` : "\nthe whole lesson loop works");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (failures) process.exitCode = 1;
  });
