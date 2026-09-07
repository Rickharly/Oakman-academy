"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import type { QuestionRendererProps } from "./types";

type Value = { text: string } | undefined;
type AnswerKey = { accepted: string[]; modelAnswer?: string };

export function ShortAnswer({ question, value, onChange, disabled, result }: QuestionRendererProps) {
  const text = (value as Value)?.text ?? "";
  const answerKey = result?.answerKey as AnswerKey | undefined;
  const graded = Boolean(result);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={text}
          disabled={disabled}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Type your answer"
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
        {graded && result?.isCorrect != null ? (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
            {result.isCorrect ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <XCircle className="h-5 w-5 text-danger" />
            )}
          </span>
        ) : null}
      </div>
      {graded && result?.isCorrect === false && (answerKey?.modelAnswer || answerKey?.accepted?.length) ? (
        <p className="text-sm text-ink-muted">
          Model answer: <span className="font-medium text-ink">{answerKey.modelAnswer ?? answerKey.accepted[0]}</span>
        </p>
      ) : null}
    </div>
  );
}
