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
import { describeFetchError, resolveAssetUrl } from "@/lib/curriculum/asset-fetch";
import { resolveMedia } from "@/lib/curriculum/media-link";
import { isPlaceholderUrl, isPlayableResource } from "@/lib/curriculum/video-status";
import { imageSchema } from "@/lib/questions/types";
import { isLessonDone } from "@/lib/progress/aggregate";
import { addDaysKey, dateOnlyKey, toDateOnly, todayDateOnly, weekStartKey } from "@/lib/dates";

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
  // This check runs on the server and proves only what the server can do. It has been read as
  // proof that children can watch the lesson three times now, and each reading was wrong — the
  // server's network and browser are not theirs. Said plainly below, on every "looks fine" result,
  // next to the section that actually answers the child's question.
  const CLIENT_EVIDENCE_NOTE =
    'This proves the server can reach the file — it says nothing about whether a child\'s browser can play it. See "What children\'s browsers actually got (video)" below for that.';
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
    /**
     * Followed exactly as the player's route follows it, and reported the way the route decides:
     * a link the browser is sent to directly, or one we have to proxy and relabel. A green
     * "the server can download it" told us nothing about what the child's iPad was handed.
     */
    const resolved = await resolveMedia({ id: resource.id, providerUrl: resource.providerUrl });

    if (resolved.kind === "stream") {
      const type = resolved.response.headers.get("content-type") ?? "(none)";
      const length = resolved.response.headers.get("content-length") ?? "(unknown)";
      const reader = resolved.response.body?.getReader();
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
      return {
        name,
        status: type.startsWith("video/") ? "ok" : "warn",
        summary:
          (type.startsWith("video/")
            ? `The provider streams the file itself (${type}, ${length} bytes); it is passed through to the player.`
            : `The provider streams the file itself but calls it "${type}"; it is relabelled as video for the player.`) +
          ` ${CLIENT_EVIDENCE_NOTE}`,
        detail: `${resource.lesson.title}\n${target}${staleNote}`,
      };
    }

    const { link } = resolved;
    const host = new URL(link.url).host;
    const type = link.contentType ?? "(none given)";
    const expiresIn = Math.max(0, Math.round((link.expiresAt - Date.now()) / 60000));
    const direct = link.acceptsRanges && (link.contentType?.startsWith("video/") ?? false);
    return {
      name,
      status: direct ? "ok" : "warn",
      summary:
        (direct
          ? `Video plays straight from ${host} (${type}, ranges honoured).`
          : `The file link at ${host} is ${link.acceptsRanges ? `labelled "${type}"` : "not seekable"}, so the server proxies and relabels it. It should still play; if it does not, this is where to look.`) +
        ` ${CLIENT_EVIDENCE_NOTE}`,
      detail: `${resource.lesson.title}\nEndpoint: ${target}\nLink host: ${host}\nContent type: ${type}\nRanges: ${link.acceptsRanges ? "yes" : "no"}\nLink good for about ${expiresIn} more minute(s)${staleNote}`,
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
    // The same question the player asks of the same row, from the same shared helper — see
    // `src/lib/curriculum/video-status.ts`. Two independent readings of "is this fetchable" is
    // how a parent's diagnostics and a child's own screen ended up disagreeing.
    if (!video) {
      missing += 1;
      lines.push(
        `  ${lesson.title}: NO VIDEO ROW` +
          (lesson.assetsSyncedAt
            ? " — the provider was asked and had none."
            : " — its assets were never fetched. Opening the lesson now fetches them."),
      );
    } else if (!isPlayableResource(video)) {
      missing += 1;
      lines.push(
        isPlaceholderUrl(video.providerUrl)
          ? `  ${lesson.title}: sample curriculum placeholder (${video.providerUrl ?? "no address"}) — not a real video.`
          : `  ${lesson.title}: video not downloaded yet (${video.providerUrl ?? "no address"}) — not fetchable.`,
      );
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

/** A lesson stage, in a parent's words rather than the record's. */
const STAGE_WORDS: Record<string, string> = {
  STARTER: "the starter",
  LEARN: "the explanation",
  PRACTICE: "practice",
  CHECK: "the quiz",
  FEEDBACK: "feedback, after the quiz",
  COMPLETE: "the very end",
};
function stageWord(stage: string): string {
  return STAGE_WORDS[stage] ?? stage.toLowerCase();
}

/** A `LessonStatus` value, in a parent's words. Shared by `LessonAttempt` and `StudentLessonProgress`. */
const STATUS_WORDS: Record<string, string> = {
  NOT_STARTED: "not started",
  IN_PROGRESS: "in progress",
  COMPLETED: "completed",
  MASTERED: "mastered",
  NEEDS_REVIEW: "needs review",
  ALREADY_KNOWN: "already known",
};
function statusWord(status: string): string {
  return STATUS_WORDS[status] ?? status.toLowerCase();
}

/**
 * Why is this lesson on the board again?
 *
 * `planWeek` (`src/lib/scheduling/planner.ts`) never sets a lesson whose `StudentLessonProgress`
 * row already counts as done, by `isLessonDone` (`src/lib/progress/aggregate.ts`) — COMPLETED,
 * MASTERED, NEEDS_REVIEW, ALREADY_KNOWN, or a completion date. So a lesson reappearing has one of
 * a small number of causes, and reading the planner's code only says what *should* clear it —
 * never which of those causes is actually true for the lesson in front of a specific child this
 * morning. That is looked up here instead of reasoned about, the same way the video checks above
 * stopped guessing and started asking the database.
 *
 * It is also why "I pressed Rebuild and it's still there" can be true and nothing is broken:
 * `POST /api/admin/plan` calls `planWeek` directly. It does not settle a finished-but-unclosed
 * attempt — only `getTodayView` does that, which runs when the *child* opens Today — so a lesson
 * whose quiz was marked but whose attempt was never finalised stays "not done" no matter how many
 * times a parent presses the button. This check says so in exactly those cases, so that reading is
 * a fact about this lesson, not a guess about the code.
 */
export async function whyLessonsRepeatCheck(): Promise<Check> {
  const name = "Why these lessons are on the board";
  const today = todayDateOnly();

  const assignments = await prisma.dailyAssignment.findMany({
    where: { date: today, kind: "LESSON", status: { not: "MOVED" } },
    include: {
      student: { include: { user: { select: { displayName: true } } } },
      lesson: { select: { id: true, title: true } },
    },
    orderBy: [{ studentId: "asc" }, { order: "asc" }],
  });

  if (assignments.length === 0) {
    return { name, status: "ok", summary: "No lessons on any board today, so there is nothing to explain." };
  }

  const lines: string[] = [];
  let current = "";
  let freshCount = 0;
  let deliberateRepeatCount = 0;
  let neverOpenedCount = 0;
  let abandonedCount = 0;
  let unclosedCount = 0;
  let bugCount = 0;

  for (const assignment of assignments) {
    const lesson = assignment.lesson;
    if (!lesson) continue;
    const who = assignment.student.user.displayName;
    if (who !== current) {
      if (current) lines.push("");
      lines.push(who);
      current = who;
    }

    const [priorCount, mostRecent, progress, attempts] = await Promise.all([
      prisma.dailyAssignment.count({
        where: {
          studentId: assignment.studentId,
          lessonId: lesson.id,
          kind: "LESSON",
          status: { not: "MOVED" },
          date: { lt: today },
        },
      }),
      prisma.dailyAssignment.findFirst({
        where: {
          studentId: assignment.studentId,
          lessonId: lesson.id,
          kind: "LESSON",
          status: { not: "MOVED" },
          date: { lt: today },
        },
        orderBy: { date: "desc" },
        select: { date: true },
      }),
      prisma.studentLessonProgress.findUnique({
        where: { studentId_lessonId: { studentId: assignment.studentId, lessonId: lesson.id } },
      }),
      prisma.lessonAttempt.findMany({
        where: { studentId: assignment.studentId, lessonId: lesson.id },
        orderBy: { attemptNumber: "asc" },
      }),
    ]);

    const before = priorCount > 0 ? `given before, last on ${dateOnlyKey(mostRecent!.date)}` : "never given before";
    const latest = attempts.at(-1) ?? null;

    // No attempt at all: either genuinely new, or it has sat on a board before without ever
    // being opened. Both are "never started" — only the severity differs, because a lesson
    // nobody has touched is not a fault, but one offered before and ignored is unfinished work.
    if (!latest) {
      if (priorCount > 0) {
        neverOpenedCount += 1;
        lines.push(`  ${lesson.title} — ${before}, but never started: it sat on the board unopened, so it is back.`);
      } else {
        freshCount += 1;
        lines.push(`  ${lesson.title} — new: ${who} has not had this lesson before.`);
      }
      continue;
    }

    const attemptDone = isLessonDone(latest);
    const progressDone = progress ? isLessonDone(progress) : false;

    if (attemptDone && progressDone) {
      // Finished, and the planner agrees it's finished — so an assignment for it today is not
      // the planner's mistake. It is a repeat or a review someone chose on purpose.
      deliberateRepeatCount += 1;
      lines.push(
        `  ${lesson.title} — ${before}. Finished (${statusWord(latest.status)}) and correctly counted as done: this is a deliberate repeat or review, not a mistake.`,
      );
      continue;
    }

    if (attemptDone && !progressDone) {
      // The one real fault: the attempt itself says the child finished, but the row the planner
      // actually reads disagrees, so the planner still thinks there is work to do. Nothing about
      // the child explains this — `recomputeLessonProgress` should have kept these in step.
      bugCount += 1;
      lines.push(
        `  ${lesson.title} — ${before}. The last attempt is finished (${statusWord(latest.status)}), but the progress ` +
          `record says "${progress ? statusWord(progress.status) : "no record at all"}" — the planner does not see ` +
          "this as done. That is a bug, not the child's doing, and it is why the lesson keeps coming back.",
      );
      continue;
    }

    // Not finished. The quiz having been marked is what tells "still working on it" apart from
    // "finished it and nobody closed the file" — the exact gap `settleFinishedLessons` exists to
    // close, and the exact gap "Rebuild today's lessons" cannot close on its own.
    const checkGraded = await prisma.activityAttempt.findFirst({
      where: {
        lessonAttemptId: latest.id,
        stage: "CHECK",
        OR: [{ status: "GRADED" }, { status: "IN_PROGRESS", gradedAt: { not: null } }],
      },
    });

    if (checkGraded) {
      unclosedCount += 1;
      lines.push(
        `  ${lesson.title} — ${before}. The quiz was answered and marked, but the lesson was never closed off ` +
          `(still "${statusWord(latest.status)}", sitting at ${stageWord(latest.currentStage)}). Pressing Rebuild ` +
          "will not fix this by itself — only finishing it does.",
      );
    } else {
      abandonedCount += 1;
      lines.push(
        `  ${lesson.title} — ${before}. Started but stopped partway, at ${stageWord(latest.currentStage)}: not ` +
          "finished, so it is back.",
      );
    }
  }

  const parts: string[] = [];
  if (freshCount > 0) parts.push(`${freshCount} new lesson(s)`);
  if (deliberateRepeatCount > 0) parts.push(`${deliberateRepeatCount} deliberate repeat(s) of finished work`);
  if (neverOpenedCount > 0) parts.push(`${neverOpenedCount} back because they were never opened`);
  if (abandonedCount > 0) parts.push(`${abandonedCount} back because they were left partway through`);
  if (unclosedCount > 0) parts.push(`${unclosedCount} back because the quiz was done but never closed off`);
  if (bugCount > 0) parts.push(`${bugCount} that are a bug: finished but not recorded as done`);

  return {
    name,
    status: bugCount > 0 ? "fail" : neverOpenedCount + abandonedCount + unclosedCount > 0 ? "warn" : "ok",
    summary: `${assignments.length} lesson(s) on boards today — ${parts.join(", ")}.`,
    detail: lines.join("\n"),
  };
}

/**
 * What the children have actually reported, in their own words.
 *
 * This is here because the answer to "do you even see the tickets?" was no. Reports went
 * straight to GitHub and nowhere else, and with no token on the server they failed into a log
 * line nobody reads — destroyed on arrival, while the app thanked the child for sending them.
 *
 * They are kept in the database now, and printed here. A report that could not be sent is still
 * a report, and this page can be copied and pasted by a parent, which needs no token and no
 * permissions and works on the worst day.
 */
async function childReportsCheck(): Promise<Check> {
  const name = "What the children have reported";
  const logs = await prisma.activityLog.findMany({
    where: { kind: { in: ["bug_report", "lesson_already_known"] } },
    include: { student: { include: { user: { select: { displayName: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  if (logs.length === 0) {
    return { name, status: "ok", summary: "Nothing reported." };
  }

  const lines: string[] = [];
  let unsent = 0;

  for (const log of logs) {
    const data = (log.data ?? {}) as Record<string, unknown>;
    const who = log.student?.user.displayName ?? "someone";
    const when = log.createdAt.toISOString().slice(0, 16).replace("T", " ");

    if (log.kind === "lesson_already_known") {
      lines.push(`${when} — ${who} said they already knew "${String(data.lessonTitle ?? "a lesson")}"`);
      if (data.note) lines.push(`   "${redactish(String(data.note))}"`);
      lines.push(data.seenBefore ? "   (they had done it before — a repeat we set)" : "   (no earlier record)");
      lines.push("");
      continue;
    }

    if (data.sent !== true) unsent += 1;
    lines.push(`${when} — ${who}${data.sent === true ? "" : "  [NOT SENT]"}`);
    lines.push(`   "${redactish(String(data.what ?? ""))}"`);
    if (data.lessonTitle) lines.push(`   Lesson: ${String(data.lessonTitle)}${data.stage ? ` (${String(data.stage)})` : ""}`);
    if (data.questionPrompt) lines.push(`   Question: ${String(data.questionPrompt)}`);
    if (data.videoState) lines.push(`   Where the video goes: ${String(data.videoState)}`);
    if (data.problem) lines.push(`   Could not send: ${String(data.problem)}`);
    lines.push("");
  }

  return {
    name,
    status: unsent > 0 ? "fail" : "ok",
    summary:
      unsent > 0
        ? `${logs.length} report(s) from the children — ${unsent} never reached anyone. Copy this section and send it.`
        : `${logs.length} report(s) from the children.`,
    detail: lines.join("\n"),
  };
}

/** Keeps anything key-shaped out of a child's own words. Belt and braces. */
function redactish(text: string): string {
  return text.replace(/\b(sk|xi|ghp|github_pat)[-_][A-Za-z0-9_-]{12,}/g, "[redacted]").slice(0, 500);
}

/** A user-agent string, cut down to the two things a parent actually needs: browser, platform. */
function browserSummary(ua: string): string {
  if (!ua) return "(no user agent given)";
  const platform = /CrOS/i.test(ua)
    ? "ChromeOS"
    : /Android/i.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/i.test(ua)
        ? "iOS"
        : /Windows/i.test(ua)
          ? "Windows"
          : /Mac OS X/i.test(ua)
            ? "macOS"
            : /Linux/i.test(ua)
              ? "Linux"
              : "unknown platform";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /CriOS\//.test(ua)
        ? "Chrome (iOS)"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /FxiOS\//.test(ua)
            ? "Firefox (iOS)"
            : /Firefox\//.test(ua)
              ? "Firefox"
              : /Version\/.*Safari\//.test(ua)
                ? "Safari"
                : "unknown browser";
  return `${browser} on ${platform}`;
}

/**
 * What a child's own browser actually got, the times a lesson video failed.
 *
 * `videoCheck` above proves the server can fetch a file; this is the thing children asked for
 * without knowing it — evidence from the machine that was actually failing. Every reading of
 * this fault before this existed was a guess made from a server with different network access
 * and a different browser than the Chromebook a child was holding, and every guess was wrong.
 */
async function videoReportsCheck(): Promise<Check> {
  const name = "What children's browsers actually got (video)";
  const logs = await prisma.activityLog.findMany({
    where: { kind: "video_report" },
    include: { student: { include: { user: { select: { displayName: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  if (logs.length === 0) {
    return { name, status: "ok", summary: "No child's browser has reported a video failure." };
  }

  const lessonIds = Array.from(
    new Set(
      logs
        .map((log) => (log.data as Record<string, unknown>).lessonId)
        .filter((id): id is string => typeof id === "string"),
    ),
  );
  const lessons = await prisma.lesson.findMany({ where: { id: { in: lessonIds } }, select: { id: true, title: true } });
  const lessonTitle = new Map(lessons.map((l) => [l.id, l.title]));

  const lines: string[] = [];
  for (const log of logs) {
    const data = (log.data ?? {}) as Record<string, unknown>;
    const probe = (data.probe ?? {}) as Record<string, unknown>;
    const who = log.student?.user.displayName ?? "someone";
    const when = log.createdAt.toISOString().slice(0, 16).replace("T", " ");
    const title =
      typeof data.lessonId === "string" ? (lessonTitle.get(data.lessonId) ?? data.lessonId) : "an unknown lesson";

    lines.push(`${when} — ${who} — "${title}"`);
    lines.push(`  Browser: ${browserSummary(String(data.userAgent ?? ""))}`);
    lines.push(
      `  The player itself said: ${
        data.elementErrorMessage
          ? redactish(String(data.elementErrorMessage))
          : data.elementErrorCode != null
            ? `code ${String(data.elementErrorCode)}`
            : "(nothing given)"
      }`,
    );

    if (probe.networkErrorName) {
      lines.push(`  Fetching the same URL itself failed: ${probe.networkErrorName}: ${redactish(String(probe.networkErrorMessage ?? ""))}`);
    } else {
      lines.push(
        `  Fetching the same URL got: HTTP ${probe.status ?? "?"}, content-type ${probe.contentType ?? "(none)"}, ` +
          `content-length ${probe.contentLength ?? "(none)"}, content-range ${probe.contentRange ?? "(none)"}, ` +
          `accept-ranges ${probe.acceptRanges ?? "(none)"}`,
      );
      if (probe.redirected) {
        lines.push(`  Redirected (type "${probe.responseType ?? "?"}") to: ${probe.urlHost ?? "(unknown host)"}`);
      }
      if (probe.bodySnippet) lines.push(`  First bytes: ${redactish(String(probe.bodySnippet))}`);
    }
    lines.push("");
  }

  return {
    name,
    status: "warn",
    summary: `${logs.length} report(s) from children's own browsers, newest first — this is what actually reached them, not a server's guess.`,
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
 * The planner produces nothing for a hundred quiet reasons, and they are not all the same kind
 * of wrong. Some are a real shortage — no timetable, no enrolment, a subject that has run out —
 * and those are worth an alarm. Others are just "nothing has asked the planner yet": planning
 * only happens when a child opens Today, or a parent opens that child's page or presses
 * "Rebuild today's lessons" — nothing runs on a timer — so a profile nobody has visited this week
 * will always show an empty week, and that is the system working as designed, not a failure.
 * Counting that alongside a genuine shortage buries the real problem under noise a parent cannot
 * act on, and trains them to stop reading the headline at all.
 *
 * So this tells three things apart:
 *  - a real supply problem (no timetable, no enrolment, or a subject with too few lessons left) —
 *    this is what "problem(s) stopping lessons being scheduled" counts, and the only thing that
 *    should make a parent worry;
 *  - a student nobody is linked to — a real misconfiguration, counted alongside the above, because
 *    no parent-facing action (including "Rebuild today's lessons") can ever reach them until it is
 *    fixed, however many times anyone presses it;
 *  - a week nobody has planned yet, or a day that came up short once the planner did run — both
 *    printed for context, at a lower severity, because pressing an alarm about them sends someone
 *    hunting a bug that is not there.
 */
export async function timetableCheck(): Promise<Check> {
  const name = "Why today looks like this";
  const students = await prisma.studentProfile.findMany({
    include: { user: { select: { displayName: true } } },
  });
  if (students.length === 0) return { name, status: "fail", summary: "No students." };

  const lines: string[] = [];
  let broken = 0; // real problems: nothing here can put a lesson on the board, however many times anyone tries.
  let unplannedWeeks = 0; // nobody has asked the planner to run yet — not a failure.
  let shortDays = 0; // the planner ran this week but today itself came up short.

  for (const student of students) {
    const [schedules, enrolments, today, parentLinks] = await Promise.all([
      prisma.studentSchedule.findMany({ where: { studentId: student.id, active: true }, include: { subject: true } }),
      prisma.studentEnrolment.findMany({
        where: { studentId: student.id, active: true },
        include: { programme: { include: { subject: true } } },
      }),
      prisma.dailyAssignment.findMany({
        where: { studentId: student.id, date: todayDateOnly(), status: { not: "MOVED" } },
        include: { subject: true },
      }),
      prisma.parentStudentLink.count({ where: { studentId: student.userId } }),
    ]);

    lines.push(
      `${student.user.displayName} — Year ${student.yearGroup}, ${student.lessonsPerDay} periods/day`,
    );
    lines.push(
      `  today: ${today.filter((a) => a.kind === "LESSON").length} lesson(s), ` +
        `${today.filter((a) => a.kind === "REVIEW").length} review(s)`,
    );

    if (parentLinks === 0) {
      lines.push(
        "  NO PARENT LINKED — nobody is set up to look after this child, so no parent-facing " +
          "action reaches them: opening their page, pressing \"Rebuild today's lessons\", none of " +
          "it, because none of it knows this child exists. Their board stays empty however many " +
          "times anyone presses anything, until a parent is linked to this account.",
      );
      broken += 1;
    }

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
      // Two shapes of the same shortage: nothing left at all, or not enough left to last a
      // single week at the rate the timetable promises. Both are a real supply problem — the
      // second just has not bitten yet.
      const outOfLessons = left <= 0;
      const runningOut = !outOfLessons && left < schedule.weeklyFrequency;
      if (outOfLessons || runningOut) broken += 1;
      lines.push(
        `  ${schedule.subject.title}: ${schedule.weeklyFrequency}/week · ` +
          `programme ${programme.provider}:y${programme.yearGroup} · ` +
          `${lessons.length} lesson(s), ${done} done, ${left} left` +
          (outOfLessons
            ? "  <-- NOTHING TO TEACH"
            : runningOut
              ? `  <-- ONLY ${left} LEFT FOR A ${schedule.weeklyFrequency}/WEEK TIMETABLE — will run out this week`
              : ""),
      );
      subjectsWithMaterial += left > 0 ? 1 : 0;
    }

    /**
     * The day itself, when the timetable and the material both check out.
     *
     * A short day here has two very different causes that look identical from a blank board:
     * nobody has ever asked the planner to run this week (nothing to fix — say so and name what
     * would fix it), or the planner ran and genuinely could not fill every period today (the
     * "SHORT DAY" this message was originally written for). Telling them apart needs the week's
     * assignments, not just today's: no rows at all this week means the first; some rows means
     * the second.
     */
    const lessonsToday = today.filter((a) => a.kind === "LESSON").length;
    if (lessonsToday < student.lessonsPerDay && subjectsWithMaterial > 0) {
      const weekStart = weekStartKey(dateOnlyKey(todayDateOnly()));
      const week = await prisma.dailyAssignment.groupBy({
        by: ["date"],
        where: {
          studentId: student.id,
          kind: "LESSON",
          status: { not: "MOVED" },
          date: { gte: toDateOnly(weekStart), lt: toDateOnly(addDaysKey(weekStart, 7)) },
        },
        _count: { _all: true },
        orderBy: { date: "asc" },
      });
      const weekTotal = week.reduce((n, d) => n + d._count._all, 0);

      if (weekTotal === 0) {
        unplannedWeeks += 1;
        lines.push(
          `  NOTHING PLANNED THIS WEEK YET — ${subjectsWithMaterial} subject(s) have lessons ready ` +
            "to give, but nobody has asked the planner to run: it only happens when this child " +
            'signs in and opens Today, or when a parent opens their page or presses "Rebuild ' +
            "today's lessons\" above. This is not a fault — it just has not happened yet.",
        );
      } else {
        shortDays += 1;
        lines.push(
          `  SHORT DAY — ${lessonsToday} of ${student.lessonsPerDay} periods, with ` +
            `${subjectsWithMaterial} subject(s) that still have lessons to give.`,
        );
        lines.push(`  this week: ${week.map((d) => `${dateOnlyKey(d.date)}=${d._count._all}`).join(", ")}`);
      }
    }

    lines.push("");
  }

  const notes: string[] = [];
  if (broken > 0) notes.push(`${broken} problem(s) stopping lessons being scheduled`);
  if (unplannedWeeks > 0) {
    notes.push(
      `${unplannedWeeks} child(ren) whose week nobody has planned yet — not a problem, just not started`,
    );
  }
  if (shortDays > 0) notes.push(`${shortDays} day(s) short once the planner ran out of material for today`);

  return {
    name,
    status: broken > 0 ? "fail" : unplannedWeeks > 0 || shortDays > 0 ? "warn" : "ok",
    summary: notes.length > 0 ? `${notes.join("; ")} — see below.` : "Every subject on every timetable has lessons to give.",
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
    videoReportsCheck().catch((err) =>
      fail("What children's browsers actually got (video)", "Check failed.", err),
    ),
    speechCheck().catch((err) => fail("Reading text aloud", "Check failed.", err)),
    voiceCheck().catch((err) => fail("Voice picker (ElevenLabs)", "Check failed.", err)),
    bugReportCheck().catch((err) => fail("Sending a bug report", "Check failed.", err)),
    todaysVideosCheck().catch((err) => fail("Videos in today's lessons", "Check failed.", err)),
    whyLessonsRepeatCheck().catch((err) => fail("Why these lessons are on the board", "Check failed.", err)),
    childReportsCheck().catch((err) => fail("What the children have reported", "Check failed.", err)),
  ]);
  return checks;
}
