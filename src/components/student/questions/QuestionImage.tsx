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
export function QuestionImage({
  image,
  questionId,
}: {
  image: { url: string; alt?: string };
  questionId: string;
}) {
  const [failed, setFailed] = useState(false);

  /**
   * Fetched through our own server, not linked straight at the provider.
   *
   * The provider's media can need the API key, which the browser must never hold, and a browser
   * quietly refused shows an empty box with no way to tell why — which is exactly what the
   * children were looking at. Going through us means the key is applied where it belongs and a
   * failure has a status we can report.
   */
  const src = `/api/curriculum/image?question=${encodeURIComponent(questionId)}`;

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
      src={src}
      alt={image.alt ?? "Picture for this question"}
      className="mb-4 max-w-full rounded-xl border border-line bg-white"
      onError={() => setFailed(true)}
    />
  );
}
