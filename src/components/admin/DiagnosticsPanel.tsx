"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, MinusCircle, RefreshCw, Send, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

type CheckStatus = "ok" | "warn" | "fail" | "skip";
type Check = { name: string; status: CheckStatus; summary: string; detail?: string };

const ICON: Record<CheckStatus, React.ReactNode> = {
  ok: <Check className="h-4 w-4 text-success" />,
  warn: <AlertCircle className="h-4 w-4 text-warning" />,
  fail: <XCircle className="h-4 w-4 text-danger" />,
  skip: <MinusCircle className="h-4 w-4 text-ink-faint" />,
};

export function DiagnosticsPanel() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ ok: boolean; message: string } | null>(null);

  /**
   * Sends this report to the repository, where it can actually be read.
   *
   * The app cannot be reached from where it is developed, so until now every fault had to be
   * described second-hand or screenshotted. This posts what the checks found, in full, with
   * whatever the person pressing it wants to add — which is the one piece of context no check
   * can supply.
   */
  async function send() {
    setSending(true);
    setSent(null);
    try {
      const res = await fetch("/api/admin/diagnostics/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const data = await res.json();
      setSent(
        data.ok
          ? { ok: true, message: "Sent. Claude can read it now." }
          : { ok: false, message: data.problem ?? data.error ?? "Could not send it." },
      );
      if (data.ok) setNote("");
    } catch (err) {
      setSent({ ok: false, message: err instanceof Error ? err.message : "Could not send it." });
    } finally {
      setSending(false);
    }
  }

  async function run() {
    setError(null);
    setRunning(true);
    try {
      const res = await fetch("/api/admin/diagnostics", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not run the checks.");
      setChecks(data.checks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run the checks.");
    } finally {
      setRunning(false);
    }
  }

  // Run on arrival: someone opening this page wants the answer, not a button. Guarded by a ref
  // so Strict Mode's double-invoke does not call the paid services twice.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void run();
  }, []);

  const failing = (checks ?? []).filter((c) => c.status === "fail");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button onClick={() => void run()} disabled={running} variant="secondary">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {running ? "Checking…" : "Run the checks again"}
        </Button>
        {checks && failing.length === 0 ? (
          <span className="text-sm text-success">Everything the children need is working.</span>
        ) : null}
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Card padding="md" className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-ink">Send this to Claude</p>
          <p className="text-sm text-ink-muted">
            Posts everything below to this repository, where it can be read directly — no
            screenshots, nothing retyped. Credentials are never included.
          </p>
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="What is going wrong? e.g. Mikhael has no lessons today"
          className="w-full"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void send()} disabled={sending || running}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sending…" : "Send this to Claude"}
          </Button>
          {sent ? (
            <span className={sent.ok ? "text-sm text-success" : "text-sm text-danger"}>{sent.message}</span>
          ) : null}
        </div>
      </Card>

      {running && !checks ? (
        <Card padding="lg" className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <p className="text-ink">Calling the real services…</p>
        </Card>
      ) : null}

      <div className="space-y-3">
        {(checks ?? []).map((check) => (
          <Card key={check.name} padding="md" className="space-y-1">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0">{ICON[check.status]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{check.name}</p>
                <p className="text-sm text-ink-muted">{check.summary}</p>
                {/*
                  The provider's own words, never paraphrased. Interpretation is how the last
                  three days went wrong; the raw error is the thing that is actually useful.
                */}
                {check.detail ? (
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-stone-50 p-3 text-xs text-ink-muted">
                    {check.detail}
                  </pre>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
