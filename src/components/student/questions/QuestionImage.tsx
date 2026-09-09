"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

/**
 * The picture the question is about.
 *
 * Oak's quiz questions often carry an image — a place value table with a heading missing, a
 * diagram to read off, a number line. It was imported and stored from the very first sync, and
 * never once put on the screen. So a child got "What is the missing place value heading?" with
 * nothing to look at, and no way to know whether something was missing or whether they were
 * supposed to know. That is worse than a broken image: it is a question that quietly cannot be
 * answered, and it teaches a child that they are the thing that is wrong.
 *
 * When it genuinely will not load, that is said plainly rather than left as empty space.
 */
export function QuestionImage({ image }: { image: { url: string; alt?: string } }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft/40 px-3 py-2.5">
        <ImageOff className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p className="text-sm text-ink">
          There should be a picture here and it won&apos;t load.
          {image.alt ? ` It shows: ${image.alt}.` : ""} Ask your teacher — she can describe it.
        </p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- the provider's own CDN, on hosts we
    // do not control and cannot list ahead of time in next.config; an optimiser that refuses an
    // unknown host would take the picture away again, which is the bug being fixed.
    // Deliberately unconstrained in height: a place value table cropped to a thumbnail is as
    // unanswerable as no picture at all.
    <img
      src={image.url}
      alt={image.alt ?? "Picture for this question"}
      className="mb-4 max-w-full rounded-xl border border-line bg-white"
      onError={() => setFailed(true)}
    />
  );
}
