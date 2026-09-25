"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { QuestionRenderer } from "@/components/student/questions/QuestionRenderer";
import type { LessonPlayerQuestion } from "@/components/student/LessonPlayer";
import { cn } from "@/lib/cn";

/**
 * A sat exam.
 *
 * Everything the lesson player does to help is deliberately absent: no teacher panel, no hints,
 * no marking until the end, no retries, no "ask me if you're stuck". This is the one place the
 * app finds out what a child can do on their own, and every helpful thing we could add here
 * would take that away.
 *
 * Answers save as they go, because losing a paper to a closed tab is a punishment for a
 * technical fault.
 */
export type ExamPaperQuestion = LessonPlayerQuestion & {
  examQuestionId: string;
  order: number;
  response?: unknown;
};

type Result = {
  scorePct: number;
  grade: string;
  meaning: string;
  topics: { lessonTitle: string; subject: string; asked: number; right: number }[];
  weakTopics: { lessonTitle: string; subject: string; asked: number; right: number }[];
};

export function ExamPaper({
  examId,
  title,
  questions,
  alreadyGraded,
}: {
  examId: string;
  title: string;
  questions: ExamPaperQuestion[];
  alreadyGraded?: Result | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(questions.filter((q) => q.response != null).map((q) => [q.examQuestionId, q.response])),
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(alreadyGraded ?? null);
  const [problem, setProblem] = useState<string | null>(null);

  function answer(examQuestionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [examQuestionId]: value }));
    // Saved as they go. Silent on failure: the answer is still on screen and will go up with
    // the paper, and an error message beside a question during an exam is just noise.
    void fetch(`/api/exams/${examId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "answer", examQuestionId, response: value }),
    }).catch(() => undefined);
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setProblem(null);
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });
      const data = (await res.json()) as Result & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not mark the paper.");
      setResult(data);
      router.refresh();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not mark the paper.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Card padding="lg" className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto h-9 w-9 text-success" />
          <p className="text-sm font-medium text-ink-muted">{title}</p>
          <p className="text-6xl font-semibold text-ink">{result.grade}</p>
          <p className="text-lg text-ink">{result.scorePct}%</p>
          <p className="text-sm text-ink-muted">{result.meaning}</p>
        </Card>

        <Card padding="lg" className="space-y-3">
          <h2 className="text-base font-semibold text-ink">How each topic went</h2>
          <ul className="space-y-1.5 text-sm">
            {result.topics.map((topic) => (
              <li key={topic.lessonTitle} className="flex items-baseline justify-between gap-3">
                <span className="text-ink">
                  {topic.lessonTitle}
                  <span className="text-ink-muted"> · {topic.subject}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 font-medium",
                    topic.right === topic.asked ? "text-success" : "text-warning",
                  )}
                >
                  {topic.right}/{topic.asked}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {result.weakTopics.length > 0 ? (
          <Card padding="lg" className="space-y-2 border-warning/30 bg-warning-soft/40">
            <h2 className="text-base font-semibold text-ink">What we&apos;re going back over</h2>
            <p className="text-sm text-ink">
              These are the ones that didn&apos;t come out right. They&apos;re already on your
              list — you&apos;ll get them again, properly taught, not just asked again.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
              {result.weakTopics.map((topic) => (
                <li key={topic.lessonTitle}>{topic.lessonTitle}</li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card padding="lg" className="bg-success-soft">
            <p className="text-sm text-ink">
              Every topic right. Nothing to go back over — that is a genuinely good week&apos;s work.
            </p>
          </Card>
        )}

        <Button href="/today">Back to Today</Button>
      </div>
    );
  }

  const answered = Object.keys(answers).length;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card padding="lg" className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-accent" />
          <h1 className="text-lg font-semibold text-ink">{title}</h1>
        </div>
        <p className="text-sm text-ink-muted">
          This one is on your own — no teacher, no hints, and nothing is marked until you hand it
          in. Answer what you can. If you don&apos;t know one, have a go anyway and move on.
        </p>
      </Card>

      {questions.map((question, i) => (
        <Card key={question.examQuestionId} padding="lg">
          <p className="mb-3 text-xs font-medium text-ink-faint">
            Question {i + 1} of {questions.length}
          </p>
          <p className="mb-4 text-base font-medium text-ink">{question.prompt}</p>
          <QuestionRenderer
            question={question}
            value={answers[question.examQuestionId]}
            onChange={(value) => answer(question.examQuestionId, value)}
            disabled={submitting}
          />
        </Card>
      ))}

      <Card padding="lg" className="space-y-3">
        <p className="text-sm text-ink-muted">
          {answered} of {questions.length} answered.
        </p>
        <Button onClick={() => void submit()} disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "Marking your paper…" : "Hand it in"}
        </Button>
        {problem ? <p className="text-sm text-danger">{problem}</p> : null}
      </Card>
    </div>
  );
}
