import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: "postgresql://postgres@localhost:5432/family_school" }) });
const BASE = "http://localhost:3100";
let cookie = "";
async function req(path, opts = {}) {
  const res = await fetch(BASE + path, { ...opts, redirect: "manual",
    headers: { "content-type": "application/json", ...(opts.headers||{}), ...(cookie?{cookie}:{}) } });
  for (const c of res.headers.getSetCookie?.() ?? []) if (c.startsWith("fs_session=")) cookie = c.split(";")[0];
  return res;
}
const j = async r => r.json().catch(()=>({}));

/** Builds the response a child would give if they answered correctly. */
function correctResponse(q) {
  const k = q.answerKey ?? {};
  switch (q.type) {
    case "MULTIPLE_CHOICE": return { optionId: k.correctOptionId };
    case "MULTI_SELECT":    return { optionIds: k.correctOptionIds };
    case "TRUE_FALSE":      return { value: k.value };
    case "NUMERIC":         return { text: String(k.acceptedStrings?.[0] ?? k.value) };
    case "SHORT_ANSWER":    return { text: k.accepted?.[0] ?? "" };
    case "EXTENDED_TEXT":   return { text: k.modelAnswer ?? "A full answer explaining the idea." };
    case "MATCHING":        return { pairs: k.pairs };
    case "ORDERING":        return { order: k.order };
    default: return { text: "" };
  }
}

async function main() {
  await req("/api/auth/student-login", { method:"POST", body: JSON.stringify({username:"eva",pin:"1234"}) });
  const lesson = await prisma.lesson.findFirst({ where: { questions: { some: {} } }, orderBy: { providerSlug: "asc" } });
  const { attemptId } = await j(await req(`/api/lessons/${lesson.id}/attempts`, { method:"POST" }));
  console.log(`lesson: ${lesson.title}`);

  let allGood = true;
  for (const stage of ["STARTER","PRACTICE","CHECK"]) {
    const qs = await prisma.question.findMany({ where: { lessonId: lesson.id, stage }, orderBy: { order: "asc" } });
    for (const q of qs) {
      await req(`/api/attempts/${attemptId}/answers`, { method:"POST",
        body: JSON.stringify({ questionId: q.id, response: correctResponse(q) }) });
    }
    const body = await j(await req(`/api/attempts/${attemptId}/submit`, { method:"POST", body: JSON.stringify({ stage }) }));
    const a = body.activity ?? {};
    const pct = a.percentage ?? 0;
    const types = qs.map(q=>q.type).join(", ");
    // Open-ended questions are AI-marked against a model answer; a generic response is
    // *supposed* to lose marks, so only the deterministic types are asserted here.
    const deterministic = qs.filter((q) => q.type !== "EXTENDED_TEXT");
    const good = deterministic.length === 0 || (body.results ?? [])
      .filter((r: any) => deterministic.some((q) => q.id === r.questionId))
      .every((r: any) => r.isCorrect);
    if (!good) allGood = false;
    console.log(`${good?"PASS":"FAIL"}  ${stage}: ${a.score}/${a.maxScore} (${Math.round(pct)}%)  [${types}]`);
    if (!good) for (const r of body.results ?? []) if (!r.isCorrect)
      console.log(`        missed ${r.question?.type}: ${JSON.stringify(r.response)} -> ${JSON.stringify(r.question?.answerKey)}`);
    if (stage === "STARTER") await req(`/api/attempts/${attemptId}/stage`, { method:"POST", body: JSON.stringify({ stage:"LEARN", action:"complete" }) });
  }
  await req(`/api/attempts/${attemptId}/stage`, { method:"POST", body: JSON.stringify({ stage:"FEEDBACK", action:"complete" }) });
  await req(`/api/attempts/${attemptId}/stage`, { method:"POST", body: JSON.stringify({ stage:"COMPLETE", action:"complete" }) });

  const final = await prisma.lessonAttempt.findUnique({ where: { id: attemptId } });
  const prog = await prisma.studentLessonProgress.findFirst({ where: { lessonId: lesson.id } });
  console.log(`\nattempt: status=${final.status} mastery=${final.masteryScore} completedAt=${final.completedAt ? "set" : "MISSING"}`);
  console.log(`progress: status=${prog?.status} best=${prog?.bestScorePct}% mastery=${prog?.mastery}`);
  if (final.status !== "MASTERED" && final.status !== "COMPLETED") allGood = false;
  console.log(allGood ? "\nevery deterministic question scored full marks; the lesson completed and progress updated" : "\nSCORING PROBLEM");
  await prisma.$disconnect();
  process.exitCode = allGood ? 0 : 1;

}

main();
