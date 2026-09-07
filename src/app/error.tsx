"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="h-7 w-7" />
      </span>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Something went wrong</h1>
        <p className="text-sm text-ink-muted max-w-sm">
          An unexpected error occurred. You can try again, or head back home.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" href="/">
          Go home
        </Button>
        <Button onClick={() => retry()}>Try again</Button>
      </div>
    </div>
  );
}
