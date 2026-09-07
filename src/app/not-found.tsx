import { Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Compass className="h-7 w-7" />
      </span>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Page not found</h1>
        <p className="text-sm text-ink-muted max-w-sm">
          We couldn&apos;t find what you were looking for. It may have moved, or the link is out of date.
        </p>
      </div>
      <Button href="/">Go home</Button>
    </div>
  );
}
