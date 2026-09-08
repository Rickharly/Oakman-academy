"use client";

import { useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import type { VoiceOption } from "@/lib/ai/voice";

/**
 * Choosing the teacher's voice for one child.
 *
 * The preview matters more than it looks: picking a voice for your daughter's teacher from a
 * list of names is guesswork, and getting it wrong is the kind of thing a child notices
 * immediately and mentions for weeks.
 */
export function VoicePicker({
  name,
  voices,
  defaultValue,
  fromAccount,
  problem,
}: {
  name: string;
  voices: VoiceOption[];
  defaultValue: string | null;
  fromAccount: boolean;
  /** Why the list is the fallback rather than the family's own voices. */
  problem?: string | null;
}) {
  const [voiceId, setVoiceId] = useState(defaultValue ?? "");
  // A voice already set that is not in the list — a pasted id, or one the API did not return.
  const known = voices.some((v) => v.id === (defaultValue ?? ""));
  const [custom, setCustom] = useState(Boolean(defaultValue) && !known);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function preview() {
    if (!voiceId || state === "loading") return;
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/admin/voice-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not play that voice.");
      }
      const audio = new Audio(URL.createObjectURL(await res.blob()));
      audio.onended = () => setState("idle");
      await audio.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not play that voice.");
      setState("error");
      return;
    }
    setState("idle");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        {custom ? (
          // Whatever the API does, a voice id pasted from the ElevenLabs dashboard always works.
          <input
            name={name}
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value.trim())}
            placeholder="Paste a voice ID from ElevenLabs"
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-raised px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        ) : (
          <select
            name={name}
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-raised px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          >
            <option value="">Default</option>
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
                {v.description ? ` — ${v.description}` : ""}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => void preview()}
          disabled={!voiceId || state === "loading"}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-medium text-ink transition-colors duration-150 hover:bg-stone-100 disabled:opacity-50"
        >
          {state === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
          Hear it
        </button>
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}

      <button
        type="button"
        onClick={() => setCustom((v) => !v)}
        className="text-xs font-medium text-accent underline-offset-4 hover:underline"
      >
        {custom ? "Choose from the list instead" : "Paste a voice ID instead"}
      </button>

      {!fromAccount ? (
        <p className="text-xs text-warning">
          These are stock voices, not yours.{" "}
          {problem ? `Reason: ${problem}.` : ""} Paste the voice ID from your ElevenLabs
          dashboard and it will work regardless.
        </p>
      ) : null}
    </div>
  );
}
