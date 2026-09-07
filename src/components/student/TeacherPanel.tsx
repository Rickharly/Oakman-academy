"use client";

import { useEffect, useRef, useState } from "react";
import { Send, MessageCircle, Info } from "lucide-react";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type TeacherPanelProps = {
  /** Current lesson attempt, so the AI has context. Omit for the standalone /teacher chat. */
  lessonAttemptId?: string;
  /** The question the student is currently on, if any. */
  questionId?: string;
  /** Current lesson stage — used only to show the assessment-mode note. */
  stage?: "STARTER" | "LEARN" | "PRACTICE" | "CHECK" | "FEEDBACK" | "COMPLETE";
  className?: string;
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

export function TeacherPanel({ lessonAttemptId, questionId, stage, className }: TeacherPanelProps) {
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
    setMessages((prev) => [...prev, { id: nextId(), role: "user", content: message }]);
    const assistantId = nextId();
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
        setSending(false);
        return;
      }

      const nextConversationId = res.headers.get("X-Conversation-Id");
      if (nextConversationId) setConversationId(nextConversationId);

      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

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
            <div
              key={m.id}
              className={cn(
                "max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "ml-auto bg-accent text-white"
                  : "bg-stone-100 text-ink",
              )}
            >
              {m.content || (m.role === "assistant" && sending ? "…" : "")}
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
