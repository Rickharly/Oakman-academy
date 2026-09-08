"use client";

import { useEffect, useRef, useState } from "react";
import { Send, MessageCircle, Info } from "lucide-react";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { SpeakButton } from "./SpeakButton";
import { cn } from "@/lib/cn";

export type TeacherPanelProps = {
  /** Current lesson attempt, so the AI has context. Omit for the standalone /teacher chat. */
  lessonAttemptId?: string;
  /** The question the student is currently on, if any. */
  questionId?: string;
  /** Current lesson stage — used only to show the assessment-mode note. */
  stage?: "STARTER" | "LEARN" | "PRACTICE" | "CHECK" | "FEEDBACK" | "COMPLETE";
  className?: string;
  /** Whether this child's teacher reads her replies aloud. Set by a parent in Settings. */
  voice?: boolean;
};

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

const PROMPT_CHIPS = [
  "I don't understand this",
  "Can you explain it another way?",
  "Can you give me a hint?",
];

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `msg-${idCounter}`;
}

/** Three softly pulsing dots, shown while the teacher composes a reply. */
function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" role="status" aria-label="Your teacher is thinking">
      <span className="sr-only">Your teacher is thinking…</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-ink-faint animate-typing-dot"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

export function TeacherPanel({ lessonAttemptId, questionId, stage, className, voice = false }: TeacherPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;

    setError(null);
    setInput("");
    const assistantId = nextId();
    // The teacher's bubble appears straight away, before the request is even sent: the model
    // can take a few seconds to produce its first word, and a child staring at an unchanged
    // screen has no way to tell whether their question was heard.
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: message },
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setSending(true);

    try {
      const res = await fetch("/api/teacher/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversationId,
          lessonAttemptId,
          questionId,
        }),
      });

      if (!res.ok || !res.body) {
        let detail = "Something went wrong. Please try again.";
        try {
          const data = await res.json();
          if (typeof data?.error === "string") detail = data.error;
        } catch {
          // ignore — keep default message
        }
        setError(detail);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setSending(false);
        return;
      }

      const nextConversationId = res.headers.get("X-Conversation-Id");
      if (nextConversationId) setConversationId(nextConversationId);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const delta = decoder.decode(value, { stream: true });
        if (!delta) continue;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m))
        );
      }
    } catch {
      setError("Couldn't reach your teacher right now. Please try again.");
      setMessages((prev) => prev.filter((m) => m.id === assistantId ? m.content.length > 0 : true));
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex items-center gap-2 border-b border-line px-1 pb-3">
        <MessageCircle className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold text-ink">Ask your teacher</h2>
      </div>

      {stage === "CHECK" ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-xs text-accent-ink">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>During a quiz I can help you think it through, but I can&apos;t give you the answer.</p>
        </div>
      ) : null}

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">
              Stuck, or just want it explained differently? Ask away.
            </p>
            <div className="flex flex-wrap gap-2">
              {PROMPT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => void send(chip)}
                  disabled={sending}
                  className="min-h-11 rounded-full border border-line bg-surface-raised px-3.5 text-sm text-ink-muted transition-colors duration-150 hover:border-accent hover:text-accent-ink disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("max-w-[90%]", m.role === "user" ? "ml-auto" : "")}>
              <div
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user" ? "bg-accent text-white" : "bg-stone-100 text-ink",
                )}
              >
                {m.content ? (
                  m.content
                ) : m.role === "assistant" ? (
                  <TypingDots />
                ) : null}
              </div>
              {/*
                Only the teacher's finished replies get a voice, and only when a parent has
                turned it on for this child. A half-streamed sentence read aloud is worse than
                silence.
              */}
              {voice && m.role === "assistant" && m.content && !sending ? (
                <SpeakButton text={m.content} />
              ) : null}
            </div>
          ))
        )}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-line pt-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder="Ask a question…"
          rows={1}
          disabled={sending}
          className="min-h-11 flex-1 resize-none py-2.5"
        />
        <Button type="submit" disabled={sending || !input.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
