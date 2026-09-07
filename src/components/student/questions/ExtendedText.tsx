"use client";

import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import type { QuestionRendererProps } from "./types";

type Value = { text: string } | undefined;
type Options = { placeholder?: string; minWords?: number; maxWords?: number };
type AnswerKey = { modelAnswer?: string; keyPoints?: string[] };

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

export function ExtendedText({ question, value, onChange, disabled, result }: QuestionRendererProps) {
  const text = (value as Value)?.text ?? "";
  const opts = question.options as Options | undefined;
  const answerKey = result?.answerKey as AnswerKey | undefined;
  const graded = Boolean(result);
  const count = wordCount(text);

  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        disabled={disabled}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder={opts?.placeholder ?? "Write your answer"}
        aria-label={question.prompt}
        rows={6}
        className={cn(
          graded &&
            (result?.isCorrect
              ? "border-success bg-success-soft"
              : result?.isCorrect === false
                ? "border-warning bg-warning-soft"
                : undefined),
        )}
      />
      <div className="flex items-center justify-between text-xs text-ink-faint">
        <span>
          {count} word{count === 1 ? "" : "s"}
          {opts?.minWords ? ` · aim for at least ${opts.minWords}` : ""}
        </span>
      </div>
      {graded && result?.feedback ? (
        <p className="text-sm text-ink-muted">{result.feedback}</p>
      ) : null}
      {graded && answerKey?.keyPoints?.length ? (
        <div className="rounded-xl bg-stone-50 p-3 text-sm text-ink-muted">
          <p className="mb-1 font-medium text-ink">Key points to include</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {answerKey.keyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
