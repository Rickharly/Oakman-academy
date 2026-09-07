"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Avatar = { username: string; displayName: string; avatar: string | null };

const PIN_PAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 6;

export function StudentLoginClient({ avatars }: { avatars: Avatar[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Avatar | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function selectAvatar(avatar: Avatar) {
    setSelected(avatar);
    setPin("");
    setError(null);
  }

  function reset() {
    setSelected(null);
    setPin("");
    setError(null);
    setSubmitting(false);
  }

  function pressDigit(digit: string) {
    if (submitting || pin.length >= MAX_PIN_LENGTH) return;
    setError(null);
    setPin((p) => (p + digit).slice(0, MAX_PIN_LENGTH));
  }

  function backspace() {
    if (submitting) return;
    setError(null);
    setPin((p) => p.slice(0, -1));
  }

  async function confirm() {
    if (!selected || pin.length < MIN_PIN_LENGTH || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/student-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: selected.username, pin }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !data?.ok) {
        setError("That PIN didn't work. Try again.");
        setPin("");
        setSubmitting(false);
        return;
      }
      router.push("/today");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setPin("");
      setSubmitting(false);
    }
  }

  if (!selected) {
    return (
      <div>
        <h1 className="text-center text-xl font-semibold text-stone-900">Who&apos;s learning today?</h1>
        <p className="mt-1 text-center text-sm text-stone-500">Tap your avatar to sign in.</p>

        {avatars.length === 0 ? (
          <p className="mt-8 text-center text-sm text-stone-500">
            No student accounts yet. Ask a parent to add one.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {avatars.map((a) => (
              <button
                key={a.username}
                type="button"
                onClick={() => selectAvatar(a)}
                className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 p-4 transition-colors hover:border-stone-300 hover:bg-white active:scale-[0.98]"
              >
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-sm"
                  aria-hidden
                >
                  {a.avatar ?? "🙂"}
                </span>
                <span className="text-sm font-medium text-stone-800">{a.displayName}</span>
              </button>
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-sm text-stone-500">
          Parent?{" "}
          <Link href="/login" className="font-medium text-stone-700 underline underline-offset-2">
            Parent login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={reset} className="text-sm font-medium text-stone-500 hover:text-stone-700">
        ← Back
      </button>

      <div className="mt-4 flex flex-col items-center">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-50 text-3xl shadow-sm"
          aria-hidden
        >
          {selected.avatar ?? "🙂"}
        </span>
        <h1 className="mt-3 text-lg font-semibold text-stone-900">{selected.displayName}</h1>
        <p className="mt-1 text-sm text-stone-500">Enter your PIN</p>
      </div>

      <div className="mt-6 flex justify-center gap-3" aria-live="polite" aria-label="PIN entered">
        {Array.from({ length: MAX_PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border border-stone-300 ${
              i < pin.length ? "bg-stone-800" : "bg-transparent"
            }`}
          />
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-center text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-3 gap-3">
        {PIN_PAD_DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            inputMode="numeric"
            onClick={() => pressDigit(d)}
            disabled={submitting}
            className="h-16 rounded-2xl border border-stone-200 bg-stone-50 text-2xl font-medium text-stone-800 transition-colors hover:bg-white active:scale-[0.98] disabled:opacity-50"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={backspace}
          disabled={submitting}
          className="h-16 rounded-2xl border border-stone-200 bg-stone-50 text-sm font-medium text-stone-600 transition-colors hover:bg-white active:scale-[0.98] disabled:opacity-50"
        >
          Delete
        </button>
        <button
          type="button"
          inputMode="numeric"
          onClick={() => pressDigit("0")}
          disabled={submitting}
          className="h-16 rounded-2xl border border-stone-200 bg-stone-50 text-2xl font-medium text-stone-800 transition-colors hover:bg-white active:scale-[0.98] disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={submitting || pin.length < MIN_PIN_LENGTH}
          className="h-16 rounded-2xl bg-stone-900 text-sm font-medium text-white transition-colors hover:bg-stone-800 active:scale-[0.98] disabled:opacity-50"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
