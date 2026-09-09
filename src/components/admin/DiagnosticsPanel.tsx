"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, MinusCircle, RefreshCw, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
