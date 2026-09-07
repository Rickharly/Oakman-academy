/**
 * Walks the reading slot as a child against a running server: log in → Today → open the
 * reading slot → send a short response → check the teacher replied and the slot closed.
 *
 *   pnpm start                    # in one terminal (port 3100)
 *   pnpm tsx scripts/dev/walk-reading.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/db";

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
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return res;
}

function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ok " : "FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const login = await req("/api/auth/student-login", {
    method: "POST",
    body: JSON.stringify(STUDENT),
  });
  check("student logs in", login.ok || login.status === 303, `status ${login.status}`);

  const today = await req("/today");
  const html = await today.text();
  check("Today loads", today.ok, `status ${today.status}`);
  check("Today shows the reading slot", /Reading &amp; writing|Reading &#x26; writing/.test(html));

  const student = await prisma.studentProfile.findFirst({
    where: { user: { username: STUDENT.username } },
  });
  const assignment = await prisma.dailyAssignment.findFirst({
    where: { studentId: student!.id, kind: "READING" },
    orderBy: { date: "asc" },
  });
  check("a reading assignment exists", Boolean(assignment));

  const page = await req(`/reading?assignmentId=${assignment!.id}`);
  const readingHtml = await page.text();
  check("the reading page loads", page.ok, `status ${page.status}`);
  check("the passage is on screen", readingHtml.includes("Words to notice") || readingHtml.length > 4000);

  const text = await prisma.readingText.findFirst({
    where: { yearGroup: student!.yearGroup },
    orderBy: { order: "asc" },
  });

  const sent = await req("/api/reading/respond", {
    method: "POST",
    body: JSON.stringify({
      readingTextId: text!.id,
      promptIndex: 0,
      response: "I noticed the rain in every paragraph, and I think it is there to slow everything down.",
      assignmentId: assignment!.id,
    }),
  });
  const entry = (await sent.json()) as { id?: string; feedback?: string; score?: number | null; error?: string };
  check("the response is accepted", sent.ok, entry.error ?? "");
  check("the teacher replied", Boolean(entry.feedback), entry.feedback?.slice(0, 60) ?? "");
  check("a short response is not scored", entry.score === null);

  const after = await prisma.dailyAssignment.findUnique({ where: { id: assignment!.id } });
  check("the slot is marked complete", after?.status === "COMPLETED", after?.status ?? "");

  const stored = await prisma.readingEntry.findUnique({ where: { id: entry.id! } });
  check("the writing is stored verbatim", Boolean(stored?.response.startsWith("I noticed the rain")));
  check("a note is kept for the parent", Boolean(stored?.reasoning));

  const empty = await req("/api/reading/respond", {
    method: "POST",
    body: JSON.stringify({ readingTextId: text!.id, promptIndex: 0, response: "  " }),
  });
  check("an empty response is refused", empty.status === 400, `status ${empty.status}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
