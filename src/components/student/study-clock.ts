"use client";

/**
 * Is this child actually studying right now?
 *
 * "They finish all lessons in like two hours … it should take them four hours of real
 * studies." A clock that runs whenever the page is open counts a child staring out of the
 * window as a child studying, and a period they sat out on an idle screen was a period served.
 *
 * A second counts when the page is on screen AND one of these is true:
 * - they touched, typed or scrolled in the last `IDLE_AFTER_MS`;
 * - a video or audio is playing (watching a lesson needs no taps);
 * - the device is reading the lesson aloud to them.
 *
 * One listener set for the whole page, shared by the visible timer and the player's period
 * clock, so the two can never disagree about how much time is left.
 */
export const IDLE_AFTER_MS = 120_000;

let lastInteraction = Date.now();
let installed = false;

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const touch = () => {
    lastInteraction = Date.now();
  };
  for (const name of ["pointerdown", "keydown", "scroll", "touchstart", "input", "wheel"]) {
    window.addEventListener(name, touch, { passive: true, capture: true });
  }
}

function mediaPlaying(): boolean {
  if (typeof document === "undefined") return false;
  for (const el of Array.from(document.querySelectorAll("video, audio"))) {
    const media = el as HTMLMediaElement;
    if (!media.paused && !media.ended && media.readyState > 2) return true;
  }
  return false;
}

function beingReadTo(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.speaking;
}

/** True when this second is real study time. */
export function isStudyingNow(): boolean {
  install();
  if (typeof document === "undefined" || document.hidden) return false;
  if (Date.now() - lastInteraction <= IDLE_AFTER_MS) return true;
  return mediaPlaying() || beingReadTo();
}

/** Call on mount so the very first interactions are seen. */
export function startStudyClock(): void {
  install();
}
