// ============================================================================
// jump.animate() — Non-DOM Value Animation
// ============================================================================
// Animates plain JavaScript objects using requestAnimationFrame.
// Uses the same easing/spring system as the rest of Jump.
//
// API:
//   jump.animate({ progress: 0 }, { progress: 100 }, {
//     duration: 500,
//     onUpdate: (current) => el.textContent = Math.round(current.progress),
//   })
//
// This enables: number counters, canvas/WebGL tweening, Three.js camera
// animation, progress bars, and anything that isn't a DOM element.
// ============================================================================

import type { JumpOptions } from "../types/index.js";
import { resolveEasing } from "./easings.js";

export type AnimateValueOptions = JumpOptions & {
  /** Called every frame with the current interpolated values */
  onUpdate?: (current: Record<string, number>) => void;
};

export type ValueControls = {
  cancel: () => void;
  finished: Promise<void>;
  pause: () => void;
  play: () => void;
};

/**
 * Animates properties of a plain JS object from their current values to
 * a target using requestAnimationFrame. The source object is mutated in place.
 *
 * ```ts
 * const counter = { value: 0 }
 * jump.animate(counter, { value: 1000 }, {
 *   duration: 800,
 *   easing: "ease-out-cubic",
 *   onUpdate: (c) => el.textContent = Math.round(c.value).toLocaleString(),
 * })
 * ```
 */
export function animateValues(
  source: Record<string, number>,
  target: Record<string, number>,
  options: AnimateValueOptions = {},
): ValueControls {
  const duration = options.duration ?? 300;
  const delay = options.delay ?? 0;
  const easingStr = options.easing
    ? resolveEasing(options.easing)
    : "cubic-bezier(0.215, 0.61, 0.355, 1)";
  const easeFn = cssEasingToFunction(easingStr);
  const { onUpdate, onComplete } = options;

  // Snapshot the starting values
  const keys = Object.keys(target);
  const starts: Record<string, number> = {};
  for (const key of keys) {
    starts[key] = source[key] ?? 0;
  }

  let startTime = -1;
  let rafId: number;
  let cancelled = false;
  let paused = false;
  let pausedAt = 0;
  let pauseOffset = 0;

  const finished = new Promise<void>((resolve) => {
    function frame(now: number) {
      if (cancelled) { resolve(); return; }
      if (paused) { rafId = requestAnimationFrame(frame); return; }

      if (startTime < 0) startTime = now + delay;
      const elapsed = now - startTime - pauseOffset;

      if (elapsed < 0) {
        rafId = requestAnimationFrame(frame);
        return;
      }

      const rawProgress = Math.min(1, elapsed / duration);
      const easedProgress = easeFn(rawProgress);

      for (const key of keys) {
        const start = starts[key]!;
        const end = target[key]!;
        source[key] = start + (end - start) * easedProgress;
      }

      onUpdate?.(source);

      if (rawProgress >= 1) {
        // Ensure exact final values
        for (const key of keys) {
          source[key] = target[key]!;
        }
        onUpdate?.(source);
        onComplete?.();
        resolve();
      } else {
        rafId = requestAnimationFrame(frame);
      }
    }

    rafId = requestAnimationFrame(frame);
  });

  return {
    cancel() {
      cancelled = true;
      cancelAnimationFrame(rafId);
    },
    finished,
    pause() {
      if (!paused) {
        paused = true;
        pausedAt = performance.now();
      }
    },
    play() {
      if (paused) {
        pauseOffset += performance.now() - pausedAt;
        paused = false;
      }
    },
  };
}

// ============================================================================
// CSS easing string → JS function
// ============================================================================

function cssEasingToFunction(easing: string): (t: number) => number {
  if (easing === "linear") return (t) => t;
  if (easing === "ease") return cubicBezier(0.25, 0.1, 0.25, 1);
  if (easing === "ease-in") return cubicBezier(0.42, 0, 1, 1);
  if (easing === "ease-out") return cubicBezier(0, 0, 0.58, 1);
  if (easing === "ease-in-out") return cubicBezier(0.42, 0, 0.58, 1);

  const bezierMatch = easing.match(
    /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/,
  );
  if (bezierMatch) {
    return cubicBezier(
      parseFloat(bezierMatch[1]!),
      parseFloat(bezierMatch[2]!),
      parseFloat(bezierMatch[3]!),
      parseFloat(bezierMatch[4]!),
    );
  }

  // Fallback: ease-out
  return cubicBezier(0, 0, 0.58, 1);
}

/**
 * Attempt an approximate cubic-bezier using Newton's method.
 * For performance, we use 8 iterations which is accurate to ~0.001.
 */
function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  // Degenerate cases
  if (x1 === y1 && x2 === y2) return (t) => t;

  function sampleX(t: number): number {
    return ((1 - 3 * x2 + 3 * x1) * t + (3 * x2 - 6 * x1)) * t * t + 3 * x1 * t;
  }
  function sampleY(t: number): number {
    return ((1 - 3 * y2 + 3 * y1) * t + (3 * y2 - 6 * y1)) * t * t + 3 * y1 * t;
  }
  function sampleDerivX(t: number): number {
    return (3 * (1 - 3 * x2 + 3 * x1)) * t * t + (2 * (3 * x2 - 6 * x1)) * t + 3 * x1;
  }

  // Newton-Raphson to find t for a given x
  function solveForT(x: number): number {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = sampleX(t) - x;
      const deriv = sampleDerivX(t);
      if (Math.abs(deriv) < 1e-6) break;
      t -= dx / deriv;
    }
    return Math.max(0, Math.min(1, t));
  }

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return sampleY(solveForT(x));
  };
}
