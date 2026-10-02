"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Volume2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { deviceVoice, warmUpVoices } from "@/lib/speech/device-voice";

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
  if (!res.ok) throw new Error(res.status === 503 ? "not configured" : "no audio");
  return URL.createObjectURL(await res.blob());
}

export function ReadAloud({ parts, className }: { parts: string[]; className?: string }) {
  const chunks = parts.flatMap(splitForSpeech);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  /**
   * The tablet's own voice, for when the good one is not available.
   *
   * This is the written lesson — several hundred words, and for a nine-year-old the single
   * place where being read to matters most. It has fallen silent three times, every time
   * because of a third-party key, and a silent Learn page is a child staring at prose they
   * cannot get through. The device voice is worse and it is always there.
   */
  const device = useRef(deviceVoice());
  const usingDevice = useRef(false);
  // Object URLs, kept so a child can listen to the lesson twice without paying twice.
  const urls = useRef<Map<number, string>>(new Map());
  const stopped = useRef(false);

  useEffect(() => {
    const cache = urls.current;
    warmUpVoices();
    const voice = device.current;
    return () => {
      audioRef.current?.pause();
      voice.stop();
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

  /**
   * Finishes the lesson with the tablet's voice, from this part onwards.
   *
   * Spoken part by part, in the same order, so pausing and the "Part 3 of 7" counter keep
   * working — a child who switches to the device voice mid-lesson should not notice anything
   * except that it sounds different. Returns false only when the browser has no voice at all.
   */
  async function readRestOnDevice(from: number): Promise<boolean> {
    if (!device.current.supported) return false;
    usingDevice.current = true;

    for (let i = from; i < chunks.length; i += 1) {
      if (stopped.current) return true;
      setIndex(i);
      setState("playing");
      const spoken = await new Promise<boolean>((resolve) => {
        const ok = device.current.speak(chunks[i], {
          onEnd: () => resolve(true),
          onError: () => resolve(false),
        });
        if (!ok) resolve(false);
      });
      if (!spoken) {
        usingDevice.current = false;
        return false;
      }
    }
    setState("idle");
    setIndex(0);
    usingDevice.current = false;
    return true;
  }

  async function playFrom(start: number) {
    stopped.current = false;
    for (let i = start; i < chunks.length; i += 1) {
      if (stopped.current) return;
      setIndex(i);
      let url: string;
      try {
        setState((s) => (s === "playing" || s === "paused" ? s : "loading"));
        url = await urlFor(i);
      } catch {
        /**
         * The good voice is not available. Read it with the tablet's own.
         *
         * This used to stop here with an apology — and before that it removed itself entirely.
         * Both leave a child in front of several hundred words they cannot get through, over a
         * key they have never heard of. The device voice finishes the lesson.
         */
        if (await readRestOnDevice(i)) return;
        setProblem("I can't read this out just now. Tap to try again.");
        setState("idle");
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
        // The file arrived and would not play. The tablet's voice still can.
        if (await readRestOnDevice(i)) return;
        setProblem("That didn't play. Tap to try again.");
        setState("idle");
        return;
      }
    }
    setState("idle");
    setIndex(0);
  }

  /**
   * Pause, not stop.
   *
   * Pausing used to tear the audio down and start the section again from its first word, which
   * is worse than having no pause button at all — a child who stops to look at something loses
   * their place. The element is kept exactly where it is; the sequencing loop is still waiting
   * on this clip to end, so resuming carries on into the next section by itself.
   */
  function pause() {
    if (usingDevice.current) device.current.pause();
    else audioRef.current?.pause();
    setState("paused");
  }

  function resume() {
    if (usingDevice.current) {
      device.current.resume();
      setState("playing");
      return;
    }
    const audio = audioRef.current;
    if (!audio) {
      void playFrom(index);
      return;
    }
    setState("playing");
    audio.play().catch(() => {
      setProblem("That didn't play. Tap to try again.");
      setState("idle");
    });
  }

  // Only ever hidden when there is genuinely nothing to read.
  if (chunks.length === 0) return null;

  const playing = state === "playing";
  const loading = state === "loading";
  const paused = state === "paused";

  function onClick() {
    if (loading) return;
    setProblem(null);
    if (playing) return pause();
    if (paused) return resume();
    void playFrom(index);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <button
        type="button"
        onClick={onClick}
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
        {loading
          ? "Getting ready…"
          : playing
            ? "Pause"
            : paused
              ? "Carry on"
              : index > 0
                ? "Carry on reading"
                : "Read this to me"}
      </button>
      {chunks.length > 1 && (playing || paused || index > 0) ? (
        <span className="text-xs text-ink-muted">
          Part {index + 1} of {chunks.length}
        </span>
      ) : null}
      {problem ? <span className="text-xs text-ink-muted">{problem}</span> : null}
    </div>
  );
}
