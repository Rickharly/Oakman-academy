"use client";

import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

/**
 * Sets a child's avatar photo from a file on the parent's device.
 *
 * The picture is cropped square and shrunk to 256px in the browser before it is sent, so what
 * reaches the database is a ~20–40 KB data URL rather than a multi-megabyte camera file.
 * Storing it in the row (instead of on disk) is deliberate: the container's filesystem is
 * wiped on every deploy, so a file written there would vanish; two small avatars in Postgres
 * survive redeploys and need no storage service.
 */
const OUTPUT_SIZE = 256;

async function toSquareDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function PhotoUpload({
  studentId,
  name,
  avatar,
}: {
  studentId: string;
  name: string;
  avatar: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(avatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/students/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, avatar: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not save that photo.");
      }
      setCurrent(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that photo.");
    } finally {
      setBusy(false);
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await toSquareDataUrl(file);
      await save(dataUrl);
    } catch {
      setError("Could not read that image. Try a JPEG or PNG.");
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar emoji={current} name={name} size="xl" />
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <Camera className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {current && current.startsWith("data:") ? "Change photo" : "Add photo"}
          </Button>
          {current && current.startsWith("data:") ? (
            <Button type="button" variant="ghost" onClick={() => void save(null)} disabled={busy}>
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-ink-muted">
          Shown on {name}&apos;s login button and in the app. Cropped square automatically.
        </p>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
        aria-label={`Choose a photo for ${name}`}
      />
    </div>
  );
}
