# Oakman Academy — Product & Technical Specification (source)

The original product specification, kept as the reference for product decisions.
See ARCHITECTURE.md for how it maps onto the codebase.

## 1. Product objective

Build a lightweight web application that functions as the children's actual day-to-day school
interface. The child should never need to think: "Go to Oak, find lesson 14, download this PDF,
complete it, send the result somewhere, then open ChatGPT and explain what I'm learning."
Instead, they log in and see: **Good morning, Eva. Here is today's school.** Everything happens
from that interface.

The system provides: structured curriculum, daily lesson plans, lesson progression, learning
materials, interactive worksheets, interactive quizzes, AI grading, AI feedback, contextual AI
tutor, permanent learning history, mastery tracking, parent/admin oversight, progress reporting.

The initial implementation is for two students, but the architecture must not hard-code two users.

## 2. Core architecture

Oak National Academy → curriculum source. Our database → student state and school records.
Our application → student and parent experience. OpenAI → tutor, assessment, feedback and
adaptive support. Oak remains a curriculum provider, not our application state; we ingest Oak data
but maintain our own copies of what is needed to operate the school.

## 3. User roles

**Student** — each child has a completely separate account (Eva, Year 7; Mikhael, Year 5). A child
cannot access the other child's data.

**Parent / Admin** — one primary admin account. Can see every student, today's work, every
submitted assignment, every quiz, individual answers, AI grading, teacher feedback, progress by
subject/unit, weak topics, attendance/activity, AI conversations; can assign work, alter schedules,
skip/repeat lessons, manually adjust completion, override AI marks, add custom assignments,
generate progress reports.

**AI Teacher** — not a human account; a contextual service associated with a student and lesson.

## 4. Authentication

Simple: parent email + password; child username/avatar + PIN; persistent sessions; role-based
authorization. Student accounts are subordinate to the parent account. Children are under 13, so
OpenAI functionality runs through the parent-controlled application, not consumer accounts.

## 5. Student home screen

Opens directly to **Today**: date, "3 lessons • approximately 2h 45m", one card per lesson
(subject, title, duration, Continue/Start), then "Today 1 / 3 completed", "This week 9 / 12
completed". No clutter. The student should know exactly one thing: what do I do next?

## 6–8. Curriculum structure, import, local cache

Mirror Oak's hierarchy: Student → Year → Subject → Programme/Sequence → Unit → Lesson →
Resources/Activities/Assessments. Every imported lesson has an internal id plus the Oak id/slug.
Sync pulls subjects, years, sequences, units, lesson order/names/descriptions, objectives,
vocabulary, prior knowledge, misconceptions, teacher guidance, quizzes + answers, worksheets +
answers, transcripts, media. Tolerate missing fields. Maintain a local curriculum store; sync on
first import, manually from Admin, periodically, or when curriculum version changes. Student
progress never depends on Oak API availability.

## 9–11. Lesson page, stages, video

Lesson page: title + progress, main content (video/lesson, worksheet, practice, quiz) with a
persistent AI Teacher panel on the right (bottom sheet on mobile), Previous/Continue footer.
Stages: Starter → Learn → Practice → Check → Feedback → Complete, each with its own timestamp.
Video embedded where licensing allows; track started / % watched / completed; 100 % not required.

## 12–14. Worksheets and question types

Oak worksheets become interactive activities, not PDFs. Ingestion: structured content where
available; otherwise extract questions from the PDF and convert to the internal assessment schema;
the original document remains as fallback. MVP question types: multiple choice, true/false, single
text answer, extended text, numeric, multi-select, matching, ordering.

## 15–17. Quizzes, grading, feedback

Oak questions become native quizzes with immediate results. Deterministic grading for MC,
numeric, true/false, matching, ordering (no AI tokens). AI grading for written explanations,
essays, creative writing, open-ended reasoning, partial credit. AI receives question, expected
answer, Oak guidance, marking criteria, student answer, age/year and returns structured JSON
(score, maxScore, correct, mastery, feedbackForStudent, reasoningForParent, misconceptions,
needsReview). Feedback should feel like a teacher: "You're very close…" then "Try again", not the
answer.

## 18–23. AI teacher

Persistent panel: "Ask your teacher", talk or type. Every conversation automatically receives
structured context (student, year, subject, unit, lesson, objectives, current activity, student
answer, misconceptions, recent difficulties), so "Why is this wrong?" is enough. Context is
composed, not dumped: current lesson/activity, relevant transcript section, unit, last few
messages; history only when relevant. Voice is first-class (v1.1). Pedagogy: explain rather than
answer, age-appropriate vocabulary, guiding questions, check understanding, examples, analogies,
identify misconceptions, specific praise, adapt after failed attempts, remember struggles; never
solve assessed work ("I can't give you the answer, but I can help you work it out"). Maintain a
structured learning profile (strengths, developing, repeated misconceptions, mastery) separate from
chat history.

## 24–27. Progress, mastery, review

Lesson status: not started / in progress / completed / needs review / mastered. Unit, subject and
year aggregates (completion and mastery). Completion and mastery are distinct. Review queue from
poor scores, AI-detected misconceptions, repeated mistakes, parent assignment, spaced repetition
(1 / 7 / 30 days).

## 28–31. Scheduling

Admin defines weekday plan and weekly frequencies (e.g. Maths 5, English 5, Science 3, History 2,
Geography 2). The engine picks the next incomplete lesson in sequence automatically; targets
2.5–3.5 hours per day by estimated duration; moves optional content forward when a day runs long.
Simple Mon–Fri calendar with per-day drill-down.

## 32–38. Admin

Overview cards per student (today, week %, average mastery, needs review). Subject → unit →
lesson drill-down with scores. Lesson inspection: source lesson, worksheet, responses, expected
answers, AI marks, AI feedback, every attempt, time spent, conversation, misconceptions. Overrides
(grade, mark correct, mastery, complete, reset quiz, reopen, exclude question, comment) stored
alongside the AI decision; history never overwritten. Immutable assessment history. Weekly/monthly
reports with a teacher summary; AI end-of-day summary for the parent.

## 39–44. Search, design, navigation, responsive

Student search over their curriculum; admin search over everything. Design: light, modern, calm,
white backgrounds, large spacing, rounded components, restrained borders, strong typography,
minimal navigation (Linear / Notion / Apple education, not Moodle). Student nav: Today, Subjects,
Progress, Teacher. Admin nav: Overview, Students, Schedule, Curriculum, Reports, Settings.
Targets: laptop, iPad, desktop, mobile; touch-friendly worksheet fields.

## 45–50. Data model, provider abstraction, stack, AI architecture

Tables as listed in `prisma/schema.prisma`. Curriculum data and learning data kept separate.
`CurriculumProvider` interface with `OakProvider` first. Stack: Next.js/React/TypeScript,
PostgreSQL, Prisma, simple auth, file storage, OpenAI API, Oak API. One central `TeacherAgent`
with explain/hint/grade/reviewAnswer/generatePractice/summarizeLesson/summarizeDay/
identifyMisconceptions, structured outputs, and internal tools.

## 51–54. Generated exercises, safety, cost, history

AI-generated practice clearly marked. Teacher modes Learn / Practice / Assessment supplied
server-side. Cost control: deterministic grading where possible, no repeated transcripts, chunked
retrieval, summarised conversations, structured observations, larger models only when needed.
Nothing educational disappears.

## 55. MVP scope

1. parent login 2. two student accounts 3. Oak curriculum import 4. Year 5 + Year 7
5. subject/unit/lesson navigation 6. automatic daily schedule 7. lesson player 8. native quizzes
9. native worksheets where conversion is straightforward 10. answer storage 11. deterministic
grading 12. AI grading of written work 13. contextual text AI teacher 14. progress tracking
15. parent dashboard 16. complete history.

## 56. Version 1.1

Realtime voice teacher, weekly summaries, mastery/review engine, AI-generated practice, stronger
PDF → interactive conversion, exported reports, timetable adjustments, student personalisation.

## 57. Non-goals

No marketplace, other families, payments, classrooms, messaging, live video, accreditation,
attendance bureaucracy, native apps, public signup, complex gamification, curriculum authoring.

## 58. Definition of done

Eva can: log in → see today's work → start a Year 7 Oak lesson → consume the teaching → answer
worksheet questions in our UI → ask the AI teacher without explaining context → take the quiz →
receive feedback → finish the lesson. The parent can log into Admin and see what she studied,
every answer, what was correct, what AI said, her score, what she struggled with, whether she
completed the lesson, and how that changed her progress. Mikhael does the same independently.
