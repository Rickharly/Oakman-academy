/**
 * What is actually broken, checked from inside the running server.
 *
 * Every wrong fix in this project has the same cause: the machine the code is written on cannot
 * reach OpenAI, Oak or the deployed app, so a failure gets diagnosed by reasoning about it
 * instead of by looking. Reasoning has been wrong three times about the video alone, and each
 * wrong answer cost a child part of a school day.
 *
 * These checks run where the network works. They call the real services with the real
 * credentials and the real schemas, and they report the real error text — no interpretation, no
 * "should be". If a lesson will not generate, this says why in the provider's own words.
 */
import { prisma } from "@/lib/db";
import { getAiProvider, resolveModelId } from "@/lib/ai/provider";
import { explainerSchema } from "@/lib/lessons/explainer";
import { fetchProviderAsset, resolveAssetUrl } from "@/lib/curriculum/asset-fetch";
import { todayDateOnly } from "@/lib/dates";

export type CheckStatus = "ok" | "warn" | "fail" | "skip";

export interface Check {
  name: string;
  status: CheckStatus;
  /** One line a person can act on. */
  summary: string;
  /** The provider's own words, when there are any. Never paraphrased. */
  detail?: string;
}

function fail(name: string, summary: string, err: unknown): Check {
  const detail =
    err instanceof Error ? `${err.name}: ${err.message}` : typeof err === "string" ? err : JSON.stringify(err);
  return { name, status: "fail", summary, detail: detail.slice(0, 1200) };
}

/** What is deployed, so "I pushed a fix" and "the fix is running" stop being the same claim. */
function deployCheck(): Check {
  const commit = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA;
  return {
    name: "Deployed build",
    status: commit ? "ok" : "warn",
    summary: commit ? `Running commit ${commit.slice(0, 8)}` : "No commit recorded for this build.",
    detail: commit,
  };
}

/**
 * Can we generate a lesson at all?
 *
 * Uses the real schema, because the failure that stopped every lesson generating was a schema
 * the API rejects — it throws before anything is sent, so a check with a made-up schema would
 * have passed while every real call failed.
 */
async function explainerCheck(): Promise<Check> {
  const name = "Writing a lesson (OpenAI)";
  if (!process.env.OPENAI_API_KEY) {
    return { name, status: "fail", summary: "No OPENAI_API_KEY on the server." };
  }
  if ((process.env.AI_PROVIDER ?? "").toLowerCase() !== "openai") {
    return {
      name,
      status: "fail",
      summary: `AI_PROVIDER is "${process.env.AI_PROVIDER ?? "unset"}" — lessons are being faked, not written.`,
    };
  }

  try {
    const ai = getAiProvider();
    const { data, model } = await ai.structured({
      model: "strong",
      schemaName: "lesson_explainer",
      schema: explainerSchema,
      system:
        "Write a two-section lesson explaining what a half is, for a nine year old, anchored in one everyday thing. Keep it very short — this is a health check.",
      messages: [{ role: "user", content: "Lesson: Halves" }],
    });
    return {
      name,
      status: "ok",
      summary: `Wrote a lesson with ${model} (${data.sections.length} sections).`,
      detail: data.intro.slice(0, 200),
    };
  } catch (err) {
    return fail(name, `Lessons cannot be written. Model: ${resolveModelId("strong")}.`, err);
  }
}

/** How much of the provider's quota is left, and whether the key works at all. */
async function oakQuotaCheck(): Promise<Check> {
  const name = "Curriculum provider (Oak)";
  if (!process.env.OAK_API_KEY) {
    return { name, status: "fail", summary: "No OAK_API_KEY on the server." };
  }
  try {
    const res = await fetch("https://open-api.thenational.academy/api/v0/rate-limit", {
      headers: { Authorization: `Bearer ${process.env.OAK_API_KEY}` },
      cache: "no-store",
    });
    const body = await res.text();
    if (!res.ok) {
      return { name, status: "fail", summary: `Oak returned ${res.status}.`, detail: body.slice(0, 400) };
    }
    return { name, status: "ok", summary: "Oak is reachable and the key works.", detail: body.slice(0, 300) };
  } catch (err) {
    return fail(name, "Cannot reach Oak.", err);
  }
}

/**
 * Does a video actually come back as a video?
 *
 * Takes a real lesson's real video resource and follows it exactly as the player does, then
 * reports the content type and the first bytes. A player stuck at 0:00 and a lesson with no
 * video look identical from the outside; this tells them apart.
 */
async function videoCheck(): Promise<Check> {
  const name = "Playing a video";
  const resource = await prisma.lessonResource.findFirst({
    where: { type: "VIDEO", providerUrl: { not: null } },
    include: { lesson: { select: { title: true } } },
  });
  if (!resource?.providerUrl) {
    return {
      name,
      status: "warn",
      summary: "No lesson has a video resource yet — nothing to test. Import lessons first.",
    };
  }

  // The URL it is actually about to use, printed either way. "fetch failed" without the address
  // it failed to reach is a dead end, and that dead end cost most of a day.
  const target = resolveAssetUrl(resource.providerUrl);

  try {
    const res = await fetchProviderAsset(resource.providerUrl);
    const type = res.headers.get("content-type") ?? "(none)";
    const length = res.headers.get("content-length") ?? "(unknown)";

    // Read a little, then stop. We only need to know what kind of thing this is.
    const reader = res.body?.getReader();
    const first = await reader?.read();
    await reader?.cancel().catch(() => undefined);
    const head = first?.value ? Buffer.from(first.value.slice(0, 16)).toString("utf8") : "";
    const looksJson = head.trimStart().startsWith("{") || head.trimStart().startsWith("[");

    if (looksJson) {
      return {
        name,
        status: "fail",
        summary: "The provider returned JSON where the video should be — this is why players sit at 0:00.",
        detail: `${resource.lesson.title}: content-type ${type}, starts with ${JSON.stringify(head.slice(0, 60))}`,
      };
    }
    if (!type.startsWith("video/")) {
      return {
        name,
        status: "warn",
        summary: `The file came back as "${type}", not a video type. It may still play.`,
        detail: `${resource.lesson.title}: ${length} bytes`,
      };
    }
    return {
      name,
      status: "ok",
      summary: `Video streams correctly (${type}, ${length} bytes).`,
      detail: `${resource.lesson.title}\n${target}`,
    };
  } catch (err) {
    const check = fail(name, `Could not fetch the video for "${resource.lesson.title}".`, err);
    return { ...check, detail: `${check.detail}\n\nStored: ${resource.providerUrl}\nTried:  ${target}` };
  }
}

/** Whether the teacher can speak. Optional — silence is a smaller problem than no lesson. */
async function voiceCheck(): Promise<Check> {
  const name = "Teacher's voice (ElevenLabs)";
  if (!process.env.ELEVENLABS_API_KEY) {
    return { name, status: "skip", summary: "No ELEVENLABS_API_KEY — the teacher is silent, which is allowed." };
  }
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text();
      // A key without `voices_read` can still speak. Listing voices is how a parent picks one,
      // so this is worth fixing, but it does not stop the teacher talking.
      const permissionOnly = /voices_read|missing_permissions/i.test(body);
      return {
        name,
        status: permissionOnly ? "warn" : "fail",
        summary: permissionOnly
          ? "The key cannot list voices — add the \"voices_read\" permission to it in ElevenLabs. Speaking still works; only the voice picker is affected."
          : `ElevenLabs returned ${res.status}.`,
        detail: body.slice(0, 400),
      };
    }
    const data = (await res.json()) as { voices?: unknown[] };
    return { name, status: "ok", summary: `${data.voices?.length ?? 0} voices available.` };
  } catch (err) {
    return fail(name, "Cannot reach ElevenLabs.", err);
  }
}

/** What the children actually have to work with, right now. */
async function curriculumCheck(): Promise<Check> {
  const name = "Lessons ready to teach";
  const [total, withQuestions, withVideo] = await Promise.all([
    prisma.lesson.count(),
    prisma.lesson.count({ where: { questions: { some: {} } } }),
    prisma.lesson.count({ where: { resources: { some: { type: "VIDEO" } } } }),
  ]);
  if (total === 0) {
    return { name, status: "fail", summary: "No lessons imported at all." };
  }
  return {
    name,
    status: withQuestions === 0 ? "fail" : withQuestions < total / 2 ? "warn" : "ok",
    summary: `${withQuestions} of ${total} lessons have questions; ${withVideo} have a video.`,
  };
}

/**
 * Why a child's day is empty, in full.
 *
 * The planner produces nothing for a hundred quiet reasons — no schedule, no enrolment, a
 * programme with no lessons, every lesson already done, a subject id that does not match. From
 * the outside all of them look identical: a blank board. This prints every link in that chain
 * for every child, so the broken one is visible instead of guessed at.
 */
async function timetableCheck(): Promise<Check> {
  const name = "Why today looks like this";
  const students = await prisma.studentProfile.findMany({
    include: { user: { select: { displayName: true } } },
  });
  if (students.length === 0) return { name, status: "fail", summary: "No students." };

  const lines: string[] = [];
  let broken = 0;

  for (const student of students) {
    const [schedules, enrolments, today] = await Promise.all([
      prisma.studentSchedule.findMany({ where: { studentId: student.id, active: true }, include: { subject: true } }),
      prisma.studentEnrolment.findMany({
        where: { studentId: student.id, active: true },
        include: { programme: { include: { subject: true } } },
      }),
      prisma.dailyAssignment.findMany({
        where: { studentId: student.id, date: todayDateOnly(), status: { not: "MOVED" } },
        include: { subject: true },
      }),
    ]);

    lines.push(
      `${student.user.displayName} — Year ${student.yearGroup}, ${student.lessonsPerDay} periods/day`,
    );
    lines.push(
      `  today: ${today.filter((a) => a.kind === "LESSON").length} lesson(s), ` +
        `${today.filter((a) => a.kind === "REVIEW").length} review(s)`,
    );

    if (schedules.length === 0) {
      lines.push("  NO TIMETABLE — nothing tells the planner which subjects to teach.");
      broken += 1;
    }

    const programmeBySubjectId = new Map(enrolments.map((e) => [e.programme.subjectId, e.programme]));

    for (const schedule of schedules) {
      const programme = programmeBySubjectId.get(schedule.subjectId);
      if (!programme) {
        // The exact failure that hides a full curriculum: the timetable and the enrolment are
        // pointing at two different rows for the same-named subject.
        const nearby = enrolments.filter((e) => e.programme.subject.slug === schedule.subject.slug);
        lines.push(
          `  ${schedule.subject.title} (${schedule.subject.slug}/${schedule.subject.provider}): NOT ENROLLED` +
            (nearby.length > 0
              ? ` — but enrolled on ${nearby
                  .map((e) => `${e.programme.subject.provider}:y${e.programme.yearGroup}`)
                  .join(", ")}, which is a different subject row. The planner cannot see it.`
              : " — no programme at all."),
        );
        broken += 1;
        continue;
      }

      const lessons = await prisma.lesson.findMany({
        where: { unit: { programmeId: programme.id } },
        select: { id: true },
      });
      const done = lessons.length
        ? await prisma.studentLessonProgress.count({
            where: {
              studentId: student.id,
              lessonId: { in: lessons.map((l) => l.id) },
              status: { in: ["COMPLETED", "MASTERED"] },
            },
          })
        : 0;
      const left = lessons.length - done;
      if (left <= 0) broken += 1;
      lines.push(
        `  ${schedule.subject.title}: ${schedule.weeklyFrequency}/week · ` +
          `programme ${programme.provider}:y${programme.yearGroup} · ` +
          `${lessons.length} lesson(s), ${done} done, ${left} left${left <= 0 ? "  <-- NOTHING TO TEACH" : ""}`,
      );
    }
    lines.push("");
  }

  return {
    name,
    status: broken > 0 ? "fail" : "ok",
    summary:
      broken > 0
        ? `${broken} problem(s) stopping lessons being scheduled — see below.`
        : "Every subject on every timetable has lessons to give.",
    detail: lines.join("\n"),
  };
}

/** Runs every check. Never throws — a broken check is itself a finding. */
export async function runDiagnostics(): Promise<Check[]> {
  const checks = await Promise.all([
    Promise.resolve(deployCheck()),
    curriculumCheck().catch((err) => fail("Lessons ready to teach", "Check failed.", err)),
    timetableCheck().catch((err) => fail("Why today looks like this", "Check failed.", err)),
    explainerCheck().catch((err) => fail("Writing a lesson (OpenAI)", "Check failed.", err)),
    oakQuotaCheck().catch((err) => fail("Curriculum provider (Oak)", "Check failed.", err)),
    videoCheck().catch((err) => fail("Playing a video", "Check failed.", err)),
    voiceCheck().catch((err) => fail("Teacher's voice (ElevenLabs)", "Check failed.", err)),
  ]);
  return checks;
}
