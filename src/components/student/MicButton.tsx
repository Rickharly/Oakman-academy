"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";

/**
 * Talking to the teacher instead of typing at her.
 *
 * For a nine year old, typing is a tax on thinking: a question they would ask out loud in a
 * second takes a minute to peck out, so they stop asking. Holding a button and speaking costs
 * nothing, which is the point.
 *
 * The recording is sent, transcribed and discarded — only the words go anywhere, and those
 * were always going to be in the conversation.
 */
export function MicButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<"idle" | "recording" | "thinking" | "unavailable">("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0) {
          setState("idle");
          return;
        }

        setState("thinking");
        try {
          const form = new FormData();
          form.append("audio", blob, "speech.webm");
          const res = await fetch("/api/teacher/listen", { method: "POST", body: form });
          const data = (await res.json()) as { text?: string; error?: string };
          if (!res.ok || !data.text) throw new Error(data.error ?? "I didn't catch that.");
          onTranscript(data.text);
          setState("idle");
        } catch (err) {
          setError(err instanceof Error ? err.message : "I didn't catch that.");
          setState("idle");
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      setState("recording");
    } catch {
      // No microphone, or permission refused. Typing still works, so say nothing further.
      setState("unavailable");
    }
  }, [onTranscript]);

  if (state === "unavailable") return null;

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => (state === "recording" ? stop() : void start())}
        disabled={disabled || state === "thinking"}
        aria-label={state === "recording" ? "Stop recording" : "Speak to your teacher"}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:opacity-50 ${
          state === "recording"
            ? "bg-danger text-white"
            : "border border-line text-ink-muted hover:bg-stone-100 hover:text-ink"
        }`}
      >
        {state === "thinking" ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : state === "recording" ? (
          <Square className="h-4 w-4 fill-current" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </button>
      {state === "recording" ? (
        <span className="mt-0.5 text-[10px] font-medium text-danger">Listening…</span>
      ) : null}
      {error ? <span className="mt-0.5 max-w-24 text-[10px] text-danger">{error}</span> : null}
    </div>
  );
}
