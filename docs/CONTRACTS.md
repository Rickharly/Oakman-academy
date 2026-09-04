# Module contracts

Modules are built in parallel against these signatures. Do not change a signature without
updating this file. Types not shown are inferred from `prisma/schema.prisma` and
`src/lib/questions/types.ts`.

## auth — `src/lib/auth`

```ts
// password.ts
export function hashPassword(plain: string): Promise<string>;      // bcrypt, cost 10
export function verifyPassword(plain: string, hash: string): Promise<boolean>;

// session.ts (server-only; uses cookies())
export type SessionUser = {
  id: string; role: "PARENT" | "STUDENT"; displayName: string; avatar: string | null;
  email: string | null; username: string | null;
  studentProfile: { id: string; yearGroup: number; keyStage: string; preferences: unknown } | null;
};
export type StudentSessionUser = SessionUser & { studentProfile: NonNullable<SessionUser["studentProfile"]> };
export function getCurrentUser(): Promise<SessionUser | null>;
export function requireUser(): Promise<SessionUser>;                 // redirect("/login") when absent
export function requireStudent(): Promise<StudentSessionUser>;       // redirect("/student-login") unless STUDENT
export function requireParent(): Promise<SessionUser>;               // redirect("/login") unless PARENT
/** Parent must be linked to the student; otherwise notFound(). Returns profile with user. */
export function requireParentOfStudent(studentProfileId: string): Promise<{
  parent: SessionUser;
  student: StudentProfile & { user: User };
}>;
/** For route handlers (no redirect): returns user or null. */
export function getSessionFromRequest(req: Request): Promise<SessionUser | null>;
export function createSession(userId: string): Promise<{ token: string; expiresAt: Date }>; // sets cookie via cookies()
export function destroySession(): Promise<void>;
export const SESSION_COOKIE = "fs_session";
```

Route handlers should use `requireUserApi(req)` helpers from `src/lib/auth/api.ts`:

```ts
export function requireUserApi(req: Request): Promise<SessionUser>;           // throws ApiError(401)
export function requireStudentApi(req: Request): Promise<StudentSessionUser>; // throws ApiError(403)
export function requireParentApi(req: Request): Promise<SessionUser>;         // throws ApiError(403)
export class ApiError extends Error { constructor(public status: number, message: string) }
export function jsonError(err: unknown): Response;  // maps ApiError → {error}, else 500
```

## curriculum — `src/lib/curriculum`

```ts
// provider.ts
export interface ProviderSubject { slug: string; title: string }
export interface ProviderProgramme { sequenceSlug: string; yearGroup: number; keyStage: string; phase?: string; title: string }
export interface ProviderUnitRef { slug: string; title: string; order: number }
export interface ProviderUnit extends ProviderUnitRef {
  description?: string; whyThisWhyNow?: string; priorKnowledge: string[]; nationalCurriculum: string[];
  threads: { slug: string; title: string; order: number }[]; categories: { categoryTitle: string; categorySlug?: string }[];
  lessons: { slug: string; title: string; order: number; state: "published" | "new" }[]; raw?: unknown;
}
export interface ProviderLesson {
  slug: string; title: string; pupilOutcome?: string; keyLearningPoints: string[];
  keywords: { keyword: string; description: string }[]; misconceptions: { misconception: string; response: string }[];
  teacherTips: string[]; contentGuidance?: unknown; supervisionLevel?: string | null;
  canonicalUrl?: string; providerUrl?: string; downloadsAvailable: boolean; raw?: unknown;
}
export interface ProviderQuiz { starterQuiz: unknown[]; exitQuiz: unknown[] }   // Oak quiz question shapes
export interface ProviderTranscript { transcript: string; vtt?: string }
export interface ProviderAsset { type: "slideDeck"|"exitQuiz"|"exitQuizAnswers"|"starterQuiz"|"starterQuizAnswers"|"supplementaryResource"|"video"|"worksheet"|"worksheetAnswers"; label: string; url: string }
export interface ProviderAssets { assets: ProviderAsset[]; attribution: string[] }

export interface CurriculumProvider {
  readonly name: string; // "oak" | "fixture"
  getSubjects(): Promise<ProviderSubject[]>;
  getProgrammes(subjectSlug: string): Promise<ProviderProgramme[]>;
  getUnits(sequenceSlug: string, yearGroup: number): Promise<ProviderUnitRef[]>;
  getUnit(unitSlug: string): Promise<ProviderUnit | null>;
  getLesson(lessonSlug: string): Promise<ProviderLesson | null>;
  getQuiz(lessonSlug: string): Promise<ProviderQuiz | null>;
  getTranscript(lessonSlug: string): Promise<ProviderTranscript | null>;
  getAssets(lessonSlug: string): Promise<ProviderAssets | null>;
  getLicences(keyStage: string, subjectSlug: string, unitSlug?: string): Promise<Record<string, "ogl-compatible" | "restricted">>;
}
export function getCurriculumProvider(): CurriculumProvider; // from CURRICULUM_PROVIDER env

// sync.ts
export interface SyncScope { subjectSlug: string; yearGroup: number; lessonSlugs?: string[]; includeAssets?: boolean }
export function syncProgramme(scope: SyncScope, opts?: { provider?: CurriculumProvider; log?: (line: string) => void }): Promise<{ jobId: string; programmeId: string; stats: Record<string, number> }>;
export function syncMany(scopes: SyncScope[], opts?): Promise<{ jobIds: string[] }>;
```

Questions mapper — `src/lib/questions/oak-mapper.ts`:

```ts
export interface MappedQuestion { stage: "STARTER" | "CHECK" | "PRACTICE"; order: number; type: QuestionTypeName; prompt: string; promptImage?: ImageRef; options?: unknown; answerKey: unknown; explanation?: string; maxScore: number; gradingMode: "DETERMINISTIC" | "AI"; providerRef: string }
export function mapOakQuizQuestion(q: unknown, stage: "STARTER" | "CHECK", order: number): MappedQuestion | null; // null when unsupported
```

Worksheet pipeline — `src/lib/questions/worksheet-pipeline.ts`:

```ts
export function extractWorksheetText(pdf: Buffer): Promise<string>;
export function splitWorksheetQuestions(text: string): { number: string; text: string }[];
export function structureWorksheet(input: { lessonTitle: string; questions: { number: string; text: string }[]; answersText?: string }, ai: AiProvider): Promise<MappedQuestion[]>;
```

## grading — `src/lib/grading`

```ts
// grade.ts
export interface GradingContext {
  studentYearGroup: number;
  lesson: { title: string; keyLearningPoints: string[]; misconceptions: { misconception: string; response: string }[] };
  ai?: AiProvider; // default from getAiProvider()
}
export function gradeQuestion(question: Question, response: unknown, ctx: GradingContext): Promise<GradeResult & { gradedBy: "DETERMINISTIC" | "AI"; raw?: unknown }>;
// deterministic.ts
export function gradeDeterministic(question: Pick<Question,"type"|"options"|"answerKey"|"maxScore">, response: unknown): GradeResult | null; // null → needs AI
```

## ai — `src/lib/ai`

```ts
// provider.ts
export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }
export interface StructuredRequest<T> { model: "fast" | "strong"; system: string; messages: ChatMessage[]; schema: z.ZodType<T>; schemaName: string }
export interface StreamRequest { model: "fast" | "strong"; system: string; messages: ChatMessage[]; tools?: ToolDefinition[] }
export interface ToolDefinition { name: string; description: string; parameters: z.ZodType<unknown>; execute: (args: unknown) => Promise<unknown> }
export interface AiProvider {
  readonly name: "openai" | "mock";
  structured<T>(req: StructuredRequest<T>): Promise<{ data: T; model: string; tokensIn?: number; tokensOut?: number }>;
  stream(req: StreamRequest): AsyncIterable<{ type: "text"; text: string } | { type: "tool_call"; name: string; args: unknown; result: unknown } | { type: "done"; model: string; tokensIn?: number; tokensOut?: number }>;
}
export function getAiProvider(): AiProvider; // AI_PROVIDER env: "openai" | "mock"

// teacher-agent.ts
export interface ChatInput { studentId: string; message: string; conversationId?: string; lessonAttemptId?: string; questionId?: string }
export interface ChatResult { conversationId: string; stream: AsyncIterable<string> } // text deltas; persists messages when done
export const teacherAgent: {
  chat(input: ChatInput): Promise<ChatResult>;
  grade(args: { question: Question; response: unknown; ctx: GradingContext }): Promise<GradeResult & { raw: unknown; model: string }>;
  summarizeLesson(lessonAttemptId: string): Promise<{ forStudent: string; forParent: string; misconceptions: string[] }>;
  summarizeDay(studentId: string, dateKey: string): Promise<{ content: string; data: unknown }>;
  generatePractice(args: { studentId: string; lessonId: string; misconception: string; count?: number }): Promise<Question[]>;
  identifyMisconceptions(args: { studentId: string; lessonId: string; attempts: QuestionAttempt[] }): Promise<AiLearningObservation[]>;
};
export function teacherModeForStage(stage: LessonStage): TeacherMode;
```

HTTP: `POST /api/teacher/chat` body `ChatInput` minus studentId (from session) → streamed
`text/plain; charset=utf-8` body of text deltas, header `X-Conversation-Id`.
`GET /api/teacher/conversations/[id]` → `{ id, mode, messages: { id, role, content, createdAt }[] }`.

## lessons — `src/lib/lessons`

```ts
// service.ts
export function startOrResumeAttempt(studentId: string, lessonId: string, assignmentId?: string): Promise<LessonAttempt>;
export interface AttemptView {
  attempt: LessonAttempt;
  lesson: Lesson & { unit: Unit & { programme: Programme & { subject: Subject } }; resources: LessonResource[] };
  stages: { stage: LessonStage; status: "locked" | "current" | "done"; completedAt: Date | null }[];
  questionsByStage: Record<"STARTER" | "PRACTICE" | "CHECK", StudentQuestion[]>; // answer keys stripped
  activities: (ActivityAttempt & { questionAttempts: QuestionAttempt[] })[];
  drafts: Record<string, unknown>; // questionId → latest unsubmitted response
  worksheetFallback: LessonResource | null;
  teacherMode: TeacherMode;
}
export type StudentQuestion = Omit<Question, "answerKey" | "rubric">;
export function getAttemptView(attemptId: string, studentId: string): Promise<AttemptView>;
export function saveDraftAnswer(attemptId: string, studentId: string, questionId: string, response: unknown): Promise<void>;
export function submitStage(attemptId: string, studentId: string, stage: "STARTER" | "PRACTICE" | "CHECK"): Promise<{ activity: ActivityAttempt; results: (QuestionAttempt & { question: Question })[] }>;
export function retryQuestion(attemptId: string, studentId: string, questionId: string): Promise<void>;
export function completeStage(attemptId: string, studentId: string, stage: LessonStage): Promise<LessonAttempt>; // LEARN/FEEDBACK/COMPLETE; graded stages complete via submitStage
export function recordVideoProgress(attemptId: string, studentId: string, p: { percentWatched: number; positionSeconds: number; completed: boolean }): Promise<void>;
export function recordTime(attemptId: string, studentId: string, seconds: number): Promise<void>;
```

## scheduling — `src/lib/scheduling`

```ts
export function ensureDayPlanned(studentId: string, dateKey: string): Promise<DailyAssignment[]>;
export function planWeek(studentId: string, weekStartKey: string, opts?: { replace?: boolean }): Promise<DailyAssignment[]>;
export interface TodayView {
  dateKey: string; assignments: (DailyAssignment & { lesson: (Lesson & { unit: Unit & { programme: Programme & { subject: Subject } } }) | null; progress: StudentLessonProgress | null; reviewItem: ReviewItem | null })[];
  totalMinutes: number; completedToday: number; totalToday: number; completedWeek: number; totalWeek: number;
}
export function getTodayView(studentId: string, dateKey: string): Promise<TodayView>;
export function getWeekStrip(studentId: string, dateKey: string): Promise<{ dateKey: string; state: "done" | "partial" | "planned" | "none" | "today" }[]>;
```

## progress — `src/lib/progress`

```ts
export function recomputeLessonProgress(studentId: string, lessonId: string): Promise<StudentLessonProgress>;
export function getStudentOverview(studentId: string): Promise<{ today: { done: number; total: number }; week: { done: number; total: number; pct: number }; averageMastery: number | null; needsReview: number; completionPct: number }>;
export function getSubjectProgress(studentId: string): Promise<{ subject: Subject; programmeId: string; completionPct: number; mastery: number | null; lessonsDone: number; lessonsTotal: number }[]>;
export function getUnitProgress(studentId: string, programmeId: string): Promise<{ unit: Unit; lessonsDone: number; lessonsTotal: number; mastery: number | null; lessons: (Lesson & { progress: StudentLessonProgress | null })[] }[]>;
export function getWeakTopics(studentId: string, limit?: number): Promise<{ lesson: Lesson; subject: Subject; mastery: number; observations: AiLearningObservation[] }[]>;
// review.ts
export function afterActivityGraded(activityAttemptId: string): Promise<void>; // updates progress, mastery records, review items, observations
export function getReviewQueue(studentId: string, dateKey: string): Promise<ReviewItem[]>;
export function completeReview(reviewItemId: string, scorePct: number): Promise<ReviewItem>;
```

## admin — `src/lib/admin`

```ts
export function applyOverride(parentId: string, input: { studentId: string; type: OverrideType; questionAttemptId?: string; lessonAttemptId?: string; lessonId?: string; questionId?: string; value?: unknown; comment?: string }): Promise<ParentOverride>;
export function getLessonInspection(studentId: string, lessonId: string): Promise<LessonInspection>; // everything on the inspection page
export function upsertSchedule(studentId: string, rules: { subjectId: string; weeklyFrequency: number; preferredDays: number[]; priority?: number }[]): Promise<void>;
export function addCustomAssignment(parentId: string, input: { studentId: string; dateKey: string; title: string; instructions?: string; estimatedMinutes?: number; lessonId?: string }): Promise<DailyAssignment>;
export function moveAssignment(assignmentId: string, toDateKey: string): Promise<DailyAssignment>;
export function skipAssignment(assignmentId: string): Promise<DailyAssignment>;
export function repeatLesson(parentId: string, studentId: string, lessonId: string, dateKey: string): Promise<DailyAssignment>;
```

## reports — `src/lib/reports`

```ts
export function generateReport(studentId: string, period: "WEEKLY" | "MONTHLY", startKey: string): Promise<Report>;
export function generateDailySummary(studentId: string, dateKey: string): Promise<DailySummary>;
```
