"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Volume2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Reads a whole written lesson aloud, in order.
 *
 * `SpeakButton` reads one short reply; a lesson is several hundred words and past the limit of
 * a single request. So the lesson arrives as its natural parts — the intro, each section, the
 * worked example — and they are spoken one after another, fetched one ahead so there is no gap
 * between them.
 *
 * Being able to stop matters as much as being able to start: a child who wants to re-read a
 * sentence should not have to listen to the rest of the lesson to do it.
 */

/** The speak endpoint's limit. Longer parts are split on sentence ends, never mid-word. */
const MAX_CHARS = 2200;

function splitForSpeech(part: string): string[] {
  const text = part.trim();
  if (text.length <= MAX_CHARS) return text ? [text] : [];

  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current.length + sentence.length > MAX_CHARS && current) {
      chunks.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function fetchSpeech(text: string): Promise<string> {
  const res = await fetch("/api/teacher/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("no audio");
  return URL.createObjectURL(await res.blob());
}

export function ReadAloud({ parts, className }: { parts: string[]; className?: string }) {
  const chunks = parts.flatMap(splitForSpeech);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "unavailable">("idle");
  const [index, setIndex] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Object URLs, kept so a child can listen to the lesson twice without paying twice.
  const urls = useRef<Map<number, string>>(new Map());
  const stopped = useRef(false);

  useEffect(() => {
    const cache = urls.current;
    return () => {
      audioRef.current?.pause();
      stopped.current = true;
      for (const url of cache.values()) URL.revokeObjectURL(url);
    };
  }, []);

  async function urlFor(i: number): Promise<string> {
    const cached = urls.current.get(i);
    if (cached) return cached;
    const url = await fetchSpeech(chunks[i]);
    urls.current.set(i, url);
    return url;
  }

  /** Fetches the next part while this one plays, so the lesson does not stop between sentences. */
  function prefetch(i: number) {
    if (i >= chunks.length || urls.current.has(i)) return;
    void urlFor(i).catch(() => undefined);
  }

  async function playFrom(start: number) {
    stopped.current = false;
    for (let i = start; i < chunks.length; i += 1) {
      if (stopped.current) return;
      setIndex(i);
      let url: string;
      try {
        setState((s) => (s === "playing" ? s : "loading"));
        url = await urlFor(i);
      } catch {
        // No key, no credit, no network. The lesson is on the screen already, so this goes
        // quiet rather than putting an error in front of a child.
        setState("unavailable");
        return;
      }
      if (stopped.current) return;

      const audio = new Audio(url);
      audioRef.current = audio;
      setState("playing");
      prefetch(i + 1);

      const finished = await new Promise<boolean>((resolve) => {
        audio.onended = () => resolve(true);
        audio.onerror = () => resolve(false);
        audio.play().catch(() => resolve(false));
      });
      if (!finished) {
        setState("unavailable");
        return;
      }
    }
    setState("idle");
    setIndex(0);
  }

  function stop() {
    stopped.current = true;
    audioRef.current?.pause();
    setState("idle");
  }

  if (chunks.length === 0 || state === "unavailable") return null;

  const playing = state === "playing";
  const loading = state === "loading";

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <button
        type="button"
        onClick={() => (playing || loading ? stop() : void playFrom(index))}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-150",
          playing || loading
            ? "bg-accent text-white hover:bg-accent-hover"
            : "border border-line bg-surface-raised text-ink hover:border-accent hover:text-accent-ink",
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
        {loading ? "Getting ready…" : playing ? "Pause" : index > 0 ? "Carry on reading" : "Read this to me"}
      </button>
      {chunks.length > 1 && (playing || index > 0) ? (
        <span className="text-xs text-ink-muted">
          Part {index + 1} of {chunks.length}
        </span>
      ) : null}
    </div>
  );
}
