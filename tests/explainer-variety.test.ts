import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { getAiProvider } from "@/lib/ai/provider";
import { getOrCreateExplainer } from "@/lib/lessons/explainer";

/**
 * "The maths lesson is still the same" — with a different title on it. Every lesson was taught
 * with the same everyday example. A new one is told what the lessons around it already used.
 */
describe("each lesson is explained with a different everyday example", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("tells the writer which examples the neighbouring lessons already used", async () => {
    const subject = await prisma.subject.create({ data: { provider: "oak", slug: "maths", title: "Maths" } });
    const programme = await prisma.programme.create({
      data: { provider: "oak", providerSlug: "maths:4", subjectId: subject.id, yearGroup: 4, keyStage: "ks2", title: "Maths" },
    });
    const unit = await prisma.unit.create({
      data: { provider: "oak", providerSlug: "u1", programmeId: programme.id, title: "Fractions", order: 1 },
    });
    const make = (slug: string, order: number) =>
      prisma.lesson.create({
        data: {
          provider: "oak",
          providerSlug: slug,
          unitId: unit.id,
          title: `Fractions ${slug}`,
          order,
          keyLearningPoints: [`Idea for lesson ${slug}`],
        },
      });
    const first = await make("one", 1);
    const second = await make("two", 2);

    const written = await getOrCreateExplainer(first.id);
    expect(written?.everydayAnchor).toBeTruthy();

    const spy = vi.spyOn(getAiProvider(), "structured");
    await getOrCreateExplainer(second.id);
    const system = String(spy.mock.calls.at(-1)?.[0]?.system ?? "");
    expect(system).toContain("ALREADY USED");
    expect(system).toContain(written!.everydayAnchor);
    spy.mockRestore();
  });
});
