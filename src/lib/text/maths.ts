/**
 * Maths a child can read.
 *
 * Oak's maths material and the models that write lessons both speak LaTeX, and none of it is
 * rendered anywhere: a fraction arrives on a nine-year-old's screen as `$$\frac{3}{4}$$`. Eva
 * reported this herself, with examples — dollar signs everywhere and the text "messed up" —
 * which is exactly right. The maths is not wrong; it is written in a notation nothing on the
 * page knows how to draw, so it reads as gibberish and the child assumes the mistake is theirs.
 *
 * A maths typesetter would be the grand answer. This is the useful one: turn the notation into
 * the plain symbols people actually write — ¾, ×, ≤, x², √9 — so it is legible on the screen
 * and sayable out loud, which a rendered formula never is. Everything unknown loses its
 * backslash and braces rather than being printed as code.
 *
 * Applied where content reaches a child, not where it is stored: the provider's text and a
 * model's reply are what they are, and re-writing the record to fix the display is how you lose
 * the original.
 */

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};
const SUBSCRIPT: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
};

/** One-for-one symbol swaps. Longest first, so `\leqslant` is not eaten by `\le`. */
const SYMBOLS: [RegExp, string][] = [
  [/\\times\b/g, "×"],
  [/\\divide\b|\\div\b/g, "÷"],
  [/\\cdot\b/g, "·"],
  [/\\pm\b/g, "±"],
  [/\\leqslant\b|\\leq\b|\\le\b/g, "≤"],
  [/\\geqslant\b|\\geq\b|\\ge\b/g, "≥"],
  [/\\neq\b|\\ne\b/g, "≠"],
  [/\\approx\b/g, "≈"],
  [/\\equiv\b/g, "≡"],
  [/\\infty\b/g, "∞"],
  [/\\pi\b/g, "π"],
  [/\\theta\b/g, "θ"],
  [/\\degree\b|\\circ\b/g, "°"],
  [/\\rightarrow\b|\\to\b|\\implies\b/g, "→"],
  [/\\leftarrow\b/g, "←"],
  [/\\ldots\b|\\dots\b|\\cdots\b/g, "…"],
  [/\\%/g, "%"],
  [/\\\$/g, "$"],
  [/\\&/g, "&"],
  [/\\_/g, "_"],
];

/** Braced group starting at `from` (which must be `{`). Returns the contents and what follows. */
function readGroup(text: string, from: number): { body: string; end: number } | null {
  if (text[from] !== "{") return null;
  let depth = 0;
  for (let i = from; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return { body: text.slice(from + 1, i), end: i + 1 };
    }
  }
  return null;
}

/** `\frac{a}{b}` → `¾` where there is such a character, `a/b` or `(a+1)/b` otherwise. */
function expandFractions(text: string): string {
  const command = /\\[dt]?frac\s*/;
  let out = text;
  // Innermost first, so a fraction inside a fraction is already plain when its parent is read.
  for (let guard = 0; guard < 50; guard += 1) {
    const match = command.exec(out);
    if (!match) break;
    const afterCommand = match.index + match[0].length;
    const numerator = readGroup(out, afterCommand);
    if (!numerator) {
      out = out.slice(0, match.index) + out.slice(afterCommand);
      continue;
    }
    const denominator = readGroup(out, numerator.end);
    if (!denominator) {
      out = out.slice(0, match.index) + numerator.body + out.slice(numerator.end);
      continue;
    }
    const top = plainMaths(numerator.body).trim();
    const bottom = plainMaths(denominator.body).trim();
    const simple = /^[\w.]+$/;
    /**
     * Always `a/b`, never `½`.
     *
     * The characters exist and are prettier, and using them is a trap: "which of these equals
     * ½?" with `2/4` among the choices shows the child two things that look nothing alike, and
     * a question about equivalent fractions gives its own answer away by typography. One
     * notation for every fraction on the page.
     */
    const replacement = `${simple.test(top) ? top : `(${top})`}/${simple.test(bottom) ? bottom : `(${bottom})`}`;
    out = out.slice(0, match.index) + replacement + out.slice(denominator.end);
  }
  return out;
}

/** `\sqrt{9}` → `√9`, `\sqrt{x+1}` → `√(x+1)`. */
function expandRoots(text: string): string {
  let out = text;
  for (let guard = 0; guard < 50; guard += 1) {
    const match = /\\sqrt\s*/.exec(out);
    if (!match) break;
    const group = readGroup(out, match.index + match[0].length);
    if (!group) {
      out = out.slice(0, match.index) + out.slice(match.index + match[0].length);
      continue;
    }
    const body = plainMaths(group.body).trim();
    out = out.slice(0, match.index) + `√${/^[\w.]+$/.test(body) ? body : `(${body})`}` + out.slice(group.end);
  }
  return out;
}

/** Commands whose only job is to carry their contents through: `\text{apples}` → `apples`. */
const PASSTHROUGH = /\\(?:text|textbf|textit|mathrm|mathbf|mathit|operatorname|displaystyle)\s*\{/;

function expandPassthrough(text: string): string {
  let out = text;
  for (let guard = 0; guard < 50; guard += 1) {
    const match = PASSTHROUGH.exec(out);
    if (!match) break;
    const group = readGroup(out, match.index + match[0].length - 1);
    if (!group) {
      out = out.slice(0, match.index) + out.slice(match.index + match[0].length);
      continue;
    }
    out = out.slice(0, match.index) + group.body + out.slice(group.end);
  }
  return out;
}

/** `x^{2}` and `x^2` → `x²`; `H_{2}O` → `H₂O`. Anything not a plain digit keeps its `^`. */
function expandScripts(text: string): string {
  const digitsToChars = (digits: string, table: Record<string, string>) =>
    [...digits].map((d) => table[d]).join("");

  return text
    .replace(/\^\{(\d+)\}/g, (_, d: string) => digitsToChars(d, SUPERSCRIPT))
    .replace(/\^(\d)/g, (_, d: string) => digitsToChars(d, SUPERSCRIPT))
    .replace(/_\{(\d+)\}/g, (_, d: string) => digitsToChars(d, SUBSCRIPT))
    .replace(/_(\d)(?![\w])/g, (_, d: string) => digitsToChars(d, SUBSCRIPT));
}

/**
 * The written notation, in plain characters.
 *
 * Safe to run on ordinary prose: text with no maths in it comes back unchanged, and a lone `$`
 * in "it costs $5" is left alone because a maths delimiter comes in a pair.
 */
export function plainMaths(input: string): string {
  if (!input) return input;
  if (!/[$\\^_]|\*\*|`/.test(input)) return input; // ordinary prose, untouched

  let out = input;

  // Delimiters first: `$$…$$`, `\[…\]`, `\(…\)`, then single `$…$` — paired only, so prices survive.
  out = out.replace(/\$\$([\s\S]*?)\$\$/g, " $1 ");
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, " $1 ");
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, " $1 ");
  out = out.replace(/\$([^$\n]+)\$/g, " $1 ");

  out = expandPassthrough(out);
  out = expandFractions(out);
  out = expandRoots(out);

  for (const [pattern, replacement] of SYMBOLS) out = out.replace(pattern, replacement);

  // Sizing and spacing commands say nothing out loud.
  out = out.replace(/\\(?:left|right|big|bigg|Big|Bigg)\b/g, "");
  out = out.replace(/\\(?:quad|qquad|,|;|:|!)/g, " ");

  out = expandScripts(out);

  // Anything still wearing a backslash: keep what it wraps, drop the command.
  out = out.replace(/\\[a-zA-Z]+\s*\{([^{}]*)\}/g, "$1");
  out = out.replace(/\\[a-zA-Z]+/g, "");
  out = out.replace(/\\\\/g, " ");

  // Markdown that nothing on the page renders either — `**half**` is not emphasis to a child,
  // it is two stars.
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  out = out.replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?])/g, "$1$2");
  out = out.replace(/`([^`\n]+)`/g, "$1");

  // Braces that held a group we have already taken apart.
  out = out.replace(/[{}]/g, "");

  // Tidy: no double spaces, no space before punctuation, blank lines kept.
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/[ \t]+([.,!?;:])/g, "$1");
  return out.replace(/[ \t]+$/gm, "").trim();
}

/** Every string inside a value, made readable. Shapes and keys are untouched. */
export function plainMathsDeep<T>(value: T): T {
  if (typeof value === "string") return plainMaths(value) as unknown as T;
  if (Array.isArray(value)) return value.map(plainMathsDeep) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) out[key] = plainMathsDeep(v);
    return out as unknown as T;
  }
  return value;
}


/** Small numbers said as words, because "3 quarters" is not how anyone says three quarters. */
const WORDS: Record<string, string> = {
  "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six",
  "7": "seven", "8": "eight", "9": "nine", "10": "ten", "11": "eleven", "12": "twelve",
};

/** Symbols read as words, since "×" spoken aloud is a coin toss between "times" and nothing. */
const SPOKEN: [RegExp, string][] = [
  [/×/g, " times "],
  [/÷/g, " divided by "],
  [/≤/g, " is less than or equal to "],
  [/≥/g, " is greater than or equal to "],
  [/≠/g, " is not equal to "],
  [/≈/g, " is about "],
  [/√/g, " the square root of "],
  [/²/g, " squared "],
  [/³/g, " cubed "],
  [/°/g, " degrees "],
  [/π/g, " pi "],
  [/→/g, " gives "],
];

/**
 * The same text, for a voice.
 *
 * Read-aloud is the part that suffered most: a screen reader given `$$\frac{3}{4}$$` says
 * "dollar dollar frac three four", which is worse than silence. Symbols become the words a
 * teacher would use, and a simple fraction is said the way it is said out loud.
 */
export function spokenMaths(input: string): string {
  let out = plainMaths(input);
  for (const [pattern, replacement] of SPOKEN) out = out.replace(pattern, replacement);
  // "3/4" said as "three quarters", but only where it is plainly a fraction and not a date.
  out = out.replace(/\b(\d{1,2})\/(\d{1,2})\b/g, (_whole, top: string, bottom: string) => {
    const named: Record<string, string> = { "2": "half", "3": "third", "4": "quarter", "5": "fifth", "8": "eighth" };
    const unit = named[bottom];
    if (!unit) return ` ${WORDS[top] ?? top} over ${WORDS[bottom] ?? bottom} `;
    const plural = Number(top) === 1 ? "" : unit === "half" ? "ves" : "s";
    return ` ${WORDS[top] ?? top} ${unit === "half" && plural ? "hal" : unit}${plural} `;
  });
  return out.replace(/[ \t]{2,}/g, " ").trim();
}
