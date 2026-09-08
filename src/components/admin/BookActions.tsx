"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";

async function post(body: unknown): Promise<{ error?: string }> {
  const res = await fetch("/api/admin/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json().catch(() => ({}))) as { error?: string };
}

/** Sets or stands down the class novel for a year group. */
export function BookActions({ bookId, active }: { bookId: string; active: boolean }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function run() {
    setBusy(true);
    await post({ action: active ? "deactivate" : "activate", bookId });
    setBusy(false);
    router.refresh();
  }

  return (
    <Button onClick={run} disabled={busy} variant={active ? "secondary" : "primary"}>
      {busy ? "…" : active ? "Currently set — stand down" : "Set as class novel"}
    </Button>
  );
}

/** Downloads a book from Project Gutenberg. Needs internet access from the server. */
export function ImportBookButton({ title }: { title: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setBusy(true);
    setError(null);
    const data = await post({ action: "import", title });
    setBusy(false);
    if (data.error) setError(data.error);
    else router.refresh();
  }

  return (
    <div className="text-right">
      <Button onClick={run} disabled={busy} variant="secondary">
        <Download className="mr-1.5 h-4 w-4" />
        {busy ? "Downloading…" : "Import"}
      </Button>
      {error ? <p className="mt-1 max-w-xs text-xs text-danger">{error}</p> : null}
    </div>
  );
}
