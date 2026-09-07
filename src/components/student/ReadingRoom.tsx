"use client";

import { useState } from "react";
import { BookOpen, Check, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

/**
 * Reading: the passage on the left, what the child writes on the right.
 *
 * The text stays on screen while they answer — reading responses should send you back into
 * the text, not test your memory of it.
 */
export type ReadingRoomText = {
  id: string;
  title: string;
  author: string;
  genre: string;
  body: string;
  wordCount: number;
  estimatedMinutes: number;
  prompts: string[];
  essayPrompt: string | null;
  vocabulary: { word: string; meaning: string }[];
};

export type ReadingRoomEntry = {
  id: string;
  kind: "RESPONSE" | "ESSAY";
  prompt: string;
  response: string;
  feedback: string | null;
  score: number | null;
  maxScore: number | null;
};

export function ReadingRoom({
  text,
  entries,
  assignmentId,
}: {
  text: ReadingRoomText;
  entries: ReadingRoomEntry[];
  assignmentId?: string;
}) {
  const answered = new Set(entries.map((e) => e.prompt));
  const firstUnanswered = text.prompts.findIndex((p) => !answered.has(p));
  const [promptIndex, setPromptIndex] = useState(firstUnanswered === -1 ? 0 : firstUnanswered);
  const [essayMode, setEssayMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replies, setReplies] = useState<ReadingRoomEntry[]>(entries);

  const activePrompt = essayMode ? text.essayPrompt : text.prompts[promptIndex];
  const essayDone = replies.some((r) => r.kind === "ESSAY");

  async function send() {
    const response = draft.trim();
    if (!response || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/reading/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readingTextId: text.id,
          promptIndex: essayMode ? null : promptIndex,
          response,
          assignmentId,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not send that. Try again.");
      }
      const entry = (await res.json()) as ReadingRoomEntry;
      setReplies((prev) => [...prev, entry]);
      setDraft("");
      if (!essayMode) {
        const next = text.prompts.findIndex(
          (p, i) => i > promptIndex && !new Set([...replies, entry].map((e) => e.prompt)).has(p),
        );
        if (next !== -1) setPromptIndex(next);
      } else {
        setEssayMode(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
      {/* The passage */}
      <Card padding="lg" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">
            <BookOpen className="h-3 w-3" /> {text.genre}
          </Badge>
          <span className="text-xs text-ink-faint">
            {text.wordCount} words · about {text.estimatedMinutes} minutes
          </span>
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{text.title}</h1>
          <p className="text-sm text-ink-muted">{text.author}</p>
        </div>

        <div className="space-y-4 text-[15px] leading-8 text-ink">
          {text.body.split(/\n{2,}/).map((para, i) => (
            <p key={i} className={text.genre === "poetry" ? "whitespace-pre-line leading-7" : undefined}>
              {para}
            </p>
          ))}
        </div>

        {text.vocabulary.length > 0 ? (
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Words to notice</p>
            <dl className="mt-2 space-y-1.5">
              {text.vocabulary.map((v) => (
                <div key={v.word} className="text-sm">
                  <dt className="inline font-medium text-ink">{v.word}</dt>
                  <dd className="inline text-ink-muted"> — {v.meaning}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </Card>

      {/* What they write */}
      <div className="space-y-4 lg:sticky lg:top-24">
        <Card padding="lg" className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {text.prompts.map((p, i) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setEssayMode(false);
                  setPromptIndex(i);
                }}
                className={`flex h-9 min-w-9 items-center justify-center gap-1 rounded-full px-3 text-sm font-medium transition-colors ${
                  !essayMode && promptIndex === i
                    ? "bg-accent text-white"
                    : "bg-stone-100 text-ink-muted hover:bg-stone-200"
                }`}
              >
                {answered.has(p) ? <Check className="h-3.5 w-3.5" /> : null}
                {i + 1}
              </button>
            ))}
            {text.essayPrompt ? (
              <button
                type="button"
                onClick={() => setEssayMode(true)}
                className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors ${
                  essayMode ? "bg-accent text-white" : "bg-gold-soft text-gold-ink hover:bg-gold-soft/70"
                }`}
              >
                {essayDone ? <Check className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                Longer piece
              </button>
            ) : null}
          </div>

          <p className="text-base font-medium leading-relaxed text-ink">{activePrompt}</p>
          {essayMode ? (
            <p className="text-xs text-ink-muted">
              Take your time with this one. Use examples from the text to back up what you say — it&apos;s marked
              out of 8.
            </p>
          ) : (
            <p className="text-xs text-ink-muted">A few sentences is plenty. Your teacher will write back.</p>
          )}

          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={essayMode ? 12 : 6}
            placeholder={essayMode ? "Write your answer…" : "What do you think?"}
            aria-label="Your response"
          />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button onClick={send} disabled={sending || !draft.trim()} size="lg" className="w-full">
            <Send className="mr-1.5 h-4 w-4" />
            {sending ? "Sending…" : "Send to my teacher"}
          </Button>
        </Card>

        {replies.map((r) => (
          <Card key={r.id} padding="lg" className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{r.prompt}</p>
            <p className="whitespace-pre-wrap text-sm text-ink">{r.response}</p>
            {r.feedback ? (
              <div className="rounded-2xl bg-accent-soft p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent-ink">Your teacher</p>
                <p className="mt-1 text-sm leading-relaxed text-ink">{r.feedback}</p>
                {r.score != null && r.maxScore != null ? (
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {r.score} / {r.maxScore}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-ink-faint">Saved. Your teacher will reply soon.</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
