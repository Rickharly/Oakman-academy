"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import { deviceVoice, warmUpVoices } from "@/lib/speech/device-voice";

/**
 * Set once the speak route reports it isn't configured at all (503, no ELEVENLABS_API_KEY).
 * A fact about the server, true for every button for the rest of this tab — so the others skip
 * a request that cannot succeed and go straight to the tablet's own voice.
 */
let serverVoiceWorks = true;

/**
 * Reads a piece of the teacher's writing aloud.
 *
 * For a younger child especially, listening beats reading a wall of text — they can keep their
 * eyes on the working while the explanation happens.
 *
 * Two voices, in order: the good one from the server, and the one built into the tablet when
 * that is not available. This used to be the paid voice or nothing, and "nothing" meant the
 * button removed itself — so a feature Eva relies on disappeared three times, each time
 * because of a key she has never heard of. The device voice is worse and it is always there,
 * which for a child alone with four hundred words is the trade worth making every time.
 */
export function SpeakButton({ text, autoPlay = false }: { text: string; autoPlay?: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const played = useRef(false);
  const device = useRef(deviceVoice());

  useEffect(() => {
    warmUpVoices();
    const audio = audioRef.current;
    const url = urlRef.current;
    const voice = device.current;
    return () => {
      audio?.pause();
      voice.stop();
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  /** The tablet's own voice. Returns false only when the browser has none at all. */
  function speakOnDevice(): boolean {
    const started = device.current.speak(text, {
      onEnd: () => setState("idle"),
      onError: () => {
        setProblem("That didn't play. Tap to try again.");
        setState("idle");
      },
    });
    if (started) setState("playing");
    return started;
  }

  async function play() {
    if (state === "loading") return;
    if (state === "playing") {
      audioRef.current?.pause();
      device.current.stop();
      setState("idle");
      return;
    }

    // Already fetched once: replay without spending another request.
    if (urlRef.current && audioRef.current) {
      void audioRef.current.play();
      setState("playing");
      return;
    }

    // The server's voice is known not to work this session — skip straight to the tablet's.
    if (!serverVoiceWorks) {
      if (!speakOnDevice()) setProblem("This tablet can't read out loud.");
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
        /**
         * The good voice is not available. Use the other one.
         *
         * A 503 means nobody has configured a key, or the key has lost the permission it needs
         * — both true for the whole family, not for this sentence. Either way it is not a
         * reason to stop reading to a child, and it was: the button used to hide itself here.
         */
        if (res.status === 503) serverVoiceWorks = false;
        if (!speakOnDevice()) {
          const detail = await res.json().catch(() => null);
          setProblem(
            typeof detail?.error === "string" ? detail.error : "I can't read that out just now.",
          );
          setState("idle");
        }
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setState("idle");
      audio.onerror = () => {
        // The file arrived and will not play — the tablet's voice still can.
        if (!speakOnDevice()) {
          setProblem("That didn't play. Tap to try again.");
          setState("idle");
        }
      };
      await audio.play();
      setState("playing");
    } catch (err) {
      // A browser that hasn't been tapped yet refuses the very first `play()` with
      // NotAllowedError — that is autoplay policy working as designed, not a broken voice, and
      // a tap right afterwards plays it fine. Stay quietly idle, as if autoPlay had never been
      // asked for.
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setState("idle");
        return;
      }
      // Network gone, server down: the tablet's voice needs neither.
      if (!speakOnDevice()) {
        setProblem("I couldn't reach my voice. Tap to try again.");
        setState("idle");
      }
    }
  }

  useEffect(() => {
    // Autoplay is best-effort: browsers block sound until the child has interacted with the
    // page, and a blocked play must not look like a broken button.
    if (!autoPlay || played.current || !text.trim()) return;
    played.current = true;
    void play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, text]);

  // Hidden only when there is genuinely nothing to read. Never hidden for a server problem:
  // that is what the device voice is for, and a vanishing button is unreportable.
  if (!text.trim()) return null;

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
