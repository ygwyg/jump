// ============================================================================
// jump.drag() — Full drag gesture with velocity, momentum, bounds, snap
// ============================================================================
//
// Tracks pointer position and velocity during a drag, then optionally
// applies momentum (inertia) deceleration and spring-back to bounds
// when released.
//
// Design: all animation is done via jump.to() so the element stays in the
// WAAPI pipeline on the compositor thread. No manual RAF positioning loop.
// ============================================================================

import type { JumpTarget, JumpOptions } from "../types/index.js";
import { resolveTargets, cancelAndCommit } from "./engine.js";
import { createSpring } from "./spring.js";

// ============================================================================
// Types
// ============================================================================

export type DragAxis = "x" | "y" | "both";

export type DragBounds = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export type SnapTo = {
  /** Array of x values to snap to */
  x?: number[];
  /** Array of y values to snap to */
  y?: number[];
};

export type DragOptions = {
  /**
   * Which axis the element can be dragged along.
   * "x" | "y" | "both" (default: "both")
   */
  axis?: DragAxis;

  /**
   * Pixel boundaries the element cannot be dragged past.
   * Relative to the element's starting position.
   * { top: -100, bottom: 100, left: -200, right: 200 }
   */
  bounds?: DragBounds;

  /**
   * If true, the element decelerates with momentum after release.
   * The element glides based on its release velocity and gradually stops.
   * Default: true
   */
  momentum?: boolean;

  /**
   * Deceleration rate for momentum (px/s²). Higher = stops faster.
   * Default: 800
   */
  deceleration?: number;

  /**
   * Snap points. After drag ends (and momentum settles), the element
   * springs to the nearest snap point.
   */
  snap?: SnapTo;

  /**
   * Spring config for the bounds bounce-back and snap animation.
   * Default: { stiffness: 300, damping: 28 }
   */
  spring?: { stiffness?: number; damping?: number };

  /**
   * Cursor style during drag. Default: "grabbing"
   */
  cursor?: string;

  /**
   * Called on every frame during drag with the current offset.
   */
  onDrag?: (state: DragState) => void;

  /**
   * Called when drag starts.
   */
  onDragStart?: (state: DragState) => void;

  /**
   * Called when drag ends (before momentum/snap).
   */
  onDragEnd?: (state: DragState) => void;

  /**
   * Called when the element reaches its final resting position
   * (after momentum and snap complete).
   */
  onSettle?: (state: DragState) => void;
};

export type DragState = {
  /** Current x offset from starting position (px) */
  x: number;
  /** Current y offset from starting position (px) */
  y: number;
  /** Current x velocity (px/s) */
  velocityX: number;
  /** Current y velocity (px/s) */
  velocityY: number;
  /** Whether currently being dragged */
  isDragging: boolean;
};

export type DragControls = {
  /** Remove all listeners and stop tracking */
  stop: () => void;
  /** Get the current drag state */
  state: () => DragState;
  /** Programmatically set position (animates with spring) */
  moveTo: (x: number, y: number) => void;
  /** Reset to starting position with spring animation */
  reset: () => void;
};

// ============================================================================
// Velocity tracker
// ============================================================================

type VelocitySample = { x: number; y: number; t: number };

class VelocityTracker {
  private samples: VelocitySample[] = [];
  private readonly maxAge = 100; // only use samples from last 100ms

  add(x: number, y: number): void {
    const t = performance.now();
    this.samples.push({ x, y, t });
    // Prune old samples
    const cutoff = t - this.maxAge;
    while (this.samples.length > 0 && this.samples[0]!.t < cutoff) {
      this.samples.shift();
    }
  }

  get(): { vx: number; vy: number } {
    const s = this.samples;
    if (s.length < 2) return { vx: 0, vy: 0 };
    const first = s[0]!;
    const last = s[s.length - 1]!;
    const dt = (last.t - first.t) / 1000; // seconds
    if (dt < 0.001) return { vx: 0, vy: 0 };
    return {
      vx: (last.x - first.x) / dt,
      vy: (last.y - first.y) / dt,
    };
  }

  reset(): void {
    this.samples = [];
  }
}

// ============================================================================
// Core drag implementation
// ============================================================================

export function createDrag(
  target: JumpTarget,
  options: DragOptions = {},
): DragControls {
  const elements = resolveTargets(target);
  if (elements.length === 0) {
    return {
      stop: () => {},
      state: () => ({ x: 0, y: 0, velocityX: 0, velocityY: 0, isDragging: false }),
      moveTo: () => {},
      reset: () => {},
    };
  }

  const el = elements[0]! as HTMLElement;
  const {
    axis = "both",
    bounds,
    momentum = true,
    deceleration = 800,
    snap,
    spring: springConfig = { stiffness: 300, damping: 28 },
    cursor = "grabbing",
    onDrag,
    onDragStart,
    onDragEnd,
    onSettle,
  } = options;

  // State
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let startPointerX = 0;
  let startPointerY = 0;
  let startOffsetX = 0;
  let startOffsetY = 0;
  let prevCursor = "";
  const velocity = new VelocityTracker();

  function getState(): DragState {
    const v = velocity.get();
    return {
      x: offsetX,
      y: offsetY,
      velocityX: v.vx,
      velocityY: v.vy,
      isDragging,
    };
  }

  function applyTransform(x: number, y: number): void {
    // Direct style during drag for zero-latency (no WAAPI delay)
    const tx = axis === "y" ? 0 : x;
    const ty = axis === "x" ? 0 : y;
    el.style.transform = `translate(${tx}px, ${ty}px)`;
  }

  function clampToBounds(x: number, y: number): { x: number; y: number } {
    let cx = x;
    let cy = y;
    if (bounds) {
      if (bounds.left !== undefined) cx = Math.max(bounds.left, cx);
      if (bounds.right !== undefined) cx = Math.min(bounds.right, cx);
      if (bounds.top !== undefined) cy = Math.max(bounds.top, cy);
      if (bounds.bottom !== undefined) cy = Math.min(bounds.bottom, cy);
    }
    return { x: cx, y: cy };
  }

  function findNearestSnap(x: number, y: number): { x: number; y: number } {
    let sx = x;
    let sy = y;
    if (snap?.x && snap.x.length > 0) {
      sx = snap.x.reduce((nearest, pt) =>
        Math.abs(pt - x) < Math.abs(nearest - x) ? pt : nearest,
      );
    }
    if (snap?.y && snap.y.length > 0) {
      sy = snap.y.reduce((nearest, pt) =>
        Math.abs(pt - y) < Math.abs(nearest - y) ? pt : nearest,
      );
    }
    return { x: sx, y: sy };
  }

  function animateTo(x: number, y: number, onDone?: () => void): void {
    const { easing, duration } = createSpring(springConfig);
    cancelAndCommit(el);
    const tx = axis === "y" ? 0 : x;
    const ty = axis === "x" ? 0 : y;
    const currentTx = axis === "y" ? 0 : offsetX;
    const currentTy = axis === "x" ? 0 : offsetY;

    const anim = el.animate(
      [
        { transform: `translate(${currentTx}px, ${currentTy}px)` },
        { transform: `translate(${tx}px, ${ty}px)` },
      ],
      { duration, easing, fill: "forwards" },
    );

    // Update state when done — only if not cancelled by a new drag/animation
    anim.finished.then(() => {
      offsetX = x;
      offsetY = y;
      onDone?.();
    }).catch(() => {});
  }

  function handleRelease(): void {
    const v = velocity.get();
    let targetX = offsetX;
    let targetY = offsetY;

    if (momentum && (Math.abs(v.vx) > 50 || Math.abs(v.vy) > 50)) {
      // Project momentum: distance = v² / (2 * deceleration)
      if (axis !== "y") {
        targetX += (v.vx * Math.abs(v.vx)) / (2 * deceleration);
      }
      if (axis !== "x") {
        targetY += (v.vy * Math.abs(v.vy)) / (2 * deceleration);
      }
    }

    // Clamp to bounds
    const clamped = clampToBounds(targetX, targetY);
    targetX = clamped.x;
    targetY = clamped.y;

    // Snap to nearest snap point
    if (snap) {
      const snapped = findNearestSnap(targetX, targetY);
      targetX = snapped.x;
      targetY = snapped.y;
    }

    animateTo(targetX, targetY, () => {
      onSettle?.(getState());
    });
  }

  // ── Pointer event handlers ──────────────────────────────────────────

  function onPointerDown(e: PointerEvent): void {
    if (isDragging) return;
    isDragging = true;

    startPointerX = e.clientX;
    startPointerY = e.clientY;
    startOffsetX = offsetX;
    startOffsetY = offsetY;
    velocity.reset();
    velocity.add(startOffsetX, startOffsetY);

    // Cancel any in-flight momentum/snap animation
    cancelAndCommit(el);

    // Capture pointer for reliable tracking even outside element bounds
    el.setPointerCapture(e.pointerId);

    // Set cursor
    prevCursor = el.style.cursor;
    el.style.cursor = cursor;
    document.body.style.cursor = cursor;

    // Prevent text selection during drag
    el.style.userSelect = "none";

    onDragStart?.(getState());
  }

  function onPointerMove(e: PointerEvent): void {
    if (!isDragging) return;

    const rawX = startOffsetX + (e.clientX - startPointerX);
    const rawY = startOffsetY + (e.clientY - startPointerY);

    // Track velocity in OFFSET space, not screen space.
    // This ensures momentum direction is correct even inside transformed containers.
    velocity.add(rawX, rawY);

    // During drag: allow slight overdrag past bounds with rubber-band feel
    let x = rawX;
    let y = rawY;
    if (bounds) {
      x = rubberBand(rawX, bounds.left, bounds.right);
      y = rubberBand(rawY, bounds.top, bounds.bottom);
    }

    if (axis === "y") x = 0;
    if (axis === "x") y = 0;

    offsetX = x;
    offsetY = y;
    applyTransform(x, y);

    onDrag?.(getState());
  }

  function onPointerUp(e: PointerEvent): void {
    if (!isDragging) return;
    isDragging = false;

    el.releasePointerCapture(e.pointerId);
    el.style.cursor = prevCursor;
    document.body.style.cursor = "";
    el.style.userSelect = "";

    onDragEnd?.(getState());
    handleRelease();
  }

  function onPointerCancel(e: PointerEvent): void {
    onPointerUp(e);
  }

  // ── Set up ────────────────────────────────────────────────────────

  el.style.touchAction = axis === "x" ? "pan-y" : axis === "y" ? "pan-x" : "none";
  el.style.cursor = "grab";

  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", onPointerUp);
  el.addEventListener("pointercancel", onPointerCancel);
  // Prevent native drag (images, links)
  el.addEventListener("dragstart", preventDefault);

  return {
    stop() {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerCancel);
      el.removeEventListener("dragstart", preventDefault);
      el.style.touchAction = "";
      el.style.cursor = "";
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = "";
        el.style.userSelect = "";
      }
    },
    state: getState,
    moveTo(x: number, y: number) {
      const clamped = clampToBounds(x, y);
      animateTo(clamped.x, clamped.y);
    },
    reset() {
      animateTo(0, 0);
    },
  };
}

// ============================================================================
// Rubber-band: overdrag past bounds with diminishing returns
// ============================================================================

function rubberBand(
  value: number,
  min: number | undefined,
  max: number | undefined,
): number {
  const ELASTICITY = 0.5;
  const MAX_OVER = 100; // max overdrag in px

  if (min !== undefined && value < min) {
    const over = min - value;
    return min - Math.min(MAX_OVER, over * ELASTICITY);
  }
  if (max !== undefined && value > max) {
    const over = value - max;
    return max + Math.min(MAX_OVER, over * ELASTICITY);
  }
  return value;
}

function preventDefault(e: Event): void {
  e.preventDefault();
}
