"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { QuestionRendererProps } from "./types";

type Value = { value: boolean } | undefined;
type AnswerKey = { value: boolean };

export function TrueFalse({ question, value, onChange, disabled, result }: QuestionRendererProps) {
  const selected = (value as Value)?.value;
  const answerKey = result?.answerKey as AnswerKey | undefined;
  const graded = Boolean(result);

  const options: { label: string; val: boolean }[] = [
    { label: "True", val: true },
    { label: "False", val: false },
  ];

  return (
    <div role="radiogroup" aria-label={question.prompt} className="grid grid-cols-2 gap-3">
      {options.map((opt) => {
        const isSelected = selected === opt.val;
        const isCorrectChoice = answerKey?.value === opt.val;
        const showCorrect = graded && answerKey != null && isCorrectChoice;
        const showWrong = graded && answerKey != null && isSelected && !isCorrectChoice;
        const showSelectedNoKey = graded && answerKey == null && isSelected;

        return (
          <button
            key={opt.label}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange({ value: opt.val })}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-base font-medium transition-colors duration-150",
              "disabled:pointer-events-none",
              showCorrect
                ? "border-success bg-success-soft text-success"
                : showWrong
                  ? "border-danger bg-danger-soft text-danger"
                  : isSelected || showSelectedNoKey
                    ? "border-accent bg-accent-soft text-accent-ink"
                    : "border-line bg-surface-raised text-ink hover:border-line-strong",
            )}
          >
            {showCorrect ? <Check className="h-4 w-4" /> : showWrong ? <X className="h-4 w-4" /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
