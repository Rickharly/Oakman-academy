/**
 * The voice already inside the tablet.
 *
 * Reading aloud has broken three times now, and every time for the same reason: it depended
 * entirely on a third-party key. A key with the wrong permission, an expired key, a 503 — and a
 * child who needs a wall of text read to them has nothing. Worse, the button hid itself on a
 * 503, so the feature did not degrade, it vanished, and nobody could even say what was missing.
 *
 * Every browser these children use — Safari on the iPad, Chrome on the Chromebook — has had
 * speech synthesis built in for a decade. It is free, needs no key, works with the network
 * down, and is nobody's to switch off. It is not as good as the paid voice, which is why it is
 * the fallback rather than the default. But "not as good" beats silence by a distance that is
 * hard to overstate when the alternative is a nine-year-old alone with four hundred words.
 */

export interface DeviceSpeech {
  /** True when the browser can do this at all. */
  supported: boolean;
  speak(text: string, opts?: { onEnd?: () => void; onError?: () => void }): boolean;
  stop(): void;
  pause(): void;
  resume(): void;
}

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

/**
 * A voice that sounds like a person reading to a child, where the device has one.
 *
 * Browsers ship a pile of voices of wildly varying quality. The enhanced/premium ones are
 * markedly better and are what a reader actually wants; after that, any voice in the page's
 * language beats the default, which on some devices is a robot.
 */
function pickVoice(s: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = s.getVoices();
  if (voices.length === 0) return null;

  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = english.length > 0 ? english : voices;

  const nice =
    pool.find((v) => /enhanced|premium|natural|siri/i.test(v.name)) ??
    // UK English first: these are UK lessons, and the spelling and vocabulary are UK.
    pool.find((v) => v.lang.toLowerCase() === "en-gb") ??
    pool.find((v) => v.default) ??
    pool[0];
  return nice ?? null;
}

export function deviceVoice(): DeviceSpeech {
  const s = synth();
  if (!s || typeof SpeechSynthesisUtterance === "undefined") {
    return {
      supported: false,
      speak: () => false,
      stop: () => undefined,
      pause: () => undefined,
      resume: () => undefined,
    };
  }

  return {
    supported: true,

    speak(text, opts) {
      const trimmed = text.trim();
      if (!trimmed) return false;
      try {
        // Anything already queued is this component's own earlier request; a second tap means
        // "read this instead", never "read both at once".
        s.cancel();

        const utterance = new SpeechSynthesisUtterance(trimmed);
        const voice = pickVoice(s);
        if (voice) utterance.voice = voice;
        utterance.lang = voice?.lang ?? "en-GB";
        // Slightly under normal pace: this is being read to a child who is following along.
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.onend = () => opts?.onEnd?.();
        utterance.onerror = () => opts?.onError?.();
        s.speak(utterance);
        return true;
      } catch {
        return false;
      }
    },

    stop() {
      try {
        s.cancel();
      } catch {
        // Nothing to do; the page is closing or the engine is already gone.
      }
    },

    pause() {
      try {
        s.pause();
      } catch {
        // As above.
      }
    },

    resume() {
      try {
        s.resume();
      } catch {
        // As above.
      }
    },
  };
}

/**
 * Voices load asynchronously in some browsers, so the first `getVoices()` can be empty.
 *
 * Called once when a page that offers reading aloud mounts, so that by the time a child presses
 * the button there is a real voice to choose rather than the default robot.
 */
export function warmUpVoices(): void {
  const s = synth();
  if (!s) return;
  try {
    s.getVoices();
    // Safari only populates the list after this event, and only if something is listening.
    s.addEventListener?.("voiceschanged", () => s.getVoices(), { once: true });
  } catch {
    // Not worth a line of UI.
  }
}
