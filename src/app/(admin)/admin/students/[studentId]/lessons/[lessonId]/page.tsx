import Link from "next/link";
import { Clock, MessageCircle, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeStatus } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { QuestionOverrideControls, LessonOverrideControls } from "@/components/admin/OverrideControls";
import { requireParentOfStudent } from "@/lib/auth/session";
import { getLessonInspection, type InspectionQuestionAttempt } from "@/lib/admin/inspection";
import type { Question } from "@/generated/prisma/client";

const STATUS_BADGE: Record<string, BadgeStatus> = {
  NOT_STARTED: "not-started",
  IN_PROGRESS: "in-progress",
  COMPLETED: "completed",
  NEEDS_REVIEW: "needs-review",
  MASTERED: "mastered",
  ALREADY_KNOWN: "already-known",
};

const STAGE_FIELD: { stage: string; field: "starterCompletedAt" | "instructionCompletedAt" | "practiceCompletedAt" | "assessmentCompletedAt" | "completedAt" }[] = [
  { stage: "Starter", field: "starterCompletedAt" },
  { stage: "Learn", field: "instructionCompletedAt" },
  { stage: "Practice", field: "practiceCompletedAt" },
  { stage: "Check", field: "assessmentCompletedAt" },
  { stage: "Complete", field: "completedAt" },
];

function fmtTime(d: Date | null | undefined): string {
  return d ? d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

function optionLabel(options: unknown, id: string): string {
  const choices = (options as { choices?: { id: string; text: string }[] } | null)?.choices;
  return choices?.find((c) => c.id === id)?.text ?? id;
}

function listLabel(items: { id: string; text: string }[] | undefined, id: string): string {
  return items?.find((c) => c.id === id)?.text ?? id;
}

function formatResponse(question: Question, response: unknown): string {
  const r = response as Record<string, unknown> | null;
  if (!r || Object.keys(r).length === 0) return "No answer given";
  switch (question.type) {
    case "MULTIPLE_CHOICE":
      return typeof r.optionId === "string" ? optionLabel(question.options, r.optionId) : "No answer given";
    case "MULTI_SELECT":
      return Array.isArray(r.optionIds) && r.optionIds.length
        ? (r.optionIds as string[]).map((id) => optionLabel(question.options, id)).join(", ")
        : "No answer given";
    case "TRUE_FALSE":
      return r.value === true ? "True" : r.value === false ? "False" : "No answer given";
    case "SHORT_ANSWER":
    case "EXTENDED_TEXT":
    case "NUMERIC":
      return typeof r.text === "string" && r.text.trim() ? r.text : "No answer given";
    case "MATCHING": {
      const opts = question.options as { left?: { id: string; text: string }[]; right?: { id: string; text: string }[] } | null;
      const pairs = (r.pairs as { leftId: string; rightId: string }[] | undefined) ?? [];
      return pairs.length
        ? pairs.map((p) => `${listLabel(opts?.left, p.leftId)} → ${listLabel(opts?.right, p.rightId)}`).join("; ")
        : "No answer given";
    }
    case "ORDERING": {
      const opts = question.options as { items?: { id: string; text: string }[] } | null;
      const order = (r.order as string[] | undefined) ?? [];
      return order.length ? order.map((id) => listLabel(opts?.items, id)).join(" → ") : "No answer given";
    }
    default:
      return JSON.stringify(r);
  }
}

function formatAnswerKey(question: Question): string {
  const k = question.answerKey as Record<string, unknown>;
  switch (question.type) {
    case "MULTIPLE_CHOICE":
      return optionLabel(question.options, k.correctOptionId as string);
    case "MULTI_SELECT":
      return ((k.correctOptionIds as string[]) ?? []).map((id) => optionLabel(question.options, id)).join(", ");
    case "TRUE_FALSE":
      return k.value ? "True" : "False";
    case "SHORT_ANSWER":
      return ((k.accepted as string[]) ?? []).join(" / ") || (k.modelAnswer as string) || "—";
    case "EXTENDED_TEXT":
      return (k.modelAnswer as string) || ((k.keyPoints as string[]) ?? []).join("; ") || "—";
    case "NUMERIC":
      return k.value != null ? String(k.value) : "—";
    case "MATCHING": {
      const opts = question.options as { left?: { id: string; text: string }[]; right?: { id: string; text: string }[] } | null;
      return (((k.pairs as { leftId: string; rightId: string }[]) ?? [])
        .map((p) => `${listLabel(opts?.left, p.leftId)} → ${listLabel(opts?.right, p.rightId)}`)
        .join("; ")) || "—";
    }
    case "ORDERING": {
      const opts = question.options as { items?: { id: string; text: string }[] } | null;
      return (((k.order as string[]) ?? []).map((id) => listLabel(opts?.items, id)).join(" → ")) || "—";
    }
    default:
      return JSON.stringify(k);
  }
}

function gradedByLabel(gradedBy: string): string {
  switch (gradedBy) {
    case "DETERMINISTIC":
      return "Graded automatically";
    case "AI":
      return "Graded by the AI teacher";
    case "PARENT":
      return "Graded by you";
    default:
      return "Not yet graded";
  }
}

function QuestionRow({
  studentId,
  qa,
}: {
  studentId: string;
  qa: { question: Question; attempts: InspectionQuestionAttempt[]; latest: InspectionQuestionAttempt | null };
}) {
  const { question, attempts, latest } = qa;
  if (!latest) return null;
  const machineCorrect = latest.isCorrect;
  const effective = latest.effective;

  return (
    <div className="space-y-3 rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Question {question.order}</p>
          <p className="text-sm font-medium text-ink">{question.prompt}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {question.excluded ? <Badge tone="neutral">Excluded</Badge> : null}
          <Badge tone={effective.isCorrect ? "success" : "danger"}>{effective.isCorrect ? "Correct" : "Incorrect"}</Badge>
          <span className="text-xs tabular-nums text-ink-muted">
            {effective.score ?? 0} / {effective.maxScore}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 rounded-xl bg-stone-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Student&apos;s answer</p>
          <p className="text-sm text-ink">{formatResponse(question, latest.response)}</p>
        </div>
        <div className="space-y-1 rounded-xl bg-accent-soft p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Expected answer</p>
          <p className="text-sm text-ink">{formatAnswerKey(question)}</p>
          {question.explanation ? <p className="text-xs text-ink-muted">{question.explanation}</p> : null}
        </div>
      </div>

      <div className="space-y-1 text-xs text-ink-muted">
        <p>
          {gradedByLabel(latest.gradedBy)}
          {machineCorrect != null ? ` · machine said ${machineCorrect ? "correct" : "incorrect"} (${latest.score ?? 0}/${latest.maxScore})` : ""}
        </p>
        {effective.overridden && effective.override ? (
          <p className="font-medium text-accent-ink">
            Parent override: {effective.isCorrect ? "marked correct" : `score set to ${effective.score}/${effective.maxScore}`}
            {effective.override.comment ? ` — "${effective.override.comment}"` : ""}
          </p>
        ) : null}
      </div>

      {latest.feedback ? (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">AI feedback to student</p>
          <p className="text-sm text-ink">{latest.feedback}</p>
        </div>
      ) : null}
      {latest.reasoning ? (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">AI reasoning (for you)</p>
          <p className="text-sm text-ink">{latest.reasoning}</p>
        </div>
      ) : null}
      {Array.isArray(latest.misconceptions) && latest.misconceptions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {(latest.misconceptions as string[]).map((m, i) => (
            <Badge key={i} tone="warning">
              {m}
            </Badge>
          ))}
        </div>
      ) : null}

      {attempts.length > 1 ? (
        <details className="rounded-xl bg-stone-50 p-3">
          <summary className="cursor-pointer text-xs font-medium text-ink-muted">
            {attempts.length - 1} earlier attempt{attempts.length - 1 === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 space-y-2">
            {attempts.slice(1).map((a) => (
              <li key={a.id} className="text-xs text-ink-muted">
                Attempt {a.attemptNumber}: {formatResponse(question, a.response)} —{" "}
                {a.isCorrect == null ? "not graded" : a.isCorrect ? "correct" : "incorrect"} ({a.score ?? 0}/{a.maxScore})
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <QuestionOverrideControls
        studentId={studentId}
        questionAttemptId={latest.id}
        questionId={question.id}
        maxScore={question.maxScore}
        isCorrect={effective.isCorrect}
        excluded={question.excluded}
      />
    </div>
  );
}

export default async function AdminLessonInspectionPage({
  params,
}: {
  params: Promise<{ studentId: string; lessonId: string }>;
}) {
  const { studentId, lessonId } = await params;
  const { student } = await requireParentOfStudent(studentId);
  const inspection = await getLessonInspection(studentId, lessonId);

  return (
    <>
      <PageHeader
        title={inspection.lesson.title}
        description={`${student.user.displayName} · ${inspection.lesson.unit.programme.subject.title} · ${inspection.lesson.unit.title}`}
        actions={inspection.progress ? <Badge status={STATUS_BADGE[inspection.progress.status]} /> : undefined}
      />

      {inspection.attempts.length === 0 ? (
        <EmptyState title="Not started yet" description="This student hasn't started this lesson." />
      ) : (
        <div className="space-y-10">
          {inspection.attempts.map((a) => (
            <section key={a.attempt.id} className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Attempt {a.attempt.attemptNumber}</h2>
                  <p className="text-sm text-ink-muted">
                    Started {fmtTime(a.attempt.startedAt)} · {fmtDuration(a.attempt.timeSpentSeconds)} spent
                    {a.attempt.masteryScore != null ? ` · ${Math.round(a.attempt.masteryScore * 100)}% mastery` : ""}
                  </p>
                </div>
                <Badge status={STATUS_BADGE[a.attempt.status]} />
              </div>

              <Card padding="md">
                <div className="flex flex-wrap gap-4 sm:gap-6">
                  {STAGE_FIELD.map(({ stage, field }) => {
                    const value = a.attempt[field] as Date | null;
                    return (
                      <div key={stage} className="flex items-center gap-2 text-sm">
                        <span className={`h-2 w-2 rounded-full ${value ? "bg-success" : "bg-stone-300"}`} />
                        <span className="font-medium text-ink">{stage}</span>
                        <span className="text-xs text-ink-muted">{fmtTime(value)}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <LessonOverrideControls studentId={studentId} lessonAttemptId={a.attempt.id} lessonId={lessonId} />

              {a.feedback.length > 0 ? (
                <div className="space-y-2">
                  {a.feedback.map((f) => (
                    <div key={f.id} className="rounded-xl border border-line px-4 py-3 text-sm">
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                        {f.authorType === "AI" ? "AI note for you" : "Your comment"} · {fmtTime(f.createdAt)}
                      </p>
                      <p className="text-ink">{f.content}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {a.conversations.length > 0 ? (
                <div className="space-y-2">
                  {a.conversations.map((c) => (
                    <details key={c.id} className="rounded-xl border border-line px-4 py-3">
                      <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-ink">
                        <span className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-ink-muted" />
                          {c.title ?? `${c.mode} conversation`} · {c.messageCount} messages
                        </span>
                        <Link
                          href={`/admin/students/${studentId}/conversations/${c.id}`}
                          className="flex items-center gap-1 text-xs text-accent hover:underline"
                        >
                          Full transcript <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </summary>
                      {c.summary ? <p className="mt-2 text-sm text-ink-muted">{c.summary}</p> : null}
                    </details>
                  ))}
                </div>
              ) : null}

              {a.activities.map((activity) => (
                <div key={activity.activity.id} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-ink">{activity.activity.stage}</h3>
                    <Badge tone={activity.activity.status === "GRADED" ? "accent" : "neutral"}>{activity.activity.status}</Badge>
                    {activity.activity.percentage != null ? (
                      <span className="flex items-center gap-1 text-xs text-ink-muted">
                        <Clock className="h-3.5 w-3.5" />
                        {Math.round(activity.activity.percentage)}% ({activity.activity.score}/{activity.activity.maxScore})
                      </span>
                    ) : null}
                  </div>
                  {activity.questions.length === 0 ? (
                    <p className="text-sm text-ink-muted">No questions in this stage.</p>
                  ) : (
                    <div className="space-y-3">
                      {activity.questions.map((qa) => (
                        <QuestionRow key={qa.question.id} studentId={studentId} qa={qa} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
