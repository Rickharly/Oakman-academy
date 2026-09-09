"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Option, QuestionRendererProps } from "./types";

type Value = { optionIds: string[] } | undefined;
type Options = { choices: Option[] };
type AnswerKey = { correctOptionIds: string[] };

export function MultiSelect({ question, value, onChange, disabled, result }: QuestionRendererProps) {
  const opts = question.options as Options | undefined;
  const choices = opts?.choices ?? [];
  const selectedIds = (value as Value)?.optionIds ?? [];
  const answerKey = result?.answerKey as AnswerKey | undefined;
  const graded = Boolean(result);

  function toggle(id: string) {
    if (disabled) return;
    const next = selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id];
    onChange({ optionIds: next });
  }

  return (
    <div role="group" aria-label={question.prompt} className="space-y-2.5">
      <p className="text-xs text-ink-faint">Select all that apply.</p>
      {choices.map((choice) => {
        const isSelected = selectedIds.includes(choice.id);
        const isCorrectChoice = answerKey?.correctOptionIds.includes(choice.id) ?? false;
        const showCorrect = graded && answerKey != null && isCorrectChoice;
        const showWrong = graded && answerKey != null && isSelected && !isCorrectChoice;
        const showSelectedNoKey = graded && answerKey == null && isSelected;

        return (
          <button
            key={choice.id}
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => toggle(choice.id)}
            className={cn(
              "flex min-h-11 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-base transition-colors duration-150",
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
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                showCorrect
                  ? "border-success bg-success text-white"
                  : showWrong
                    ? "border-danger bg-danger text-white"
                    : isSelected
                      ? "border-accent bg-accent text-white"
                      : "border-line-strong",
              )}
            >
              {showCorrect || (isSelected && !showWrong) ? <Check className="h-3.5 w-3.5" /> : null}
              {showWrong ? <X className="h-3.5 w-3.5" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              {/*
                Some of Oak's answers are pictures, not words. The picture was imported and
                never shown, so a choice whose whole meaning is the image read as a blank —
                or as its alt text, which is a description of the answer rather than the
                answer itself.
              */}
              {choice.image?.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- provider CDN, host not known ahead of time
                <img
                  src={choice.image.url}
                  alt={choice.image.alt ?? choice.text}
                  className="mb-1 max-h-40 rounded-lg border border-line bg-white"
                />
              ) : null}
              {choice.text}
            </span>
          </button>
        );
      })}
    </div>
  );
}
