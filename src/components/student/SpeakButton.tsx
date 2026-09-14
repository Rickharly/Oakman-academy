"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Volume2, VolumeX } from "lucide-react";

/**
 * Set once the speak route reports it isn't configured at all (503, no ELEVENLABS_API_KEY) —
 * a fact about the server, not this one reply, and true for every SpeakButton for the rest of
 * this tab. Module-scope like `draftSaveTimers` elsewhere: every reply gets its own component
 * instance, and without this each one would show the child the same server-config sentence in
 * turn instead of the button just quietly not being there.
 */
let voiceConfigured = true;

/**
 * Reads a piece of the teacher's writing aloud.
 *
 * For a younger child especially, listening beats reading a wall of text — they can keep their
 * eyes on the working while the explanation happens. The words stay on screen either way: the
 * voice is an addition to the teaching, never the only copy of it, so a failure here is quiet
 * and the lesson carries on.
 */
export function SpeakButton({ text, autoPlay = false }: { text: string; autoPlay?: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "unavailable">(
    voiceConfigured ? "idle" : "unavailable",
  );
  const [problem, setProblem] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const played = useRef(false);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  async function play() {
    if (state === "loading") return;
    if (state === "playing") {
      audioRef.current?.pause();
      setState("idle");
      return;
    }

    // Already fetched once: replay without spending another request.
    if (urlRef.current && audioRef.current) {
      void audioRef.current.play();
      setState("playing");
      return;
    }

    setState("loading");
    setProblem(null);
    try {
      const res = await fetch("/api/teacher/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        if (res.status === 503) {
          // Not this reply's problem — nobody has set an ElevenLabs key up for the family at
          // all, and the body is a sentence written for whoever configures the server, not for
          // a child ("No ELEVENLABS_API_KEY is set on the server."). Stop asking, and stop
          // showing a button for a feature that cannot work this session.
          voiceConfigured = false;
          setState("unavailable");
          return;
        }
        /**
         * Say so. Do not vanish.
         *
         * This used to hide the button the moment a request failed, on the reasoning that a
         * child should not be nagged. What it actually did was make a feature Eva relies on
         * disappear mid-lesson with no explanation and no way to try again — she could not even
         * tell anyone what had gone, only that it was gone. A quiet button that admits it is
         * having trouble is far kinder than one that silently deletes itself.
         */
        const detail = await res.json().catch(() => null);
        setProblem(typeof detail?.error === "string" ? detail.error : "I can't read that out just now.");
        setState("idle");
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setState("idle");
      audio.onerror = () => {
        setProblem("That didn't play. Tap to try again.");
        setState("idle");
      };
      await audio.play();
      setState("playing");
    } catch (err) {
      // An iPad that hasn't been tapped yet refuses the very first `play()` with
      // NotAllowedError — that is autoplay policy working as designed, not a broken voice, and
      // a tap right afterwards plays it fine. Saying "I couldn't reach my voice" over something
      // a tap immediately fixes reads as a failure that never happened; stay quietly idle
      // instead, exactly as if autoPlay had never been asked for.
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setState("idle");
        return;
      }
      setProblem("I couldn't reach my voice. Tap to try again.");
      setState("idle");
    }
  }

  useEffect(() => {
    // Autoplay is best-effort: browsers block sound until the child has interacted with the
    // page, and a blocked play must not look like a broken button.
    if (!autoPlay || played.current || !text.trim() || !voiceConfigured) return;
    played.current = true;
    void play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, text]);

  // Hidden when there is nothing to read, and quietly hidden once we know the voice isn't
  // configured at all — that is a fact about the server, not a per-reply error to surface.
  if (!text.trim() || state === "unavailable") return null;

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
    <button
      type="button"
      onClick={() => void play()}
      className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-ink-muted transition-colors duration-150 hover:bg-stone-100 hover:text-ink"
      aria-label={state === "playing" ? "Stop reading aloud" : "Read this aloud"}
    >
      {state === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === "playing" ? (
        <VolumeX className="h-3.5 w-3.5" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
      {state === "playing" ? "Stop" : "Listen"}
    </button>
      {problem ? <span className="px-2.5 text-xs text-ink-muted">{problem}</span> : null}
    </div>
  );
}
