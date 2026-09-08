"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, Clock, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

/**
 * Reading: read the whole thing, then answer with the text put away.
 *
 * Two phases, deliberately. Reading and answering are different activities, and a passage
 * sitting beside the question invites skimming for the sentence that answers it instead of
 * reading the chapter. School comprehension works the same way: you read, the book closes,
 * then you talk about it.
 *
 * The reading phase is a single wide column at a comfortable measure — a chapter is long, and
 * an iPad held in two hands wants line lengths it can follow, not a column squeezed beside a
 * form.
 */
export type ReadingRoomBook = {
  title: string;
  author: string;
  chapterNumber: number;
  chapterCount: number;
};

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
  book: ReadingRoomBook | null;
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

  // Someone returning to a passage they have already written about goes straight to the
  // questions: they have read it, and making them sit through it again teaches nothing.
  const [phase, setPhase] = useState<"reading" | "questions">(
    entries.length > 0 ? "questions" : "reading",
  );
  const [promptIndex, setPromptIndex] = useState(firstUnanswered === -1 ? 0 : firstUnanswered);
  const [essayMode, setEssayMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replies, setReplies] = useState<ReadingRoomEntry[]>(entries);

  // How long the passage was actually open. Not a countdown and never shown as one — a child
  // watching a reading clock reads the clock.
  const openedAt = useRef<number | null>(null);
  const readingSecondsRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // Set on mount rather than during render: reading the clock while rendering is impure,
    // and the difference in practice is a few milliseconds.
    openedAt.current ??= Date.now();
    if (phase !== "reading") return;
    const id = setInterval(
      () => setElapsed(Math.round((Date.now() - (openedAt.current ?? Date.now())) / 1000)),
      5000,
    );
    return () => clearInterval(id);
  }, [phase]);

  const activePrompt = essayMode ? text.essayPrompt : text.prompts[promptIndex];
  const essayDone = replies.some((r) => r.kind === "ESSAY");
  const paragraphs = text.body.split(/\n{2,}/);

  function finishReading() {
    readingSecondsRef.current = Math.round((Date.now() - (openedAt.current ?? Date.now())) / 1000);
    setPhase("questions");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
          // Sent once, with the first answer: it measures the reading, not the writing.
          readingSeconds: readingSecondsRef.current ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not send that. Try again.");
      }
      const entry = (await res.json()) as ReadingRoomEntry;
      setReplies((prev) => [...prev, entry]);
      setDraft("");
      readingSecondsRef.current = null;
      if (!essayMode) {
        const done = new Set([...replies, entry].map((e) => e.prompt));
        const next = text.prompts.findIndex((p, i) => i > promptIndex && !done.has(p));
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

  const header = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">
          <BookOpen className="h-3 w-3" /> {text.book ? "Chapter" : text.genre}
        </Badge>
        <span className="text-xs text-ink-faint">
          {text.book ? `Chapter ${text.book.chapterNumber} of ${text.book.chapterCount} · ` : ""}
          {text.wordCount.toLocaleString()} words · about {text.estimatedMinutes} minutes
        </span>
      </div>
      <div>
        {text.book ? (
          <p className="text-sm font-medium text-ink-muted">
            {text.book.title} <span className="text-ink-faint">· {text.book.author}</span>
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{text.title}</h1>
        {text.book ? null : <p className="text-sm text-ink-muted">{text.author}</p>}
      </div>
      {text.book ? (
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-stone-100"
          role="progressbar"
          aria-label="How far through the book"
          aria-valuenow={text.book.chapterNumber}
          aria-valuemin={0}
          aria-valuemax={text.book.chapterCount}
        >
          <span
            className="block h-full rounded-full bg-accent"
            style={{ width: `${(text.book.chapterNumber / text.book.chapterCount) * 100}%` }}
          />
        </div>
      ) : null}
    </div>
  );

  // ── Phase one: read it ───────────────────────────────────────────────────
  if (phase === "reading") {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Card padding="lg" className="space-y-6">
          {header}

          {/* A generous measure and open leading: this is a chapter, not a caption. */}
          <div className="space-y-5 text-[17px] leading-[1.85] text-ink sm:text-[18px]">
            {paragraphs.map((para, i) => (
              <p key={i} className={text.genre === "poetry" ? "whitespace-pre-line leading-[1.7]" : undefined}>
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

        <Card padding="lg" className="space-y-3 text-center">
          <p className="text-sm text-ink-muted">
            When you&apos;ve finished, the questions come next — the text goes away, so read it
            properly first.
          </p>
          <Button onClick={finishReading} size="lg" className="w-full sm:w-auto">
            I&apos;ve finished reading
          </Button>
          {elapsed >= 60 ? (
            <p className="flex items-center justify-center gap-1.5 text-xs text-ink-faint">
              <Clock className="h-3 w-3" /> {Math.floor(elapsed / 60)} min so far
            </p>
          ) : null}
        </Card>
      </div>
    );
  }

  // ── Phase two: answer with the book closed ───────────────────────────────
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-ink-muted">
          {text.book ? `${text.book.title} · Chapter ${text.book.chapterNumber}` : text.title}
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          Now tell me what you made of it.
        </h1>
        <button
          type="button"
          onClick={() => setPhase("reading")}
          className="text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          Read it again
        </button>
      </div>

      <Card padding="lg" className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {text.prompts.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setEssayMode(false);
                setPromptIndex(i);
              }}
              className={`flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-3.5 text-sm font-medium transition-colors ${
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
              className={`flex h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors ${
                essayMode ? "bg-accent text-white" : "bg-gold-soft text-gold-ink hover:bg-gold-soft/70"
              }`}
            >
              {essayDone ? <Check className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              Longer piece
            </button>
          ) : null}
        </div>

        <p className="text-lg font-medium leading-relaxed text-ink">{activePrompt}</p>
        {essayMode ? (
          <p className="text-xs text-ink-muted">
            Take your time with this one. Use examples from the text to back up what you say —
            it&apos;s marked out of 8.
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
  );
}
