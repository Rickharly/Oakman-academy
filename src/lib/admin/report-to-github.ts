/**
 * Sending what is actually happening to somewhere it can be read.
 *
 * The machine this app is developed on cannot reach the running app, OpenAI, or the curriculum
 * provider — the egress policy refuses all three. So every fault has been diagnosed by
 * reasoning about a system nobody could observe, and reasoning has been wrong about half the
 * time, with a child's school day paying for each wrong answer.
 *
 * GitHub is reachable from both sides. So the app posts its own diagnostics there: one issue,
 * one comment per report, containing exactly what the checks found. It closes the loop that has
 * been open all week — no screenshots, no retyping, no interpretation in between.
 *
 * Nothing secret goes in. The checks report whether a credential is configured, never its
 * value, and anything key-shaped in a provider's error text is redacted before it leaves.
 */
import { runDiagnostics, type Check } from "./diagnostics";

const ISSUE_TITLE = "Oakman Academy — live diagnostics";

/**
 * Removes anything that looks like a credential.
 *
 * Provider error text is not supposed to contain keys, and mostly does not. "Mostly" is not a
 * standard to publish on, so the obvious shapes go first: our own key values wherever they
 * appear, then anything with a known key prefix.
 */
export function redact(text: string): string {
  let out = text;
  for (const value of [
    process.env.OPENAI_API_KEY,
    process.env.OAK_API_KEY,
    process.env.ELEVENLABS_API_KEY,
    process.env.GITHUB_TOKEN,
    process.env.DATABASE_URL,
  ]) {
    if (value && value.length > 8) out = out.split(value).join("[redacted]");
  }
  return out
    .replace(/\b(sk|xi|ghp|github_pat|gho|ghs)[-_][A-Za-z0-9_-]{12,}/g, "[redacted]")
    .replace(/postgres(ql)?:\/\/[^\s"']+/gi, "[redacted]");
}

const MARK: Record<Check["status"], string> = { ok: "✅", warn: "⚠️", fail: "❌", skip: "➖" };

export function formatReport(checks: Check[], note?: string): string {
  const lines: string[] = [];
  lines.push(`### Report — ${new Date().toISOString()}`);
  if (note) lines.push("", `**What was happening:** ${redact(note)}`);
  lines.push("");
  for (const check of checks) {
    lines.push(`${MARK[check.status]} **${check.name}** — ${redact(check.summary)}`);
    if (check.detail) {
      lines.push("");
      lines.push("```");
      lines.push(redact(check.detail));
      lines.push("```");
    }
    lines.push("");
  }
  return lines.join("\n");
}

type Repo = { owner: string; repo: string };

function repoFromEnv(): Repo | null {
  const full = process.env.GITHUB_REPO ?? "Rickharly/Oakman-academy";
  const [owner, repo] = full.split("/");
  return owner && repo ? { owner, repo } : null;
}

async function gh(path: string, init: RequestInit): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

/** The one issue reports are added to, created on first use so nothing has to be set up by hand. */
async function findOrCreateIssue({ owner, repo }: Repo): Promise<number | null> {
  // Listed rather than searched. The search API needs wider access than a fine-grained token
  // scoped to one repository's issues is given, and failing at the very first step of a setup
  // someone has just followed is the worst place to be strict.
  const listed = await gh(`/repos/${owner}/${repo}/issues?state=open&per_page=100`, { method: "GET" });
  if (listed.ok) {
    const issues = (await listed.json()) as { number: number; title: string; pull_request?: unknown }[];
    const existing = issues.find((i) => i.title === ISSUE_TITLE && !i.pull_request);
    if (existing) return existing.number;
  }

  const created = await gh(`/repos/${owner}/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: ISSUE_TITLE,
      body:
        "Reports from the running app, posted from Admin → What's working.\n\n" +
        "This exists because the app cannot be reached from where it is developed. " +
        "Each comment is one run of the checks: what worked, what did not, and the providers' " +
        "own error text. No credentials — only whether they are configured.",
    }),
  });
  if (!created.ok) return null;
  const issue = (await created.json()) as { number?: number };
  return issue.number ?? null;
}

export type PublishResult = { ok: boolean; url?: string; problem?: string };

/**
 * Runs the checks and posts them.
 *
 * `note` is whatever the person pressing the button wants to say — "Mikhael has no lessons" —
 * which is the piece of context no automated check can supply.
 */
export async function publishDiagnostics(note?: string): Promise<PublishResult> {
  if (!process.env.GITHUB_TOKEN) {
    return {
      ok: false,
      problem:
        "No GITHUB_TOKEN on the server. Add a GitHub token with Issues write access on this repository, as GITHUB_TOKEN.",
    };
  }
  const repo = repoFromEnv();
  if (!repo) return { ok: false, problem: "GITHUB_REPO is not in owner/repo form." };

  try {
    const checks = await runDiagnostics();
    const number = await findOrCreateIssue(repo);
    if (!number) {
      return { ok: false, problem: "Could not open the diagnostics issue — check the token's permissions." };
    }

    const posted = await gh(`/repos/${repo.owner}/${repo.repo}/issues/${number}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: formatReport(checks, note) }),
    });
    if (!posted.ok) {
      return { ok: false, problem: `GitHub returned ${posted.status}: ${(await posted.text()).slice(0, 200)}` };
    }
    const comment = (await posted.json()) as { html_url?: string };
    return { ok: true, url: comment.html_url };
  } catch (err) {
    return { ok: false, problem: (err as Error).message };
  }
}

// ───────────────────────────── bug reports from the children ─────────────────────────────

const BUG_LABEL = "reported-by-a-child";

export interface BugReport {
  /** In their own words. This is the whole point — nobody else was there. */
  what: string;
  /** Who is reporting, so a reply can be addressed to them. */
  studentName: string;
  yearGroup: number;
  /** Where they were: the lesson, the step, the question in front of them. */
  context: {
    lessonTitle?: string;
    subject?: string;
    stage?: string;
    questionPrompt?: string;
    url?: string;
  };
}

/**
 * A child's own bug report, sent straight to where it gets fixed.
 *
 * Every fault this week reached me through a parent relaying what a child said, hours later,
 * with the details worn off. The child was the only one who saw it. This lets them say what
 * happened while they are still looking at it, and attaches where they were automatically —
 * the lesson, the step, the question — because "it didn't work" from an eight-year-old is a
 * complete and reasonable bug report if the app supplies the rest.
 *
 * It is its own issue rather than a comment, so each one can be closed when it is fixed.
 */
export async function reportBug(report: BugReport): Promise<PublishResult> {
  if (!process.env.GITHUB_TOKEN) {
    return { ok: false, problem: "No GITHUB_TOKEN on the server, so this cannot be sent yet." };
  }
  const repo = repoFromEnv();
  if (!repo) return { ok: false, problem: "GITHUB_REPO is not in owner/repo form." };

  const { context } = report;
  const body = [
    `**${report.studentName} (Year ${report.yearGroup}) says:**`,
    "",
    `> ${redact(report.what).split("\n").join("\n> ")}`,
    "",
    "---",
    "",
    "**Where they were**",
    context.subject ? `- Subject: ${context.subject}` : "",
    context.lessonTitle ? `- Lesson: ${context.lessonTitle}` : "",
    context.stage ? `- Step: ${context.stage}` : "",
    context.questionPrompt ? `- Question on screen: "${context.questionPrompt}"` : "",
    context.url ? `- Page: ${context.url}` : "",
    `- Reported: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const created = await gh(`/repos/${repo.owner}/${repo.repo}/issues`, {
      method: "POST",
      body: JSON.stringify({
        title: `${report.studentName}: ${report.what.slice(0, 70).replace(/\s+/g, " ").trim()}`,
        body,
        labels: [BUG_LABEL],
      }),
    });
    if (!created.ok) {
      // A label that does not exist yet makes GitHub refuse the whole issue. The report matters
      // more than the label, so it goes again without one.
      const retry = await gh(`/repos/${repo.owner}/${repo.repo}/issues`, {
        method: "POST",
        body: JSON.stringify({
          title: `${report.studentName}: ${report.what.slice(0, 70).replace(/\s+/g, " ").trim()}`,
          body,
        }),
      });
      if (!retry.ok) {
        return { ok: false, problem: `GitHub returned ${retry.status}: ${(await retry.text()).slice(0, 200)}` };
      }
      const issue = (await retry.json()) as { html_url?: string };
      return { ok: true, url: issue.html_url };
    }
    const issue = (await created.json()) as { html_url?: string };
    return { ok: true, url: issue.html_url };
  } catch (err) {
    return { ok: false, problem: (err as Error).message };
  }
}
