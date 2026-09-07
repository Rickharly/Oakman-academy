"use client";

import { useEffect, useRef } from "react";

/**
 * A short burst of confetti in the school colours.
 *
 * Drawn on a canvas rather than pulled from a library: it is a few dozen lines, adds no
 * dependency, and cannot be blocked by a content policy. It runs once, cleans up after
 * itself, and is skipped entirely for anyone who prefers reduced motion.
 */
const COLOURS = ["#17304c", "#1b4332", "#c6a253", "#e0c98a", "#2f5d4a"];
const PIECES = 130;
const DURATION_MS = 4000;

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  colour: string;
  rotation: number;
  spin: number;
};

export function Confetti({ run = true }: { run?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!run) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const width = () => canvas.width / dpr;
    const pieces: Piece[] = Array.from({ length: PIECES }, () => ({
      // Two loose clusters, as though thrown from either side of the screen.
      x: width() * (Math.random() < 0.5 ? 0.15 : 0.85) + (Math.random() - 0.5) * width() * 0.5,
      y: -20 - Math.random() * 160,
      vx: (Math.random() - 0.5) * 2.4,
      vy: 2 + Math.random() * 3,
      size: 5 + Math.random() * 6,
      colour: COLOURS[Math.floor(Math.random() * COLOURS.length)]!,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.22,
    }));

    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const fade = elapsed > DURATION_MS - 900 ? Math.max(0, (DURATION_MS - elapsed) / 900) : 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.045; // gravity
        p.vx *= 0.995;
        p.rotation += p.spin;

        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.colour;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (elapsed < DURATION_MS) {
        frame = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [run]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] h-full w-full"
    />
  );
}
