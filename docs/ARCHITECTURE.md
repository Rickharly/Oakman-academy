# Oakman Academy — Architecture

This document is the build contract. `prisma/schema.prisma` is the data model;
this file explains the module boundaries, the route map, and the Oak
integration plan. Product intent lives in `docs/SPEC.md`.

## 1. Layers

```
Oak Open API  ──▶  CurriculumProvider (OakProvider | FixtureProvider)
                        │  sync
                        ▼
              Curriculum tables (Subject, Programme, Unit, Lesson, LessonResource, Question)
                        │  read-only from here on
                        ▼
   Scheduler ──▶ DailyAssignment ──▶ Lesson player ──▶ LessonAttempt/ActivityAttempt/QuestionAttempt
                                                              │
                              Graders (deterministic | AI) ◀──┘──▶ TeacherAgent (OpenAI)
                                                              │
                     StudentLessonProgress · MasteryRecord · ReviewItem · AiLearningObservation
                                                              │
                                    Admin dashboard · inspection · overrides · reports
```

Rules:

- Curriculum tables are written **only** by the sync service. App code never mutates them
  except `Question.excluded` (parent) and AI-generated `Question` rows (`source = AI_GENERATED`).
- Learning tables are append-only wherever they are history (`QuestionAttempt`, `MasteryRecord`,
  `ParentOverride`, `AiMessage`). Denormalised "current state" lives in `StudentLessonProgress`.
- The AI never decides its own mode. `TeacherMode` is computed server-side from the lesson stage.
- Every server entry point (page, route handler, server action) calls `requireUser()` /
  `requireStudent()` / `requireParent()` from `src/lib/auth/session.ts` and scopes every
  query by the authenticated student id. Students can never read another student's rows.

## 2. Directory layout

```
src/
  app/                       Next.js App Router (see route map)
    (student)/               student-facing pages, layout with student nav
    (admin)/admin/           parent pages, layout with admin nav
    (auth)/                  login pages
    api/                     route handlers
  components/
    ui/                      primitives: Button, Card, ProgressRing, Input, Sheet, Badge…
    student/                 Today cards, lesson player pieces, question renderers, teacher panel
    admin/                   tables, inspection views, override controls
  lib/
    db.ts                    Prisma client (pg adapter)
    auth/                    passwords, sessions, guards
    curriculum/              CurriculumProvider interface, OakProvider, FixtureProvider, sync service
    oak/                     generated OpenAPI types + thin typed client
    questions/               canonical question types, Oak→question mapping, worksheet extraction
    grading/                 deterministic graders, AI grading orchestration
    ai/                      OpenAI client, TeacherAgent, context composer, tools, mock provider
    lessons/                 lesson flow state machine (stages), attempt service
    scheduling/              planner (weekly rules → daily assignments), calendar helpers
    progress/                mastery/completion aggregation, review engine
    reports/                 weekly/monthly report generation
    admin/                   override service, inspection queries
  generated/prisma/          generated client (gitignored)
prisma/                      schema + migrations
scripts/                     CLI: seed, oak:sync, plan:today
tests/                       integration tests (real Postgres, mock AI, fixture curriculum)
vendor/oak/openapi.json      vendored Oak OpenAPI 3.1 spec (source of src/lib/oak/openapi.d.ts)
fixtures/curriculum/         sample curriculum in Oak response shapes (used when CURRICULUM_PROVIDER=fixture)
```

## 3. Route map

### Student (`(student)` group, layout = top/bottom nav: Today · Subjects · Reading · Progress · Teacher)

| Route | Purpose |
|---|---|
| `/today` | Home. Greeting, today's assignments in order, today/week counters, review items. |
| `/subjects` | Subject cards with completion + mastery. |
| `/subjects/[subjectSlug]` | Units in sequence order, per-unit progress. |
| `/subjects/[subjectSlug]/units/[unitId]` | Lessons in unit with status chips. |
| `/lessons/[lessonId]` | Lesson player. Starts/continues a `LessonAttempt`; `?stage=` optional. Persistent teacher panel (desktop right column, mobile bottom sheet). |
| `/reading` | Reading room. The passage on screen beside the response box; `?assignmentId=` ties it to the day's reading slot, `?textId=` opens a specific passage. |
| `/progress` | Week strip calendar (Mon–Fri ✓●○), subject bars, "things to review". |
| `/progress/[date]` | What happened that day. |
| `/teacher` | Standalone teacher chat (no lesson context; mode LEARN). |
| `/search?q=` | Lexical search over local curriculum for the student's programmes. |

### Parent (`(admin)/admin`, layout = sidebar: Overview · Students · Schedule · Curriculum · Reports · Settings)

| Route | Purpose |
|---|---|
| `/admin` | Per-student cards: today, week %, average mastery, needs review. |
| `/admin/students/[studentId]` | Student overview: today, calendar, subjects, weak topics, daily summaries, activity. |
| `/admin/students/[studentId]/subjects/[subjectId]` | Units with mastery %, drill into lessons with scores. |
| `/admin/students/[studentId]/lessons/[lessonId]` | Lesson inspection: every attempt, every answer, expected answer, AI marks + reasoning, overrides, conversation, time spent, misconceptions. Override controls. |
| `/admin/students/[studentId]/conversations/[conversationId]` | Full AI transcript. |
| `/admin/schedule` | Per-student weekly frequency rules, day preferences, target minutes; "re-plan today/this week"; assign custom work; skip/repeat/move lessons. |
| `/admin/curriculum` | Imported programmes/units/lessons, licence status, sync jobs, "sync now". |
| `/admin/curriculum/lessons/[lessonId]` | Source lesson view (objectives, questions, resources, transcript). |
| `/admin/reports` | Generate/view weekly & monthly reports per student. |
| `/admin/settings` | Parent account, student accounts (PIN reset, avatar, year group), AI settings. |

### Auth (`(auth)`)

| Route | Purpose |
|---|---|
| `/login` | Parent email + password. |
| `/student-login` | Avatar picker + PIN. |
| `/logout` | POST → clears session. |

### API route handlers (`src/app/api`)

All JSON. Errors are `{ error: string }` with proper status codes.

| Method + path | Purpose |
|---|---|
| `POST /api/auth/login` | parent login |
| `POST /api/auth/student-login` | student login |
| `POST /api/auth/logout` | |
| `POST /api/lessons/[lessonId]/attempts` | start or resume attempt → `{ attemptId, stage }` |
| `POST /api/attempts/[attemptId]/stage` | advance/complete a stage `{ stage, action: "complete" }` |
| `POST /api/attempts/[attemptId]/video` | video progress `{ percentWatched, positionSeconds, completed }` |
| `POST /api/attempts/[attemptId]/answers` | save one answer (draft) `{ questionId, response }` |
| `POST /api/attempts/[attemptId]/submit` | submit a stage `{ stage }` → grades every answer, returns results |
| `POST /api/attempts/[attemptId]/retry` | reopen a question for another try `{ questionId }` |
| `POST /api/teacher/chat` | `{ conversationId?, lessonAttemptId?, questionId?, message }` → streamed text; server composes context and mode |
| `GET /api/teacher/conversations/[id]` | messages |
| `POST /api/admin/overrides` | parent override (all `OverrideType`s) |
| `POST /api/admin/assignments` | add custom / move / skip / repeat |
| `POST /api/admin/plan` | `{ studentId, date }` re-plan a day |
| `POST /api/admin/sync` | start a curriculum sync job |
| `GET /api/admin/sync/[jobId]` | job status |
| `POST /api/admin/reports` | generate report `{ studentId, period, start }` |
| `POST /api/admin/summaries` | generate daily summary `{ studentId, date }` |

Server actions are fine for simple admin forms; route handlers are required where the
client needs streaming or is called from client components with fetch.

## 4. Lesson flow (spec §10)

Stages: `STARTER → LEARN → PRACTICE → CHECK → FEEDBACK → COMPLETE`.

- Each stage completion stamps the matching timestamp on `LessonAttempt`.
- STARTER, PRACTICE and CHECK each create an `ActivityAttempt`; submitting grades every
  `QuestionAttempt` (deterministic first; AI for text types) and marks the activity GRADED.
- A stage with no questions (e.g. no worksheet could be converted) is auto-completed but still
  shows the original PDF link as fallback.
- `TeacherMode` by stage: STARTER→PRACTICE, LEARN→LEARN, PRACTICE→PRACTICE, CHECK→ASSESSMENT,
  FEEDBACK/COMPLETE→LEARN.
- CHECK score → `LessonAttempt.masteryScore` (blend: 0.8 × check %, 0.2 × practice % when present).
  Completion is independent of mastery (spec §25). `< 0.7` mastery → `NEEDS_REVIEW` + `ReviewItem`
  (LOW_SCORE, due tomorrow). `≥ 0.9` with ≥ 2 assessed activities → `MASTERED`.
- Video: not required for completion (`videoProgress.completed` tracked only).

## 5. Grading

`src/lib/grading/grade.ts` exports `gradeQuestion(question, response, ctx) → GradeResult`.

- Deterministic (`DETERMINISTIC_TYPES`): exact/normalised comparisons. Numeric parses decimals,
  fractions (`3/4`), mixed numbers, strips units/whitespace, applies tolerance. Matching/ordering:
  partial credit = fraction of correct pairs/positions (score rounded to 2dp), `correct` only if all.
- SHORT_ANSWER with non-empty `accepted`: deterministic normalised match; on miss and when the
  answer is more than trivially different, fall through to AI grading (so "the mitochondria" vs
  "mitochondria" is handled without tokens, but "powerhouse organelle" still gets judged).
- EXTENDED_TEXT and SHORT_ANSWER without key: AI grading via `TeacherAgent.grade()` with the
  structured output `gradeResultSchema`. AI receives question, expected answer/rubric, lesson
  key learning points, misconceptions, student age/year, student answer.
- `QuestionAttempt.gradedBy` records the path. `gradingRaw` keeps the full trace.

## 6. TeacherAgent (spec §49–§52)

`src/lib/ai/teacher-agent.ts`:

```
explain(ctx, message)        streaming chat reply
grade(question, answer, ctx) GradeResult (structured)
summarizeLesson(attempt)     short feedback for student + notes for parent
summarizeDay(student, date)  DailySummary for parent
identifyMisconceptions(...)  updates AiLearningObservation
generatePractice(...)        3 short AI_GENERATED questions for a misconception
```

- `AiProvider` interface with `OpenAiProvider` (Responses API, structured outputs via zod) and
  `MockProvider` (deterministic canned answers; used when `AI_PROVIDER=mock` and in all tests).
- Context composer (`context.ts`) builds the system prompt from: student (name, year), subject,
  unit, lesson (outcome, key learning points, keywords, misconceptions), current stage + mode,
  current question + student's draft/submitted answer, last 8 messages (+ rolling summary),
  active `AiLearningObservation`s for the subject (max 10), and the transcript **window**
  (± 1500 chars around the best lexical match for the student's message) — never the whole transcript.
- Mode rules are injected server-side. ASSESSMENT: may clarify wording and give conceptual hints,
  must not reveal or confirm answers.
- Tools (function calling): `getLessonTranscript`, `getQuestion`, `getRecentErrors`,
  `saveLearningObservation`, `createReviewTask`. Tool calls are persisted in `AiMessage.toolCalls`.
- Cost controls: fast model by default; strong model only for `grade()` of EXTENDED_TEXT and for
  `summarizeDay`. Conversation summarised into `AiConversation.summary` once > 20 messages.

## 7. Scheduling (spec §28–§30)

`src/lib/scheduling/planner.ts`:

- Input: student, `StudentSchedule` rules (weekly frequency per subject, preferred days),
  target minutes, existing assignments for the week, pending `ReviewItem`s due ≤ date.
- Weekly distribution: subjects with frequency 5 go every weekday; others spread evenly across
  the week honouring `preferredDays`; deterministic given the same inputs (so re-planning is stable).
- Each slot picks the **next incomplete lesson in sequence order** for the student's enrolled
  programme in that subject (skips COMPLETED/MASTERED, includes NEEDS_REVIEW only via review items).
- Review items become short REVIEW assignments (15 min) placed first, at most 2 a day.
- The timetable is fixed, not budgeted: every weekday gets `lessonsPerDay` periods of
  `lessonMinutes` each (defaults 5 × 45), whatever the lesson content estimates. A top-up loop
  fills any short day, preferring a subject not already on that day. A day is only short when
  a subject has genuinely run out of lessons.
- One short READING assignment (20 min) closes each day, after the periods — but only when the
  library holds a passage for the student's year group. The passage itself is chosen when the
  child opens `/reading`, not at planning time.
- `src/lib/scheduling/timetable.ts` turns the day into clock times from `schoolStartTime`,
  separated by `breakMinutes`. The times are a guide, never a gate.
- Idempotent: planning the same day twice does not duplicate; existing IN_PROGRESS/COMPLETED
  rows are never touched; PARENT-sourced rows are never removed.
- `ensureTodayPlanned(studentId, date)` is called lazily from `/today` and by `scripts/plan.ts`.

## 8. Progress & review (spec §24–§27)

- `StudentLessonProgress` is recomputed after every graded activity and every override.
- Unit/subject/year aggregates are computed on read (`progress/aggregate.ts`): completion =
  completed lessons / lessons; mastery = mean of lesson mastery for lessons with a mastery value.
- Review engine (`progress/review.ts`): creates `ReviewItem`s for LOW_SCORE (< 70 %), MISCONCEPTION
  (from AI grading), REPEATED_MISTAKE (same misconception topic ≥ 2 attempts), PARENT_ASSIGNED,
  SPACED (1 → 7 → 30 days after a successful review). A REVIEW assignment re-runs the lesson's
  CHECK questions (new `ActivityAttempt`, stage CHECK). ≥ 80 % → step up; else back to step 0.

## 8a. Reading & literacy

- Passages are original writing bundled as `fixtures/reading/year-*.json` and upserted into
  `ReadingText` by `src/lib/reading/library.ts` on every seed — adding a passage to a fixture
  file and redeploying is the whole workflow. Nothing is fetched from a provider.
- `src/lib/reading/service.ts` picks the next unread passage for the year group, records what
  the child writes, then asks the teacher to reply. **The write happens first**: if the model
  call fails the writing is still saved and can be replied to later.
- Short responses are *answered*, not scored — a reply that names something they wrote and asks
  one question that sends them back to the text. Passages with an `essayPrompt` are marked out
  of 8 by the strong model. `reasoning` is a note for the parent and is never returned to the
  child by `/api/reading/respond`.
- Entries are append-only like the rest of the learning history; the parent sees every one on
  the student overview.

## 8b. Engagement: how the day was actually worked

`src/lib/engagement/service.ts`:

- `SchoolDay` anchors the day to the moment the first lesson starts. Lateness is recorded once,
  on the day. Every later period is then due a break's length after the previous one ended
  (`expectedStart`), so a late start shifts the day rather than making every period late.
- `LessonAttempt.activeSeconds / idleSeconds / awaySeconds` split the period. The browser sends
  the split every 30s; the server clamps each slice to 600s and only writes to the sending
  child's own attempt.
- Idle = no pointer, key, scroll or touch event for `IDLE_AFTER_SECONDS` (120). This is a weak
  proxy and is treated as one: it is reported next to the work, never instead of it.
- `FocusEvent` records a gap the child explained — "I need a moment" → toilet, drink, called
  away, something else. Flagged time is excluded from the focus ratio rather than counted
  against them. One open event at a time; an event left open is capped at two hours.
- Nothing here is shown to the child. A child watching a focus score learns to game it.

## 8c. The academic record (for a receiving school)

`src/lib/records/academic-record.ts` builds the cumulative record and
`/admin/students/[id]/record` renders it for print.

It is **not** a transcript, and does not imitate one: no province issues transcripts for
home-educated children, and placement is decided by the receiving principal, often after their
own assessment. The record is therefore built as evidence — coverage against the English
National Curriculum (via the Oak programme), every assessment with its real date and score,
attendance and instructional hours from `SchoolDay`/`LessonAttempt`, and verbatim work samples.
Subject notes come from the AI teacher, grounded in the units actually covered, and the
provenance paragraph says so on the face of the document. Subjects with nothing finished are
omitted. `saveAcademicRecord` stores the issued document (`Report.period = ACADEMIC_RECORD`) so
the exact page handed over can be reproduced.

## 9. Oak integration plan

Source of truth: `vendor/oak/openapi.json` (Oak OpenAPI 0.7.0). Types in `src/lib/oak/openapi.d.ts`
(generated with `pnpm oak:types`). Auth: `Authorization: Bearer $OAK_API_KEY`. Base
`https://open-api.thenational.academy/api/v0/`. Rate limit default 10 req/s; respect `Retry-After`.
Licence: lesson content OGL v3.0; assets OGL-compatible or restricted — check
`GET /key-stages/{ks}/subject/{subject}/check-restricted` and store `Lesson.licence`.
Attribution is required in the UI (`/lessons/{lesson}/assets` returns `attribution[]`).

Endpoints used by the sync service, in order:

1. `GET /subjects/{subject}` → sequences per subject with years/keyStages.
2. `GET /sequences/{sequence}/units?year=N` → units for the year in sequence order
   (`unitOrder`; `unitOptions[]` when a unit has variants — take the first option unless configured).
3. `GET /units/{unit}/summary` → description, prior knowledge, national curriculum, threads,
   `unitLessons[] {lessonSlug, lessonTitle, lessonOrder, state}`.
4. `GET /lessons/{lesson}/summary` → objectives, keywords, misconceptions, tips, guidance.
5. `GET /lessons/{lesson}/quiz` → `starterQuiz[]`, `exitQuiz[]` (types: multiple-choice,
   short-answer, match, order) → `Question` rows (STARTER / CHECK).
6. `GET /lessons/{lesson}/transcript` → `transcript`, `vtt`.
7. `GET /lessons/{lesson}/assets` → resource list with signed URLs (video, worksheet,
   worksheetAnswers, slideDeck, quizzes) → `LessonResource`; worksheet PDFs are downloaded to
   `ASSET_STORAGE_DIR` for the worksheet pipeline. Signed URLs expire: re-fetch on demand via
   `GET /lessons/{lesson}/assets/{type}` when serving.
8. `GET /key-stages/{ks}/subject/{subject}/check-restricted?unit=` → licence per lesson.

Mapping Oak → our model:

| Oak | Ours |
|---|---|
| subject slug/title | `Subject` |
| sequence slug + year | `Programme` (`providerSlug = "<sequence>:<year>"`) |
| unit (slug, order) | `Unit` |
| lesson (slug, lessonOrder) | `Lesson` (`providerSlug = lessonSlug`) |
| starterQuiz / exitQuiz question | `Question` (`source OAK_STARTER_QUIZ` / `OAK_EXIT_QUIZ`, `stage STARTER` / `CHECK`) |
| multiple-choice, 1 non-distractor | `MULTIPLE_CHOICE` |
| multiple-choice, >1 non-distractor | `MULTI_SELECT` |
| short-answer | `SHORT_ANSWER` (`accepted = answers[].content`) |
| match | `MATCHING` |
| order | `ORDERING` |
| worksheet PDF | `LessonResource WORKSHEET` → worksheet pipeline → `Question` (`OAK_WORKSHEET`, `PRACTICE`) |
| video asset | `LessonResource VIDEO` (embedded `<video>` when a stream URL is available; else link) |
| transcript | `Lesson.transcript`, `Lesson.transcriptVtt` |

Importer rules: tolerate missing fields (every field optional in the mapper, defaults from schema);
upsert by `(provider, providerSlug)`; questions upsert by `providerRef` (sha1 of question JSON);
every lesson gets `estimatedMinutes` from an heuristic (45 base; +5 if video; +10 if worksheet);
sync jobs are recorded in `CurriculumSyncJob` with a running log.

`FixtureProvider` reads `fixtures/curriculum/*.json`, which are in exactly the Oak response
shapes, so the mapper and importer are exercised end-to-end without network. The fixture
curriculum is sample content written for this project, not Oak's real lessons.

Worksheet pipeline (`questions/worksheet-pipeline.ts`): PDF → text (`pdf-parse`) → numbered
question splitter → optional AI structuring into canonical questions (structured output) →
`Question` rows flagged `source OAK_WORKSHEET`; the PDF remains as `LessonResource` fallback.

## 10. Auth

Hand-rolled, minimal: bcrypt password/PIN hashes; opaque random session token stored hashed in
`Session`; `fs_session` HttpOnly cookie, 30-day sliding expiry; `src/proxy.ts` redirects
unauthenticated requests to the right login and parents/students to their own areas.
Student accounts belong to a parent via `ParentStudentLink`.

## 11. Testing

- `pnpm test` runs Vitest against `DATABASE_URL` (a local Postgres) with the fixture curriculum
  and the mock AI provider. `tests/helpers/db.ts` resets the schema between suites.
- Core services (mapper, graders, planner, lesson flow, review engine, overrides) each have tests.
- `pnpm e2e` runs the Playwright loop from spec §58 against `next dev`.
