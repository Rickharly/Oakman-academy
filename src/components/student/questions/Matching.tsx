"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Option, QuestionRendererProps } from "./types";

type Pair = { leftId: string; rightId: string };
type Value = { pairs: Pair[] } | undefined;
type Options = { left: Option[]; right: Option[] };
type AnswerKey = { pairs: Pair[] };

/** Tap a left item, then tap a right item to pair them. Tap a paired item to unpair it. */
export function Matching({ question, value, onChange, disabled, result }: QuestionRendererProps) {
  const opts = question.options as Options | undefined;
  const left = opts?.left ?? [];
  const right = opts?.right ?? [];
  const pairs = (value as Value)?.pairs ?? [];
  const answerKey = result?.answerKey as AnswerKey | undefined;
  const graded = Boolean(result);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);

  const pairForLeft = (leftId: string) => pairs.find((p) => p.leftId === leftId);
  const pairForRight = (rightId: string) => pairs.find((p) => p.rightId === rightId);

  function tapLeft(leftId: string) {
    if (disabled) return;
    const existing = pairForLeft(leftId);
    if (existing) {
      onChange({ pairs: pairs.filter((p) => p.leftId !== leftId) });
      setSelectedLeft(null);
      return;
    }
    setSelectedLeft((cur) => (cur === leftId ? null : leftId));
  }

  function tapRight(rightId: string) {
    if (disabled) return;
    const existingForRight = pairForRight(rightId);
    if (existingForRight) {
      onChange({ pairs: pairs.filter((p) => p.rightId !== rightId) });
      return;
    }
    if (!selectedLeft) return;
    const next = pairs.filter((p) => p.leftId !== selectedLeft);
    next.push({ leftId: selectedLeft, rightId });
    onChange({ pairs: next });
    setSelectedLeft(null);
  }

  function correctness(leftId: string): "correct" | "wrong" | null {
    if (!graded || !answerKey) return null;
    const paired = pairForLeft(leftId);
    if (!paired) return null;
    const correctRightId = answerKey.pairs.find((p) => p.leftId === leftId)?.rightId;
    return paired.rightId === correctRightId ? "correct" : "wrong";
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-faint">Tap an item on the left, then its match on the right.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {left.map((item) => {
            const paired = pairForLeft(item.id);
            const isSelected = selectedLeft === item.id;
            const state = correctness(item.id);
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => tapLeft(item.id)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors duration-150",
                  "disabled:pointer-events-none",
                  state === "correct"
                    ? "border-success bg-success-soft text-success"
                    : state === "wrong"
                      ? "border-danger bg-danger-soft text-danger"
                      : isSelected
                        ? "border-accent bg-accent-soft text-accent-ink"
                        : paired
                          ? "border-line-strong bg-stone-50 text-ink"
                          : "border-line bg-surface-raised text-ink hover:border-line-strong",
                )}
              >
                {state === "correct" ? <Check className="h-4 w-4 shrink-0" /> : null}
                {state === "wrong" ? <X className="h-4 w-4 shrink-0" /> : null}
                <span className="min-w-0 flex-1">{item.text}</span>
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {right.map((item) => {
            const paired = pairForRight(item.id);
            const pairedLeft = paired ? left.find((l) => l.id === paired.leftId) : undefined;
            const state = pairedLeft ? correctness(pairedLeft.id) : null;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => tapRight(item.id)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors duration-150",
                  "disabled:pointer-events-none",
                  state === "correct"
                    ? "border-success bg-success-soft text-success"
                    : state === "wrong"
                      ? "border-danger bg-danger-soft text-danger"
                      : paired
                        ? "border-line-strong bg-stone-50 text-ink"
                        : "border-line bg-surface-raised text-ink hover:border-line-strong",
                )}
              >
                <span className="min-w-0 flex-1">{item.text}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
