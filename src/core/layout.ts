// ============================================================================
// Jump Layout Animations — FLIP Engine
// ============================================================================
//
// The API:
//   jump.layout(el, options?)            — auto-animate layout changes
//   jump.shared(el, id, options?)        — shared element transition
//   jump.snapshot(el, id)                — capture position for later FLIP
//   jump.flip(el, snapshot, options?)    — animate from snapshot to current
//
// The intent: mark elements, name relationships. No coordinates.
// ============================================================================

import type {
  JumpOptions,
  LayoutSnapshot,
  LayoutOptions,
  LayoutStyle,
} from "../types/index.js";
import { cancelAndCommit, tagAnimation } from "./engine.js";
import { createSpring } from "./spring.js";
import { resolveEasing } from "./easings.js";

export type { LayoutSnapshot, LayoutOptions, LayoutStyle };

// ============================================================================
// Layout style resolution
// ============================================================================

function resolveLayoutStyle(style: LayoutStyle = "spring"): {
  easing: string;
  duration: number;
} {
  switch (style) {
    case "spring":
      return createSpring({ stiffness: 260, damping: 28 });
    case "snappy":
      return createSpring({ stiffness: 400, damping: 36 });
    case "bouncy":
      return createSpring({ stiffness: 320, damping: 18 });
    case "slow":
      return { easing: resolveEasing("ease-in-out-cubic"), duration: 600 };
    case "smooth":
      return { easing: resolveEasing("ease-in-out-cubic"), duration: 320 };
  }
}

// ============================================================================
// Snapshot
// ============================================================================

/**
 * Captures the current visual state of an element.
 * Call this BEFORE a DOM mutation, then call flip() AFTER.
 */
export function snapshot(element: Element): LayoutSnapshot {
  const rect = element.getBoundingClientRect();
  const cs = window.getComputedStyle(element);
  return {
    rect,
    opacity: parseFloat(cs.opacity ?? "1"),
    borderRadius: cs.borderRadius ?? "0px",
    transform: cs.transform === "none" ? "" : cs.transform,
  };
}

// ============================================================================
// FLIP core
// ============================================================================

/**
 * Animates an element from a previously captured snapshot to its current
 * DOM position. This is the raw FLIP primitive.
 *
 * The element must already be in its NEW DOM position when this is called.
 */
export function flip(
  element: Element,
  from: LayoutSnapshot,
  options: LayoutOptions = {},
): Animation | null {
  const to = element.getBoundingClientRect();

  const deltaX = from.rect.left - to.left;
  const deltaY = from.rect.top - to.top;
  const deltaW = from.rect.width / (to.width || 1);
  const deltaH = from.rect.height / (to.height || 1);

  const noMove =
    Math.abs(deltaX) < 0.5 &&
    Math.abs(deltaY) < 0.5 &&
    Math.abs(deltaW - 1) < 0.005 &&
    Math.abs(deltaH - 1) < 0.005;

  if (noMove) return null;

  const { easing, duration } = options.style
    ? resolveLayoutStyle(options.style)
    : {
        easing: options.easing ? resolveEasing(options.easing) : undefined,
        duration: options.duration,
      };

  const resolvedEasing = easing ?? resolveLayoutStyle("spring").easing;
  const resolvedDuration = duration ?? resolveLayoutStyle("spring").duration;

  cancelAndCommit(element);

  // Read the element's CURRENT computed state (post-mutation).
  // This is the "to" state — where the element should end up.
  const cs = window.getComputedStyle(element);
  const currentTransform = cs.transform === "none" ? "" : cs.transform;
  const currentBorderRadius = cs.borderRadius ?? "0px";

  const fromTransform = buildFlipTransform(
    deltaX,
    deltaY,
    deltaW,
    deltaH,
    currentTransform,
  );
  const toTransform = currentTransform || "none";

  const fromBorderRadius = correctBorderRadius(
    from.borderRadius,
    deltaW,
    deltaH,
  );
  const toBorderRadius = currentBorderRadius;

  const keyframes: Keyframe[] = [
    {
      transform: fromTransform,
      transformOrigin: "top left",
      ...(fromBorderRadius !== toBorderRadius
        ? { borderRadius: fromBorderRadius }
        : {}),
    },
    {
      transform: toTransform,
      transformOrigin: "top left",
      ...(fromBorderRadius !== toBorderRadius
        ? { borderRadius: toBorderRadius }
        : {}),
    },
  ];

  const anim = element.animate(keyframes, {
    duration: resolvedDuration,
    easing: resolvedEasing,
    fill: "forwards",
  });
  tagAnimation(anim);
  return anim;
}

function buildFlipTransform(
  deltaX: number,
  deltaY: number,
  scaleX: number,
  scaleY: number,
  existingTransform: string,
): string {
  const f = `translate(${deltaX}px, ${deltaY}px) scaleX(${scaleX}) scaleY(${scaleY})`;
  if (!existingTransform) return f;
  return `${f} ${existingTransform}`;
}

function correctBorderRadius(
  radius: string,
  scaleX: number,
  scaleY: number,
): string {
  if (!radius || radius === "0px") return radius;
  return radius.replace(/[\d.]+px/g, (match) => {
    const px = parseFloat(match);
    const correction = 2 / (scaleX + scaleY);
    return `${Math.round(px * correction * 10) / 10}px`;
  });
}

// ============================================================================
// Shared Element Registry
// ============================================================================

type SharedRecord = {
  element: WeakRef<Element>;
  snap: LayoutSnapshot;
  options: LayoutOptions;
};

const sharedRegistry = new Map<string, SharedRecord>();

/**
 * Records the current position of an element under a shared identity.
 * The next element registered with the same id will animate from here.
 */
export function recordShared(
  element: Element,
  id: string,
  options: LayoutOptions = {},
): void {
  sharedRegistry.set(id, {
    element: new WeakRef(element),
    snap: snapshot(element),
    options,
  });
}

/**
 * Animates a newly-mounted element from the last recorded position of
 * a shared id to its current DOM position.
 *
 * If the source element is still in the DOM and visible, runs a crossfade:
 * the source fades out while the destination fades in and FLIP-translates.
 *
 * Returns null if there is no prior record for this id.
 */
export function animateShared(
  element: Element,
  id: string,
  options: LayoutOptions = {},
): Animation | null {
  const record = sharedRegistry.get(id);
  if (!record) return null;

  const mergedOptions = { ...record.options, ...options };
  const { easing, duration } = mergedOptions.style
    ? resolveLayoutStyle(mergedOptions.style)
    : {
        easing: mergedOptions.easing
          ? resolveEasing(mergedOptions.easing)
          : undefined,
        duration: mergedOptions.duration,
      };
  const resolvedEasing = easing ?? resolveLayoutStyle("spring").easing;
  const resolvedDuration = duration ?? resolveLayoutStyle("spring").duration;

  // Check if the source element is still in the DOM and visible.
  // If so, crossfade it out while the new element animates in.
  const sourceEl = record.element.deref();
  if (sourceEl && sourceEl !== element && sourceEl.isConnected) {
    crossfadeOut(sourceEl, resolvedDuration);
  }

  // Update the registry to point to the new element
  sharedRegistry.set(id, {
    element: new WeakRef(element),
    snap: snapshot(element),
    options: mergedOptions,
  });

  // Fade in the destination as it FLIP-translates into place
  const flipAnim = flip(element, record.snap, mergedOptions);

  // Layer a fade-in on the destination if we're crossfading
  if (sourceEl && sourceEl !== element && sourceEl.isConnected) {
    element.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: resolvedDuration * 0.6, easing: "ease-out", fill: "none" },
    );
  }

  return flipAnim;
}

/**
 * Fades out the source element of a shared transition.
 * Uses a short fade that completes before the full FLIP duration.
 */
function crossfadeOut(
  element: Element,
  totalDuration: number,
): void {
  const anim = element.animate(
    [{ opacity: 1 }, { opacity: 0 }],
    {
      duration: totalDuration * 0.5,
      easing: "ease-in",
      fill: "none",
    },
  );
  // Commit opacity:0 as inline style on finish so the element stays hidden
  // without a zombie fill animation blocking future style changes.
  anim.finished.then(() => {
    try {
      (element as HTMLElement).style.opacity = "0";
    } catch { /* detached */ }
  }).catch(() => {});
}

/**
 * Returns the last snapshot for a shared id (or null).
 */
export function getSharedSnapshot(id: string): LayoutSnapshot | null {
  return sharedRegistry.get(id)?.snap ?? null;
}

/**
 * Clears a shared id from the registry.
 */
export function clearShared(id: string): void {
  sharedRegistry.delete(id);
}

// ============================================================================
// Auto-layout watcher
// ============================================================================

type LayoutWatcherEntry = {
  snap: LayoutSnapshot;
  options: LayoutOptions;
};

const watchedElements = new WeakMap<Element, LayoutWatcherEntry>();

let resizeObserver: ResizeObserver | null = null;

function getResizeObserver(): ResizeObserver {
  if (!resizeObserver) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target;
        const record = watchedElements.get(el);
        if (!record) continue;

        const prev = record.snap;
        // Snapshot BEFORE flip — flip() calls cancelAndCommit which changes
        // computed styles. If we snapshot after, we capture the committed
        // mid-animation values instead of the true new layout position.
        const newSnap = snapshot(el);
        flip(el, prev, record.options);
        record.snap = newSnap;
      }
    });
  }
  return resizeObserver;
}

/**
 * Watches an element for layout changes and auto-runs FLIP.
 * Returns an unwatch function.
 */
export function watchLayout(
  element: Element,
  options: LayoutOptions = {},
): () => void {
  watchedElements.set(element, { snap: snapshot(element), options });
  getResizeObserver().observe(element);

  return () => {
    getResizeObserver().unobserve(element);
    watchedElements.delete(element);
  };
}

// ============================================================================
// Scale correction for children of FLIP-animated parents
// ============================================================================

/**
 * Applies per-frame inverse scale correction to a child element whose parent
 * is being FLIP-animated. Prevents the child from visually distorting when
 * the parent is scaled.
 *
 * Returns a cancel function. Called automatically by the React <Layout>
 * component for children that are also <Layout>-wrapped.
 */
export function correctChildScale(
  child: Element,
  parentAnimation: Animation,
): () => void {
  let rafId: number;
  let cancelled = false;

  function frame() {
    if (cancelled) return;

    const effect = parentAnimation.effect;
    if (!effect) {
      cleanup();
      return;
    }

    if (
      parentAnimation.playState === "finished" ||
      parentAnimation.playState === "idle"
    ) {
      cleanup();
      return;
    }

    const parentTarget = (effect as KeyframeEffect).target;
    if (!parentTarget) {
      cleanup();
      return;
    }

    const parentTransform = window.getComputedStyle(parentTarget).transform;

    if (parentTransform && parentTransform !== "none") {
      const m = new DOMMatrix(parentTransform);
      const parentScaleX = Math.sqrt(m.a * m.a + m.b * m.b);
      const parentScaleY = Math.sqrt(m.c * m.c + m.d * m.d);

      if (Math.abs(parentScaleX - 1) > 0.001 || Math.abs(parentScaleY - 1) > 0.001) {
        (child as HTMLElement).style.transform =
          `scaleX(${1 / parentScaleX}) scaleY(${1 / parentScaleY})`;
      } else {
        (child as HTMLElement).style.transform = "";
      }
    } else {
      (child as HTMLElement).style.transform = "";
    }

    rafId = requestAnimationFrame(frame);
  }

  function cleanup() {
    (child as HTMLElement).style.transform = "";
  }

  rafId = requestAnimationFrame(frame);

  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
    cleanup();
  };
}
