/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef } from "react";

const STEP = 10; // halftone grid pitch in CSS px
const BAND_STEP = 7; // finer pitch for the short phone band
const FPS = 30;

/**
 * Generated brand art: a halftone orb whose dots swell in waves that travel inward, as if the
 * field were being summoned to its center. Drawn on a canvas so it scales to any panel size.
 * It stops drawing while off screen or hidden, and renders one still frame under reduced motion.
 */
export function SummonArtwork(props: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let visible = true;
    let last = 0;
    const start = performance.now();

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (time: number) => {
      const t = time / 1000;
      context.clearRect(0, 0, width, height);
      // Tall panels: the orb sits low and right, leaving calm space for the headline.
      // Wide bands (the phone header): the orb rises from the bottom edge like a horizon.
      const band = width / height > 1.6;
      const cx = width * (band ? 0.5 : 0.64);
      const cy = band ? height * 1.35 : height * 0.74;
      const radius = band ? width * 0.62 : Math.min(width, height) * 0.5;
      // Light comes from the upper left, or from straight above on the horizon.
      const lx = band ? 0 : -0.5;
      const ly = band ? -0.8 : -0.62;
      const lz = 0.6;
      const step = band ? BAND_STEP : STEP;

      for (let y = step / 2; y < height; y += step) {
        for (let x = step / 2; x < width; x += step) {
          const dx = (x - cx) / radius;
          const dy = (y - cy) / radius;
          const d2 = dx * dx + dy * dy;
          const d = Math.sqrt(d2);

          let size: number;
          let alpha: number;
          if (d2 < 1) {
            const dz = Math.sqrt(1 - d2);
            const light = Math.max(0, dx * lx + dy * ly + dz * lz);
            // Waves on the surface move toward the center, bent slightly so they read as liquid.
            const wave = 0.5 + 0.5 * Math.sin(d * 16 + t * 1.4 + Math.sin(dy * 3 + t * 0.4) * 0.9);
            size = (0.12 + light ** 1.4 * 0.88) * (0.35 + 0.65 * wave);
            alpha = 0.3 + light * 0.7;
          } else {
            // Rings outside the orb contract toward it; each band dims as it travels outward.
            const phase = ((((d - 1) * 4 + t * 0.35) % 1) + 1) % 1;
            const ring = Math.max(0, 1 - Math.abs(phase - 0.5) * 6);
            const falloff = Math.max(0, 1 - (d - 1) * 0.9);
            size = (0.1 + ring * 0.45) * falloff;
            alpha = (0.12 + ring * 0.5) * falloff;
          }
          if (size < 0.04) continue;
          context.globalAlpha = alpha;
          context.beginPath();
          context.arc(x, y, size * (step / 2) * 0.92, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (!visible || document.hidden || now - last < 1000 / FPS) return;
      last = now;
      draw(now - start);
    };

    resize();
    context.fillStyle = "#fff";
    draw(4000);

    const resizeObserver = new ResizeObserver(() => {
      resize();
      context.fillStyle = "#fff";
      draw(performance.now() - start);
    });
    resizeObserver.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    intersection.observe(canvas);
    if (!still) frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={props.className} />;
}
