import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { repairPresolvedQuestions } from "@/lib/curriculum/sync";
import { seededShuffle } from "@/lib/questions/oak-mapper";
import { gradeQuestion, type GradingContext } from "@/lib/grading/grade";

/**
 * `repairPresolvedQuestions()` fixes ORDERING/MATCHING `Question` rows imported before the
 * mapper started shuffling their displayed order (see oak-mapper.ts git diff): Oak lists an
 * ORDERING question's steps already in the right sequence and a MATCHING question's right
 * column already lined up beside its left partner, so a lesson imported before the fix would
 * already be right without a child touching it.
 */

async function buildLesson() {
  const subject = await prisma.subject.create({ data: { provider: "test", slug: "maths", title: "Maths" } });
  const programme = await prisma.programme.create({
    data: {
      provider: "test",
      providerSlug: "maths:7",
      subjectId: subject.id,
      yearGroup: 7,
      keyStage: "ks3",
      title: "Maths",
    },
  });
  const unit = await prisma.unit.create({
    data: { provider: "test", providerSlug: "u1", programmeId: programme.id, title: "Unit", order: 1 },
  });
  return prisma.lesson.create({
    data: { provider: "test", providerSlug: "l1", unitId: unit.id, title: "Lesson", order: 1 },
  });
}

const gradingCtx: GradingContext = {
  studentYearGroup: 7,
  lesson: { title: "Lesson", keyLearningPoints: [], misconceptions: [] },
};

/** Seeds one of each row shape the repair has to tell apart. Returns their ids. */
async function seedFixtures() {
  const lesson = await buildLesson();

  // Pre-solved ORDERING: items already sit in the correct sequence.
  const orderingItems = [
    { id: "a", text: "First" },
    { id: "b", text: "Second" },
    { id: "c", text: "Third" },
  ];
  const orderingAnswer = ["a", "b", "c"];
  const ordering = await prisma.question.create({
    data: {
      lessonId: lesson.id,
      source: "OAK_STARTER_QUIZ",
      providerRef: "ord1",
      stage: "STARTER",
      order: 1,
      type: "ORDERING",
      prompt: "Put these in order",
      options: { items: orderingItems },
      answerKey: { order: orderingAnswer },
      maxScore: 1,
      gradingMode: "DETERMINISTIC",
    },
  });

  // Old-scheme MATCHING: right column row-aligned with left (right[i].id === left[i].id).
  const matchingLeft = [
    { id: "a", text: "Cat" },
    { id: "b", text: "Dog" },
  ];
  const matchingRightOld = [
    { id: "a", text: "Meow" },
    { id: "b", text: "Woof" },
  ];
  const matchingPairsOld = [
    { leftId: "a", rightId: "a" },
    { leftId: "b", rightId: "b" },
  ];
  const matching = await prisma.question.create({
    data: {
      lessonId: lesson.id,
      source: "OAK_EXIT_QUIZ",
      providerRef: "match1",
      stage: "CHECK",
      order: 1,
      type: "MATCHING",
      prompt: "Match the animal to its sound",
      options: { left: matchingLeft, right: matchingRightOld },
      answerKey: { pairs: matchingPairsOld },
      maxScore: 1,
      gradingMode: "DETERMINISTIC",
    },
  });

  // Already-repaired MATCHING: right column already on the r… scheme and shuffled.
  const repairedLeft = [
    { id: "a", text: "Red" },
    { id: "b", text: "Blue" },
  ];
  const repairedRight = [
    { id: "rb", text: "Bleu" },
    { id: "ra", text: "Rouge" },
  ];
  const repairedPairs = [
    { leftId: "a", rightId: "ra" },
    { leftId: "b", rightId: "rb" },
  ];
  const alreadyRepaired = await prisma.question.create({
    data: {
      lessonId: lesson.id,
      source: "OAK_EXIT_QUIZ",
      providerRef: "match2",
      stage: "CHECK",
      order: 2,
      type: "MATCHING",
      prompt: "Match the colour to its French word",
      options: { left: repairedLeft, right: repairedRight },
      answerKey: { pairs: repairedPairs },
      maxScore: 1,
      gradingMode: "DETERMINISTIC",
    },
  });

  // AI_GENERATED ORDERING that looks just as pre-solved — must never be touched here.
  const aiItems = [
    { id: "a", text: "Step one" },
    { id: "b", text: "Step two" },
  ];
  const aiOrder = ["a", "b"];
  const aiGenerated = await prisma.question.create({
    data: {
      lessonId: lesson.id,
      source: "AI_GENERATED",
      providerRef: "ai-ord1",
      stage: "PRACTICE",
      order: 1,
      type: "ORDERING",
      prompt: "Put these in order",
      options: { items: aiItems },
      answerKey: { order: aiOrder },
      maxScore: 1,
      gradingMode: "DETERMINISTIC",
    },
  });

  return {
    ordering: { id: ordering.id, items: orderingItems, order: orderingAnswer },
    matching: { id: matching.id, left: matchingLeft, rightOld: matchingRightOld, pairsOld: matchingPairsOld },
    alreadyRepaired: { id: alreadyRepaired.id, options: { left: repairedLeft, right: repairedRight }, answerKey: { pairs: repairedPairs } },
    aiGenerated: { id: aiGenerated.id, options: { items: aiItems }, answerKey: { order: aiOrder } },
  };
}

describe("repairPresolvedQuestions", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("repairs pre-solved rows, leaves already-fixed and AI_GENERATED rows alone, and is idempotent", async () => {
    const fixtures = await seedFixtures();

    const stats1 = await repairPresolvedQuestions();
    expect(stats1).toEqual({ ordering: 1, matching: 1 });

    // ORDERING: items shuffled with seededShuffle(items, providerRef); answerKey untouched.
    const orderingRow = await prisma.question.findUniqueOrThrow({ where: { id: fixtures.ordering.id } });
    const expectedOrderingItems = seededShuffle(fixtures.ordering.items, "ord1");
    expect(orderingRow.options).toEqual({ items: expectedOrderingItems });
    expect(orderingRow.answerKey).toEqual({ order: fixtures.ordering.order });
    // The whole point of the shuffle: the display order must actually change.
    expect(expectedOrderingItems.map((i) => i.id)).not.toEqual(fixtures.ordering.items.map((i) => i.id));

    // MATCHING: right re-id'd to r+letter, shuffled, and answerKey.pairs rewritten to match.
    const matchingRow = await prisma.question.findUniqueOrThrow({ where: { id: fixtures.matching.id } });
    const reIdRight = fixtures.matching.rightOld.map((r) => ({ ...r, id: `r${r.id}` }));
    const expectedRight = seededShuffle(reIdRight, "match1");
    expect(matchingRow.options).toEqual({ left: fixtures.matching.left, right: expectedRight });
    expect(matchingRow.answerKey).toEqual({
      pairs: [
        { leftId: "a", rightId: "ra" },
        { leftId: "b", rightId: "rb" },
      ],
    });

    // Already-repaired row: byte-for-byte unchanged.
    const repairedRow = await prisma.question.findUniqueOrThrow({ where: { id: fixtures.alreadyRepaired.id } });
    expect(repairedRow.options).toEqual(fixtures.alreadyRepaired.options);
    expect(repairedRow.answerKey).toEqual(fixtures.alreadyRepaired.answerKey);

    // AI_GENERATED row: never touched, even though it looks just as pre-solved.
    const aiRow = await prisma.question.findUniqueOrThrow({ where: { id: fixtures.aiGenerated.id } });
    expect(aiRow.options).toEqual(fixtures.aiGenerated.options);
    expect(aiRow.answerKey).toEqual(fixtures.aiGenerated.answerKey);

    // Second run: nothing left to fix, nothing changes.
    const stats2 = await repairPresolvedQuestions();
    expect(stats2).toEqual({ ordering: 0, matching: 0 });

    const orderingAgain = await prisma.question.findUniqueOrThrow({ where: { id: fixtures.ordering.id } });
    const matchingAgain = await prisma.question.findUniqueOrThrow({ where: { id: fixtures.matching.id } });
    const repairedAgain = await prisma.question.findUniqueOrThrow({ where: { id: fixtures.alreadyRepaired.id } });
    const aiAgain = await prisma.question.findUniqueOrThrow({ where: { id: fixtures.aiGenerated.id } });
    expect(orderingAgain.options).toEqual(orderingRow.options);
    expect(orderingAgain.answerKey).toEqual(orderingRow.answerKey);
    expect(matchingAgain.options).toEqual(matchingRow.options);
    expect(matchingAgain.answerKey).toEqual(matchingRow.answerKey);
    expect(repairedAgain.options).toEqual(repairedRow.options);
    expect(aiAgain.options).toEqual(aiRow.options);

    // Row count never changes.
    const total = await prisma.question.count();
    expect(total).toBe(4);
  });

  it("still grades a genuinely correct ORDERING answer as correct, and the old pre-solved default as wrong", async () => {
    const fixtures = await seedFixtures();
    await repairPresolvedQuestions();
    const row = await prisma.question.findUniqueOrThrow({ where: { id: fixtures.ordering.id } });

    const correct = await gradeQuestion(row, { order: fixtures.ordering.order }, gradingCtx);
    expect(correct.correct).toBe(true);
    expect(correct.score).toBe(1);

    // The default a passive child gets by never touching anything is now the *shuffled*
    // display order — which the repair guarantees differs from the real answer.
    const displayOrder = (row.options as { items: { id: string }[] }).items.map((i) => i.id);
    expect(displayOrder).not.toEqual(fixtures.ordering.order);
    const untouched = await gradeQuestion(row, { order: displayOrder }, gradingCtx);
    expect(untouched.correct).toBe(false);
  });

  it("still grades a genuinely correct MATCHING answer as correct, and the old pre-solved pairing as wrong", async () => {
    const fixtures = await seedFixtures();
    await repairPresolvedQuestions();
    const row = await prisma.question.findUniqueOrThrow({ where: { id: fixtures.matching.id } });
    const key = row.answerKey as { pairs: { leftId: string; rightId: string }[] };

    const correct = await gradeQuestion(row, { pairs: key.pairs }, gradingCtx);
    expect(correct.correct).toBe(true);
    expect(correct.score).toBe(1);

    // A stale draft (or the old pre-repair "solved" pairing, leftId === rightId) must grade as
    // wrong rather than throw — grading it at all is the assertion that it doesn't throw.
    const stale = await gradeQuestion(row, { pairs: fixtures.matching.pairsOld }, gradingCtx);
    expect(stale.correct).toBe(false);
  });
});
