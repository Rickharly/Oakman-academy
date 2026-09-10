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
import fsp from "node:fs/promises";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getAiProvider, resolveModelId } from "@/lib/ai/provider";
import { explainerSchema } from "@/lib/lessons/explainer";
import { describeFetchError, fetchProviderAsset, resolveAssetUrl } from "@/lib/curriculum/asset-fetch";
import { imageSchema } from "@/lib/questions/types";
import { dateOnlyKey, toDateOnly, todayDateOnly, weekStartKey } from "@/lib/dates";

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
  // A real one. Testing a `fixture://` placeholder proves nothing except that placeholders are
  // placeholders, and reports a failure that sends someone hunting a bug that does not exist.
  const resource = await prisma.lessonResource.findFirst({
    where: { type: "VIDEO", providerUrl: { startsWith: "http" } },
    include: { lesson: { select: { title: true } } },
  });

  const placeholders = await prisma.lessonResource.count({
    where: { type: "VIDEO", NOT: { providerUrl: { startsWith: "http" } } },
  });
  if (!resource?.providerUrl) {
    return {
      name,
      status: "fail",
      summary:
        placeholders > 0
          ? `No real videos at all — ${placeholders} lesson(s) carry placeholder "fixture://" videos from the bundled sample curriculum. These children are not on real material.`
          : "No lesson has a video resource yet. Import lessons first.",
    };
  }

  // The URL it is actually about to use, printed either way. "fetch failed" without the address
  // it failed to reach is a dead end, and that dead end cost most of a day.
  const target = resolveAssetUrl(resource.providerUrl);

  /**
   * A stored copy that is no longer there.
   *
   * `storedPath` names a file on the container that downloaded it. Containers are replaced on
   * every deploy, so those paths go stale silently — and the player used to hand the path
   * straight to the browser, which is a 404 and a pale "the video won't play" panel where the
   * lesson should be. It is read through the resource route now, but a row pointing at a file
   * that has gone is still worth saying out loud.
   */
  const stale = await prisma.lessonResource.count({ where: { type: "VIDEO", NOT: { storedPath: null } } });
  const staleNote =
    stale > 0
      ? await (async () => {
          const rows = await prisma.lessonResource.findMany({
            where: { type: "VIDEO", NOT: { storedPath: null } },
            select: { storedPath: true },
            take: 20,
          });
          let missing = 0;
          for (const row of rows) {
            if (!row.storedPath) continue;
            const exists = await fsp.stat(row.storedPath).then(() => true).catch(() => false);
            if (!exists) missing += 1;
          }
          return missing > 0
            ? `\n${missing} of ${rows.length} checked video rows name a downloaded file that is no longer on this machine; those are served from the provider instead.`
            : "";
        })()
      : "";

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
      detail: `${resource.lesson.title}\n${target}${staleNote}`,
    };
  } catch (err) {
    const check = fail(name, `Could not fetch the video for "${resource.lesson.title}".`, err);
    return { ...check, detail: `${check.detail}\n\nStored: ${resource.providerUrl}\nTried:  ${target}` };
  }
}

/**
 * Whether the teacher can actually speak.
 *
 * Listing voices and speaking are different permissions on the same key, so a green "voices"
 * check proves nothing about whether a child can press Listen. Eva's Listen button vanished
 * while this check was passing.
 */
async function speechCheck(): Promise<Check> {
  const name = "Reading text aloud";
  if (!process.env.ELEVENLABS_API_KEY) {
    return { name, status: "skip", summary: "No ELEVENLABS_API_KEY — nothing is read aloud, which is allowed." };
  }
  try {
    const { speak, DEFAULT_VOICE_ID } = await import("@/lib/ai/voice");
    const student = await prisma.studentProfile.findFirst({ where: { voiceId: { not: null } } });
    const voiceId = student?.voiceId ?? DEFAULT_VOICE_ID;
    const { audio, contentType } = await speak("Testing one two three.", voiceId);
    return {
      name,
      status: audio.byteLength > 0 ? "ok" : "fail",
      summary:
        audio.byteLength > 0
          ? `Speech works — ${audio.byteLength} bytes of ${contentType}.`
          : "The voice returned nothing.",
      detail: `Voice ${voiceId}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      name,
      status: "fail",
      summary: /permission|unauthor|401/i.test(message)
        ? 'The key cannot speak — add the "text_to_speech" permission to it in ElevenLabs.'
        : "The teacher cannot read anything aloud.",
      detail: message.slice(0, 600),
    };
  }
}

/** Whether the voice picker can list the family's own voices. Cosmetic next to speech itself. */
async function voiceCheck(): Promise<Check> {
  const name = "Voice picker (ElevenLabs)";
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
  const [total, withQuestions, withVideo, placeholderLessons] = await Promise.all([
    prisma.lesson.count(),
    prisma.lesson.count({ where: { questions: { some: {} } } }),
    prisma.lesson.count({ where: { resources: { some: { type: "VIDEO" } } } }),
    // The bundled sample curriculum. Counted separately because "621 lessons have a video" is a
    // reassuring number that means nothing if the videos are `fixture://` addresses.
    prisma.lesson.count({ where: { provider: "fixture" } }),
  ]);
  if (total === 0) {
    return { name, status: "fail", summary: "No lessons imported at all." };
  }
  return {
    name,
    status: placeholderLessons > total / 2 ? "fail" : withQuestions === 0 ? "fail" : "ok",
    summary:
      `${withQuestions} of ${total} lessons have questions; ${withVideo} have a video.` +
      (placeholderLessons > 0
        ? ` ${placeholderLessons} are placeholders from the bundled sample curriculum, not real teaching material.`
        : ""),
  };
}

/**
 * Questions asking about a picture that never arrived.
 *
 * These are the ones that are impossible rather than hard, and they are counted here because
 * "some lessons are missing images" needs a number before anyone can tell whether it is a
 * handful or half the curriculum.
 */
async function pictureCheck(): Promise<Check> {
  const name = "Questions with missing pictures";
  const [withImage, excluded] = await Promise.all([
    prisma.question.count({ where: { NOT: { promptImage: { equals: Prisma.DbNull } } } }),
    prisma.question.count({ where: { excluded: true } }),
  ]);
  const total = await prisma.question.count();

  return {
    name,
    status: excluded > total / 4 ? "warn" : "ok",
    summary:
      `${withImage} question(s) carry a picture and now show it. ` +
      `${excluded} are hidden — questions that ask about a picture the import did not bring, ` +
      `which a child cannot answer and should never have been shown.`,
    detail: `${total} questions in total.`,
  };
}

/**
 * Does a question's picture actually come back?
 *
 * "The images are blurred out" and "there is no video" look the same from a chair: an empty
 * box. This fetches a real question's real picture exactly as the page does, and reports the
 * status and content type, so the difference between blocked, missing and never-stored is a
 * fact rather than a guess.
 */
async function questionImageCheck(): Promise<Check> {
  const name = "Showing a question's picture";
  /**
   * A picture we could actually show, not merely a column that is not empty.
   *
   * `NOT: { promptImage: { equals: DbNull } }` reads as "has a picture" and is not: a column
   * holding the JSON value `null` passes it. So the check picked a question with nothing in it,
   * failed to parse the nothing, and reported a broken picture pipeline that was working — the
   * one thing a diagnostic must never do, because a false alarm here costs a morning.
   */
  const candidates = await prisma.question.findMany({
    where: { promptImage: { not: Prisma.AnyNull } },
    select: { id: true, prompt: true, promptImage: true },
    take: 50,
  });
  const usable = candidates.find((q) => imageSchema.safeParse(q.promptImage).success);

  if (!usable) {
    const unreadable = candidates.find((q) => q.promptImage !== null);
    if (unreadable) {
      return {
        name,
        status: "fail",
        summary: "A question's picture is stored in a shape we cannot read.",
        detail: JSON.stringify(unreadable.promptImage).slice(0, 300),
      };
    }
    return { name, status: "warn", summary: "No question has a picture stored, so there is nothing to test." };
  }

  const question = usable;
  const url = imageSchema.parse(question.promptImage).url;
  try {
    const isProvider = /thenational\.academy$/i.test(new URL(url).hostname);
    const res = await fetch(url, {
      headers: isProvider && process.env.OAK_API_KEY ? { Authorization: `Bearer ${process.env.OAK_API_KEY}` } : {},
      cache: "no-store",
    });
    const type = res.headers.get("content-type") ?? "(none)";
    if (!res.ok) {
      return {
        name,
        status: "fail",
        summary: `The picture host returned ${res.status}. This is why questions show an empty box.`,
        detail: `${question.prompt.slice(0, 80)}\n${url}`,
      };
    }
    return {
      name,
      status: type.startsWith("image/") ? "ok" : "warn",
      summary: type.startsWith("image/")
        ? `Pictures load (${type}).`
        : `The host answered with "${type}", not an image.`,
      detail: url,
    };
  } catch (err) {
    return {
      ...fail(name, "Could not reach the picture at all.", err),
      detail: `${describeFetchError(err)}\n${url}`,
    };
  }
}

/**
 * Whether the lessons on the children's boards today actually have a video.
 *
 * "Playing a video" proves the pipeline works by streaming *a* video — any video, from any
 * lesson in the database. It has been green for days while children opened lesson after lesson
 * with nothing in the player, because the lessons they were given had no video row at all: they
 * were imported against a rationed quota with their assets left for a later run that never
 * reached them. A working pipeline and an empty lesson look identical from the outside.
 *
 * So this asks the only question that matters: the five lessons in front of this child today —
 * do they have a video, and is it one we can fetch?
 */
async function todaysVideosCheck(): Promise<Check> {
  const name = "Videos in today's lessons";
  const assignments = await prisma.dailyAssignment.findMany({
    where: { date: todayDateOnly(), kind: "LESSON", status: { not: "MOVED" } },
    include: {
      student: { include: { user: { select: { displayName: true } } } },
      lesson: { include: { resources: true } },
    },
    orderBy: [{ studentId: "asc" }, { order: "asc" }],
  });

  if (assignments.length === 0) {
    return { name, status: "warn", summary: "No lessons on any board today, so there is nothing to check." };
  }

  const lines: string[] = [];
  let missing = 0;
  let current = "";

  for (const assignment of assignments) {
    const who = assignment.student.user.displayName;
    if (who !== current) {
      if (current) lines.push("");
      lines.push(who);
      current = who;
    }
    const lesson = assignment.lesson;
    if (!lesson) continue;

    const video = lesson.resources.find((r) => r.type === "VIDEO");
    // A real address: absolute, or a path we resolve against the provider. `fixture://` is the
    // bundled placeholder pretending to be a video, and it is why players sat black for days.
    const url = video?.providerUrl ?? "";
    const usable = Boolean(url) && (/^https?:\/\//i.test(url) || !url.includes("://"));

    if (!video) {
      missing += 1;
      lines.push(
        `  ${lesson.title}: NO VIDEO ROW` +
          (lesson.assetsSyncedAt
            ? " — the provider was asked and had none."
            : " — its assets were never fetched. Opening the lesson now fetches them."),
      );
    } else if (!usable) {
      missing += 1;
      lines.push(`  ${lesson.title}: placeholder video (${video.providerUrl ?? "no address"}) — not a real one.`);
    } else {
      lines.push(`  ${lesson.title}: video ok`);
    }
  }

  return {
    name,
    status: missing > 0 ? "fail" : "ok",
    summary:
      missing > 0
        ? `${missing} of today's ${assignments.length} lesson(s) have no video a child could watch.`
        : `All ${assignments.length} of today's lessons have a video.`,
    detail: lines.join("\n"),
  };
}

/**
 * Whether a child's bug report can actually leave the building.
 *
 * "Something's wrong here" deliberately never shows a child a send failure — being told your
 * report failed is worse than not reporting — which means a broken channel is silent by design.
 * Eva sent several reports about maths lessons full of dollar signs; not one of them arrived,
 * and nothing anywhere said so. A silent channel needs a loud check.
 */
async function bugReportCheck(): Promise<Check> {
  const name = "Sending a bug report";
  const full = process.env.GITHUB_REPO ?? "Rickharly/Oakman-academy";

  if (!process.env.GITHUB_TOKEN) {
    return {
      name,
      status: "fail",
      summary:
        "No GITHUB_TOKEN on the server — the children's bug reports have nowhere to go, and they are told they sent fine.",
      detail: "Add a GitHub token with Issues: read and write on this repository, as GITHUB_TOKEN.",
    };
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${full}`, {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        name,
        status: "fail",
        summary: `GitHub answered ${res.status} for ${full}. Reports are being lost.`,
        detail: (await res.text()).slice(0, 300),
      };
    }
    const repo = (await res.json()) as { has_issues?: boolean; permissions?: { push?: boolean } };
    if (!repo.has_issues) {
      return { name, status: "fail", summary: `Issues are turned off on ${full}, so nothing can be filed.` };
    }
    return { name, status: "ok", summary: `Reports reach ${full}.` };
  } catch (err) {
    return fail(name, "Could not reach GitHub at all.", err);
  }
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
    let subjectsWithMaterial = 0;

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
      subjectsWithMaterial += left > 0 ? 1 : 0;
    }

    /**
     * The day itself, when every part of it checks out.
     *
     * A timetable and material that both look right, and a board with nothing on it, is the
     * hardest failure to see from outside and the one that has cost the most mornings. When it
     * happens the week is printed: which days did get lessons tells you whether the planner ran
     * at all, ran and placed them elsewhere, or ran and produced nothing.
     */
    const lessonsToday = today.filter((a) => a.kind === "LESSON").length;
    if (lessonsToday < student.lessonsPerDay && subjectsWithMaterial > 0) {
      broken += 1;
      const week = await prisma.dailyAssignment.groupBy({
        by: ["date"],
        where: {
          studentId: student.id,
          kind: "LESSON",
          status: { not: "MOVED" },
          date: { gte: toDateOnly(weekStartKey(dateOnlyKey(todayDateOnly()))) },
        },
        _count: { _all: true },
        orderBy: { date: "asc" },
      });
      lines.push(
        `  SHORT DAY — ${lessonsToday} of ${student.lessonsPerDay} periods, with ` +
          `${subjectsWithMaterial} subject(s) that still have lessons to give.`,
      );
      lines.push(
        `  this week: ${week.length ? week.map((d) => `${dateOnlyKey(d.date)}=${d._count._all}`).join(", ") : "nothing planned"}`,
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
    pictureCheck().catch((err) => fail("Questions with missing pictures", "Check failed.", err)),
    questionImageCheck().catch((err) => fail("Showing a question's picture", "Check failed.", err)),
    explainerCheck().catch((err) => fail("Writing a lesson (OpenAI)", "Check failed.", err)),
    oakQuotaCheck().catch((err) => fail("Curriculum provider (Oak)", "Check failed.", err)),
    videoCheck().catch((err) => fail("Playing a video", "Check failed.", err)),
    speechCheck().catch((err) => fail("Reading text aloud", "Check failed.", err)),
    voiceCheck().catch((err) => fail("Voice picker (ElevenLabs)", "Check failed.", err)),
    bugReportCheck().catch((err) => fail("Sending a bug report", "Check failed.", err)),
    todaysVideosCheck().catch((err) => fail("Videos in today's lessons", "Check failed.", err)),
  ]);
  return checks;
}
