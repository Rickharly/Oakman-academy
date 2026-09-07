"use client";

import { useEffect } from "react";
import { ArrowDown, ArrowUp, Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Option, QuestionRendererProps } from "./types";

type Value = { order: string[] } | undefined;
type Options = { items: Option[] };
type AnswerKey = { order: string[] };

/** Up/down arrow buttons to reorder — no drag-and-drop, works on touch. */
export function Ordering({ question, value, onChange, disabled, result }: QuestionRendererProps) {
  const opts = question.options as Options | undefined;
  const items = opts?.items ?? [];
  const itemById = new Map(items.map((i) => [i.id, i]));
  const order = (value as Value)?.order ?? items.map((i) => i.id);
  const answerKey = result?.answerKey as AnswerKey | undefined;
  const graded = Boolean(result);

  // Persist the initial (unordered) draft so a submit without any moves still has a value.
  useEffect(() => {
    if (!value) onChange({ order: items.map((i) => i.id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function move(index: number, dir: -1 | 1) {
    if (disabled) return;
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ order: next });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-faint">Use the arrows to put these in the right order.</p>
      <ol className="space-y-2">
        {order.map((id, index) => {
          const item = itemById.get(id);
          if (!item) return null;
          const isCorrectPosition = graded && answerKey ? answerKey.order[index] === id : null;

          return (
            <li
              key={id}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors duration-150",
                graded && answerKey
                  ? isCorrectPosition
                    ? "border-success bg-success-soft text-success"
                    : "border-danger bg-danger-soft text-danger"
                  : "border-line bg-surface-raised text-ink",
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-ink-muted">
                {index + 1}
              </span>
              {graded && answerKey ? (
                isCorrectPosition ? <Check className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />
              ) : null}
              <span className="min-w-0 flex-1">{item.text}</span>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Move "${item.text}" up`}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 hover:bg-stone-100 disabled:pointer-events-none disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={disabled || index === order.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Move "${item.text}" down`}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 hover:bg-stone-100 disabled:pointer-events-none disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
