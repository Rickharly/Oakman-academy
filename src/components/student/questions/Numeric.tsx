"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import type { QuestionRendererProps } from "./types";

type Value = { text: string } | undefined;
type Options = { unit?: string; placeholder?: string };
type AnswerKey = { value: number; acceptedStrings?: string[] };

export function Numeric({ question, value, onChange, disabled, result }: QuestionRendererProps) {
  const text = (value as Value)?.text ?? "";
  const opts = question.options as Options | undefined;
  const answerKey = result?.answerKey as AnswerKey | undefined;
  const graded = Boolean(result);

  return (
    <div className="space-y-2">
      <div className="relative max-w-xs">
        <Input
          value={text}
          disabled={disabled}
          inputMode="decimal"
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={opts?.placeholder ?? "Your answer"}
          aria-label={question.prompt}
          className={cn(
            graded &&
              (result?.isCorrect
                ? "border-success bg-success-soft"
                : result?.isCorrect === false
                  ? "border-danger bg-danger-soft"
                  : undefined),
          )}
        />
        {opts?.unit ? (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-muted">{opts.unit}</span>
        ) : null}
        {graded && result?.isCorrect != null && !opts?.unit ? (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
            {result.isCorrect ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <XCircle className="h-5 w-5 text-danger" />
            )}
          </span>
        ) : null}
      </div>
      {graded && result?.isCorrect === false && answerKey ? (
        <p className="text-sm text-ink-muted">
          Correct answer: <span className="font-medium text-ink">{answerKey.value}{opts?.unit ? ` ${opts.unit}` : ""}</span>
        </p>
      ) : null}
    </div>
  );
}
