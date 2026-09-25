import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import type { CurriculumProvider, ProviderAssets } from "@/lib/curriculum/provider";
import { ensureLessonAssets, resetLessonAssetRetryThrottle } from "@/lib/curriculum/sync";
import { resetDb } from "./helpers/db";

/**
 * `ensureLessonAssets` fetches one lesson's video/worksheet on demand when a child opens it —
 * see the doc comment in `src/lib/curriculum/sync.ts`. These tests cover the behaviour that
 * used to leave a lesson with no video forever: a lesson whose asset call once succeeded but
 * found nothing was stamped `assetsSyncedAt` and never looked at again, indistinguishable from
 * a lesson Oak genuinely has no video for.
 */

/** A `CurriculumProvider` whose only implemented method is `getAssets`; everything else would
 * mean this test is exercising more than `ensureLessonAssets` actually touches. */
function fakeProvider(getAssets: CurriculumProvider["getAssets"]): CurriculumProvider {
  const notImplemented = () => {
    throw new Error("not implemented in this fake");
  };
  return {
    name: "oak",
    getSubjects: notImplemented,
    getProgrammes: notImplemented,
    getUnits: notImplemented,
    getUnit: notImplemented,
    getLesson: notImplemented,
    getQuiz: notImplemented,
    getTranscript: notImplemented,
    getAssets,
    getLicences: notImplemented,
  };
}

const videoAssets: ProviderAssets = {
  assets: [{ type: "video", label: "Video", url: "https://open-api.thenational.academy/v0/lessons/x/assets/video" }],
  attribution: [],
};

async function makeLesson(overrides: {
  provider?: string;
  assetsSyncedAt?: Date | null;
  withVideo?: boolean;
} = {}) {
  const subject = await prisma.subject.create({ data: { provider: "test", slug: `s${Math.random()}`, title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { provider: "test", providerSlug: `p${Math.random()}`, subjectId: subject.id, yearGroup: 5, keyStage: "ks2", title: "Maths" },
  });
  const unit = await prisma.unit.create({
    data: { provider: "test", providerSlug: `u${Math.random()}`, programmeId: programme.id, title: "Unit", order: 1 },
  });
  const lesson = await prisma.lesson.create({
    data: {
      provider: overrides.provider ?? "oak",
      providerSlug: `l${Math.random()}`,
      unitId: unit.id,
      title: "Halving",
      order: 1,
      syncedAt: new Date(),
      assetsSyncedAt: overrides.assetsSyncedAt ?? null,
    },
  });
  if (overrides.withVideo) {
    await prisma.lessonResource.create({
      data: {
        lessonId: lesson.id,
        type: "VIDEO",
        label: "Video",
        providerUrl: "https://open-api.thenational.academy/v0/lessons/x/assets/video",
      },
    });
  }
  return lesson;
}

describe("ensureLessonAssets", () => {
  beforeEach(async () => {
    await resetDb();
    resetLessonAssetRetryThrottle();
  });

  it("fetches assets for a lesson that has never been synced", async () => {
    const lesson = await makeLesson();
    const getAssets = vi.fn(async () => videoAssets);

    const result = await ensureLessonAssets(lesson.id, { provider: fakeProvider(getAssets) });

    expect(result).toEqual({ outcome: "fetched", written: 1 });
    expect(getAssets).toHaveBeenCalledTimes(1);
    const video = await prisma.lessonResource.findFirst({ where: { lessonId: lesson.id, type: "VIDEO" } });
    expect(video).not.toBeNull();
    const updated = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(updated.assetsSyncedAt).not.toBeNull();
  });

  it("retries a lesson that has assetsSyncedAt set but still has no VIDEO resource row", async () => {
    const lesson = await makeLesson({ assetsSyncedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) });
    const getAssets = vi.fn(async () => videoAssets);

    const result = await ensureLessonAssets(lesson.id, { provider: fakeProvider(getAssets) });

    expect(result).toEqual({ outcome: "fetched", written: 1 });
    expect(getAssets).toHaveBeenCalledTimes(1);
    const video = await prisma.lessonResource.findFirst({ where: { lessonId: lesson.id, type: "VIDEO" } });
    expect(video).not.toBeNull();
  });

  it("does not retry a lesson whose assets were already fetched within the cooldown window", async () => {
    const lesson = await makeLesson({ assetsSyncedAt: new Date() });
    const getAssets = vi.fn(async () => videoAssets);
    const provider = fakeProvider(getAssets);

    const first = await ensureLessonAssets(lesson.id, { provider });
    expect(first.outcome).toBe("fetched");
    expect(getAssets).toHaveBeenCalledTimes(1);

    // The video the first call wrote is real, so a normal second open would take the fast
    // `already_has_video` path — delete it to prove the *throttle* itself is doing the work,
    // not the presence of the video.
    await prisma.lessonResource.deleteMany({ where: { lessonId: lesson.id, type: "VIDEO" } });

    const second = await ensureLessonAssets(lesson.id, { provider });
    expect(second).toEqual({ outcome: "throttled", written: 0 });
    expect(getAssets).toHaveBeenCalledTimes(1); // not called again
  });

  it("does not retry a fixture-provider lesson, however long ago its assets were synced", async () => {
    const lesson = await makeLesson({ provider: "fixture", assetsSyncedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });
    const getAssets = vi.fn(async () => videoAssets);

    const result = await ensureLessonAssets(lesson.id, { provider: fakeProvider(getAssets) });

    expect(result).toEqual({ outcome: "fixture", written: 0 });
    expect(getAssets).not.toHaveBeenCalled();
    const video = await prisma.lessonResource.findFirst({ where: { lessonId: lesson.id, type: "VIDEO" } });
    expect(video).toBeNull();
  });

  it("does nothing for a lesson that already has a video", async () => {
    const lesson = await makeLesson({ assetsSyncedAt: new Date(), withVideo: true });
    const getAssets = vi.fn(async () => videoAssets);

    const result = await ensureLessonAssets(lesson.id, { provider: fakeProvider(getAssets) });

    expect(result).toEqual({ outcome: "already_has_video", written: 0 });
    expect(getAssets).not.toHaveBeenCalled();
  });

  it("reports 'failed' and leaves assetsSyncedAt null when the provider call itself fails", async () => {
    const lesson = await makeLesson();
    const getAssets = vi.fn(async () => {
      throw new Error("Oak is down");
    });

    const result = await ensureLessonAssets(lesson.id, { provider: fakeProvider(getAssets) });

    expect(result).toEqual({ outcome: "failed", written: 0 });
    const updated = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(updated.assetsSyncedAt).toBeNull();
  });

  it("reports 'failed' for a lesson id that does not exist", async () => {
    const getAssets = vi.fn(async () => videoAssets);
    const result = await ensureLessonAssets("does-not-exist", { provider: fakeProvider(getAssets) });
    expect(result).toEqual({ outcome: "failed", written: 0 });
    expect(getAssets).not.toHaveBeenCalled();
  });
});
