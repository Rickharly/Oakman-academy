import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { requireParent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

function answerKeyText(question: { type: string; options: unknown; answerKey: unknown }): string {
  const k = question.answerKey as Record<string, unknown>;
  const opts = question.options as { choices?: { id: string; text: string }[]; left?: { id: string; text: string }[]; right?: { id: string; text: string }[]; items?: { id: string; text: string }[] } | null;
  const label = (list: { id: string; text: string }[] | undefined, id: string) => list?.find((c) => c.id === id)?.text ?? id;
  switch (question.type) {
    case "MULTIPLE_CHOICE":
      return label(opts?.choices, k.correctOptionId as string);
    case "MULTI_SELECT":
      return ((k.correctOptionIds as string[]) ?? []).map((id) => label(opts?.choices, id)).join(", ");
    case "TRUE_FALSE":
      return k.value ? "True" : "False";
    case "SHORT_ANSWER":
      return ((k.accepted as string[]) ?? []).join(" / ") || (k.modelAnswer as string) || "—";
    case "EXTENDED_TEXT":
      return (k.modelAnswer as string) || ((k.keyPoints as string[]) ?? []).join("; ") || "—";
    case "NUMERIC":
      return k.value != null ? String(k.value) : "—";
    case "MATCHING":
      return (((k.pairs as { leftId: string; rightId: string }[]) ?? [])
        .map((p) => `${label(opts?.left, p.leftId)} → ${label(opts?.right, p.rightId)}`)
        .join("; ")) || "—";
    case "ORDERING":
      return (((k.order as string[]) ?? []).map((id) => label(opts?.items, id)).join(" → ")) || "—";
    default:
      return JSON.stringify(k);
  }
}

export default async function AdminCurriculumLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  await requireParent();
  const { lessonId } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      unit: { include: { programme: { include: { subject: true } } } },
      resources: true,
      questions: { orderBy: [{ stage: "asc" }, { order: "asc" }] },
    },
  });
  if (!lesson) notFound();

  const keywords = (lesson.keywords as { keyword: string; description: string }[] | null) ?? [];
  const misconceptions = (lesson.misconceptions as { misconception: string; response: string }[] | null) ?? [];
  const tips = (lesson.teacherTips as string[] | null) ?? [];
  const keyLearningPoints = (lesson.keyLearningPoints as string[] | null) ?? [];

  return (
    <>
      <PageHeader
        title={lesson.title}
        description={`${lesson.unit.programme.subject.title} · ${lesson.unit.title} · ${lesson.licence.replace(/_/g, " ")}`}
        actions={lesson.canonicalUrl ? <Badge tone="accent">Source available</Badge> : undefined}
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card padding="lg" className="space-y-3">
          <h2 className="text-base font-semibold text-ink">Pupil outcome</h2>
          <p className="text-sm text-ink">{lesson.pupilOutcome ?? "—"}</p>
          {keyLearningPoints.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
              {keyLearningPoints.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card padding="lg" className="space-y-3">
          <h2 className="text-base font-semibold text-ink">Keywords</h2>
          {keywords.length === 0 ? (
            <p className="text-sm text-ink-muted">None recorded.</p>
          ) : (
            <dl className="space-y-2">
              {keywords.map((k, i) => (
                <div key={i}>
                  <dt className="text-sm font-medium text-ink">{k.keyword}</dt>
                  <dd className="text-sm text-ink-muted">{k.description}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card padding="lg" className="space-y-3">
          <h2 className="text-base font-semibold text-ink">Misconceptions</h2>
          {misconceptions.length === 0 ? (
            <p className="text-sm text-ink-muted">None recorded.</p>
          ) : (
            <ul className="space-y-2">
              {misconceptions.map((m, i) => (
                <li key={i} className="rounded-xl bg-warning-soft p-3 text-sm">
                  <p className="font-medium text-ink">{m.misconception}</p>
                  <p className="text-ink-muted">{m.response}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="lg" className="space-y-3">
          <h2 className="text-base font-semibold text-ink">Teacher tips</h2>
          {tips.length === 0 ? (
            <p className="text-sm text-ink-muted">None recorded.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
              {tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {lesson.transcript ? (
        <Card padding="lg" className="mb-6 space-y-2">
          <h2 className="text-base font-semibold text-ink">Transcript</h2>
          <p className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-ink-muted">{lesson.transcript}</p>
        </Card>
      ) : null}

      <Card padding="lg" className="mb-6 space-y-4">
        <h2 className="text-base font-semibold text-ink">Questions</h2>
        {lesson.questions.length === 0 ? (
          <p className="text-sm text-ink-muted">No questions imported for this lesson.</p>
        ) : (
          <div className="space-y-3">
            {lesson.questions.map((q) => (
              <div key={q.id} className="space-y-2 rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{q.stage}</Badge>
                  <span className="text-xs text-ink-muted">{q.type.replace(/_/g, " ")}</span>
                  {q.excluded ? <Badge tone="danger">Excluded</Badge> : null}
                </div>
                <p className="text-sm font-medium text-ink">{q.prompt}</p>
                <p className="text-sm text-ink-muted">
                  <span className="font-medium text-ink">Answer:</span> {answerKeyText(q)}
                </p>
                {q.explanation ? <p className="text-xs text-ink-faint">{q.explanation}</p> : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card padding="lg" className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Resources</h2>
        {lesson.resources.length === 0 ? (
          <p className="text-sm text-ink-muted">No resources synced.</p>
        ) : (
          <ul className="space-y-2">
            {lesson.resources.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink">
                  {r.label} <span className="text-xs text-ink-muted">({r.type.replace(/_/g, " ")})</span>
                </span>
                {r.providerUrl ? (
                  <a
                    href={r.providerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
