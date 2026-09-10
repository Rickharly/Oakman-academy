/**
 * A question as a child should see it.
 *
 * The stored question is the record: the provider's words, the provider's notation, untouched.
 * What goes on the screen is that record made legible — LaTeX turned into the symbols people
 * write, markdown nobody renders taken out. See `src/lib/text/maths.ts` for why.
 *
 * Only the parts that are read: the prompt, an option's text, its alt text, a placeholder. Ids
 * are what an answer is matched against and images are addresses, and neither is prose.
 */
import { plainMaths } from "@/lib/text/maths";

function plainOption(option: Record<string, unknown>): Record<string, unknown> {
  const out = { ...option };
  if (typeof out.text === "string") out.text = plainMaths(out.text);
  const image = out.image as Record<string, unknown> | undefined;
  if (image && typeof image.alt === "string") out.image = { ...image, alt: plainMaths(image.alt) };
  return out;
}

/** Every option list we show — choices, both sides of a matching, ordering items. */
export function plainOptions(options: unknown): unknown {
  if (!options || typeof options !== "object" || Array.isArray(options)) return options;
  const out: Record<string, unknown> = { ...(options as Record<string, unknown>) };

  for (const key of ["choices", "left", "right", "items"]) {
    const list = out[key];
    if (!Array.isArray(list)) continue;
    out[key] = list.map((item) =>
      item && typeof item === "object" ? plainOption(item as Record<string, unknown>) : item,
    );
  }
  for (const key of ["placeholder", "unit"]) {
    if (typeof out[key] === "string") out[key] = plainMaths(out[key] as string);
  }
  return out;
}

/** The whole question, ready to read. Keeps every other field exactly as it is. */
export function plainQuestion<T extends { prompt: string; options?: unknown; promptImage?: unknown }>(question: T): T {
  const promptImage = question.promptImage as Record<string, unknown> | null | undefined;
  return {
    ...question,
    prompt: plainMaths(question.prompt),
    ...(question.options !== undefined ? { options: plainOptions(question.options) } : {}),
    ...(promptImage && typeof promptImage.alt === "string"
      ? { promptImage: { ...promptImage, alt: plainMaths(promptImage.alt) } }
      : {}),
  };
}
