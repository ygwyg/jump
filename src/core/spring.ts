// ============================================================================
// Real Spring Physics via CSS linear()
// ============================================================================
// Solves the damped harmonic oscillator and encodes the result as a
// CSS linear() easing string. This produces real overshoot and settling
// behavior — something cubic-bezier cannot do for transform/opacity.
//
// Equation: x(t) = 1 - e^(-ζω₀t) [cos(ωdt) + (ζω₀/ωd)sin(ωdt)]
// where ωd = ω₀√(1-ζ²)  (damped natural frequency)
//
// Browser support for linear(): Chrome 113+, Firefox 112+, Safari 17.2+
// ============================================================================

export type SpringParams = {
  /** Spring stiffness. Higher = snappier response. Default: 170 */
  stiffness?: number;
  /** Damping coefficient. Lower = more oscillation. Default: 26 */
  damping?: number;
  /** Mass of the simulated object. Higher = slower. Default: 1 */
  mass?: number;
  /** Initial velocity (units/s). Default: 0 */
  velocity?: number;
};

export type SpringResult = {
  /** CSS linear() easing string — pass directly to JumpOptions.easing */
  easing: string;
  /** Duration in ms for this spring to settle — pass to JumpOptions.duration */
  duration: number;
};

// ============================================================================
// Browser capability detection
// ============================================================================

/**
 * Returns true if the browser supports CSS linear() easing.
 * Chrome 113+, Firefox 112+, Safari 17.2+
 *
 * When false, createSpring() falls back to a cubic-bezier approximation
 * that captures the spring's feel without real overshoot.
 */
export function supportsLinear(): boolean {
  if (typeof CSS === "undefined") return false;
  try {
    return CSS.supports("animation-timing-function", "linear(0, 1)");
  } catch {
    return false;
  }
}

// Lazy: only evaluated on first call, not at module init.
// Prevents caching the wrong value during SSR where CSS is undefined.
let _linearSupportCached: boolean | null = null;
function isLinearSupported(): boolean {
  if (_linearSupportCached === null) {
    _linearSupportCached = supportsLinear();
  }
  return _linearSupportCached;
}

/**
 * Approximates a spring as a cubic-bezier for browsers without linear() support.
 * Captures the overshoot feel without actually exceeding 0–1.
 * Used automatically by createSpring() when linear() is unavailable.
 */
function springToCubicBezier(
  omega0: number,
  zeta: number,
): string {
  if (zeta >= 1) {
    // Overdamped / critically damped — fast ease-out
    return "cubic-bezier(0.215, 0.61, 0.355, 1)";
  }

  // Underdamped — approximate the "snap then settle" feel.
  // The peak overshoot time ≈ π/ωd; we use that to set the control points.
  const wd = omega0 * Math.sqrt(1 - zeta * zeta);
  const peakTime = Math.PI / wd; // seconds to first overshoot peak

  // Map the normalized peak time (0–1) into a P2 x-coordinate
  // Higher peak = more "springy" feel in the bezier
  const p2x = Math.min(0.9, Math.max(0.2, 1 - peakTime * 0.3));

  // Slightly overshoot y on P2 to suggest bouncy feel (clamped to valid range)
  const overshootHint = Math.min(1.4, 1 + (1 - zeta) * 0.6);
  const p2y = zeta < 0.5 ? overshootHint : 1.1;

  return `cubic-bezier(0.2, ${p2y.toFixed(3)}, ${p2x.toFixed(3)}, 1)`;
}

// Minimum samples per oscillation cycle to keep curves smooth
const MIN_SAMPLES_PER_CYCLE = 12;
// Maximum total sample count (prevents very long linear() strings)
const MAX_SAMPLES = 400;
// Minimum samples regardless of spring type
const BASE_SAMPLES = 120;
// Spring is "settled" when displacement from target is under this fraction
const SETTLE_THRESHOLD = 0.0001;

/**
 * Creates a real spring physics easing curve encoded as CSS linear().
 *
 * Returns `{ easing, duration }` — spread directly into JumpOptions:
 * ```ts
 * jump(el, "enter from bottom", { ...createSpring({ stiffness: 200, damping: 18 }) })
 * ```
 */
export function createSpring(params: SpringParams = {}): SpringResult {
  const { stiffness = 170, damping = 26, mass = 1, velocity = 0 } = params;

  // Validate: prevent NaN/Infinity from propagating through the physics
  if (mass <= 0 || stiffness <= 0 || !isFinite(mass) || !isFinite(stiffness) || !isFinite(damping)) {
    return { easing: "ease-out", duration: 300 };
  }

  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  const settleDuration = findSettleDuration(omega0, zeta, velocity);
  const duration = Math.round(settleDuration * 1000);

  // Fall back to cubic-bezier on browsers without CSS linear() support
  if (!isLinearSupported()) {
    return {
      easing: springToCubicBezier(omega0, zeta),
      duration,
    };
  }

  // Adaptive sample count: more samples for high-frequency oscillations
  const sampleCount = adaptiveSampleCount(omega0, zeta, settleDuration);

  const samples: number[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    const t = (i / sampleCount) * settleDuration;
    samples.push(clamp(springPosition(t, omega0, zeta, velocity), -3, 3));
  }

  const points = rdpSimplify(samples, 0.0004);

  return { easing: `linear(${points})`, duration };
}

/**
 * Named spring presets. Access as properties (getters), not function calls.
 * Each access returns a fresh { easing, duration } object.
 *
 * Usage:
 * ```ts
 * import { springs } from "jump"
 *
 * jump(el, "enter from bottom", springs.bouncy)
 * jump.to(ball, { x: 100 }, springs.default)
 * ```
 */
export const springs: {
  /** Gentle settle, no overshoot. Good for menus and dropdowns. */
  readonly gentle: SpringResult;
  /** Default — snappy with slight overshoot. Good for most UI. */
  readonly default: SpringResult;
  /** Bouncy with visible overshoot. Good for emphasis and fun interactions. */
  readonly bouncy: SpringResult;
  /** Very stiff, near-instant snap. Good for micro-interactions. */
  readonly stiff: SpringResult;
  /** Slow, heavy, dramatic settle. Good for page transitions. */
  readonly slow: SpringResult;
  /** Barely damped — lots of oscillation. Use sparingly. */
  readonly wobbly: SpringResult;
} = {
  get gentle()  { return createSpring({ stiffness: 120, damping: 14, mass: 1 }); },
  get default() { return createSpring({ stiffness: 170, damping: 26, mass: 1 }); },
  get bouncy()  { return createSpring({ stiffness: 300, damping: 20, mass: 1 }); },
  get stiff()   { return createSpring({ stiffness: 500, damping: 40, mass: 1 }); },
  get slow()    { return createSpring({ stiffness:  60, damping: 15, mass: 2 }); },
  get wobbly()  { return createSpring({ stiffness: 180, damping:  8, mass: 1 }); },
};

export type SpringPreset = keyof typeof springs;

// ============================================================================
// Physics
// ============================================================================

function springPosition(
  t: number,
  omega0: number,
  zeta: number,
  v0: number,
): number {
  if (zeta < 1) {
    // Under-damped: oscillates before settling
    const wd = omega0 * Math.sqrt(1 - zeta * zeta);
    const B = (zeta * omega0 + v0) / wd;
    return 1 - Math.exp(-zeta * omega0 * t) * (Math.cos(wd * t) + B * Math.sin(wd * t));
  }

  if (zeta === 1) {
    // Critically damped: fastest settle without oscillation
    const B = omega0 + v0;
    return 1 - Math.exp(-omega0 * t) * (1 + B * t);
  }

  // Over-damped: no oscillation, exponential decay
  // Derived from: x(0)=0, x'(0)=v0, x(∞)=1
  // c1 + c2 = 1, c1*r1 + c2*r2 = -v0
  const r1 = -omega0 * (zeta - Math.sqrt(zeta * zeta - 1));
  const r2 = -omega0 * (zeta + Math.sqrt(zeta * zeta - 1));
  const c2 = (r1 + v0) / (r1 - r2);
  const c1 = 1 - c2;
  return 1 - (c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t));
}

function findSettleDuration(omega0: number, zeta: number, v0: number): number {
  // Find an upper bound
  let hi = 0.5;
  while (Math.abs(springPosition(hi, omega0, zeta, v0) - 1) > SETTLE_THRESHOLD) {
    hi *= 2;
    if (hi > 60) return 10;
  }

  // Binary search for exact settle time
  let lo = 0;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (Math.abs(springPosition(mid, omega0, zeta, v0) - 1) > SETTLE_THRESHOLD) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return hi;
}

function adaptiveSampleCount(
  omega0: number,
  zeta: number,
  duration: number,
): number {
  if (zeta >= 1) return BASE_SAMPLES; // no oscillation — fewer samples fine

  const wd = omega0 * Math.sqrt(1 - zeta * zeta);
  const cyclesInDuration = (wd * duration) / (2 * Math.PI);
  const samplesNeeded = Math.ceil(cyclesInDuration * MIN_SAMPLES_PER_CYCLE);
  return Math.min(Math.max(BASE_SAMPLES, samplesNeeded), MAX_SAMPLES);
}

// ============================================================================
// Ramer-Douglas-Peucker curve simplification
// ============================================================================

/**
 * Simplifies the sampled spring curve using the RDP algorithm.
 * Returns a CSS linear() point string.
 *
 * RDP correctly handles runs of points — unlike a simple neighbor-midpoint
 * check, it ensures the maximum deviation across any skipped segment stays
 * under the epsilon threshold.
 */
function rdpSimplify(samples: number[], epsilon: number): string {
  const n = samples.length;
  if (n <= 2) {
    return samples.map((v, i) => fmtPoint(v, i, n)).join(", ");
  }

  // Convert to 2D points: (index/n, value)
  const points: [number, number][] = samples.map((v, i) => [i / (n - 1), v]);
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  rdpRecurse(points, 0, n - 1, epsilon, keep);

  const result: string[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) {
      result.push(fmtPoint(samples[i]!, i, n));
    }
  }
  return result.join(", ");
}

function rdpRecurse(
  pts: [number, number][],
  start: number,
  end: number,
  eps: number,
  keep: Uint8Array,
): void {
  if (end - start <= 1) return;

  const [x1, y1] = pts[start]!;
  const [x2, y2] = pts[end]!;

  let maxDist = 0;
  let maxIdx = start;

  for (let i = start + 1; i < end; i++) {
    const [px, py] = pts[i]!;
    const dist = pointToSegmentDist(px, py, x1, y1, x2, y2);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > eps) {
    keep[maxIdx] = 1;
    rdpRecurse(pts, start, maxIdx, eps, keep);
    rdpRecurse(pts, maxIdx, end, eps, keep);
  }
}

function pointToSegmentDist(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function fmtPoint(value: number, i: number, n: number): string {
  const v = Math.round(value * 100000) / 100000;
  if (i === 0) return `${v}`;
  if (i === n - 1) return `${v}`;
  const pct = Math.round((i / (n - 1)) * 1000) / 10;
  return `${v} ${pct}%`;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
