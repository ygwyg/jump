// ============================================================================
// jump.scroll() — Scroll-driven animations with a readable API
// ============================================================================
// Wraps the WAAPI ScrollTimeline / ViewTimeline APIs with human-readable
// offset syntax so you don't need to know what "cover 0%" means.
//
// Browser support:
//   ScrollTimeline: Chrome 115+, Firefox (behind flag), Safari (coming)
//   ViewTimeline:   Chrome 115+, Firefox 114+, Safari 18+
//
// Falls back to IntersectionObserver-based triggering on unsupported browsers.
// ============================================================================

import type { JumpTarget, AnimationDefinition, JumpOptions } from "../types/index.js";
import { resolveTargets, animateElement, createControls, prefersReducedMotion } from "./engine.js";
import { resolveIntent, isIntentString } from "./intent.js";
import { jumpKeyframesToWaapi } from "./engine.js";
import { resolveEasing, defaultEasingForIntent } from "./easings.js";
import type { JumpKeyframe, AnimatableProperties } from "../types/index.js";
import { propertiesToKeyframes } from "./engine.js";

const scrollObserverMap = new WeakMap<Element, IntersectionObserver>();

// ============================================================================
// Offset parsing
// ============================================================================

/**
 * Human-readable scroll offset syntax.
 *
 * Format: "{element-edge} {viewport-edge}"
 * - Element edges: "top", "center", "bottom"
 * - Viewport edges: "top", "center", "bottom" or percentages like "20%"
 *
 * Examples:
 *   "top bottom"    — when element's top hits viewport bottom (element enters)
 *   "bottom top"    — when element's bottom hits viewport top (element exits)
 *   "center center" — when element's center reaches viewport center
 *   "top 80%"       — when element's top is 80% down the viewport
 */
export type ScrollOffset = string;

export type ScrollOptions = JumpOptions & {
  /**
   * The element whose scroll position drives the animation.
   * Default: the nearest scrollable ancestor, or the viewport.
   */
  container?: Element | Window;

  /**
   * When (relative to the subject element) the animation starts.
   * Default: "top bottom" (element's top edge reaches viewport bottom = entering)
   */
  enter?: ScrollOffset;

  /**
   * When the animation ends / reaches its final state.
   * Default: "bottom top" (element's bottom edge reaches viewport top = fully passed)
   */
  exit?: ScrollOffset;

  /**
   * If true, the animation progress is tied directly to scroll position
   * (scrub mode — scroll forward = animate forward, scroll back = reverse).
   * If false, the animation plays once when triggered.
   * Default: false
   */
  sync?: boolean;

  /**
   * Scroll axis. Default: "y" (vertical scroll)
   */
  axis?: "x" | "y";
};

// ============================================================================
// Browser support detection
// ============================================================================

function supportsViewTimeline(): boolean {
  return typeof ViewTimeline !== "undefined";
}

// ============================================================================
// Offset string → WAAPI range values
// ============================================================================

type ResolvedOffset = {
  /** CSS offset for use in rangeStart/rangeEnd */
  css: string;
  /** Threshold for IntersectionObserver fallback (0–1) */
  threshold: number;
};

function parseOffset(offset: string): ResolvedOffset {
  const parts = offset.trim().split(/\s+/);
  const edge = (parts[0] ?? "top").toLowerCase();
  const position = (parts[1] ?? "bottom").toLowerCase();

  // Map to CSS named range format: "entry 0%", "cover 50%", etc.
  // The WAAPI ViewTimeline range names are:
  //   "entry"  = element entering the viewport
  //   "cover"  = element covering the viewport
  //   "exit"   = element leaving the viewport
  //   "contain"= element contained within the viewport

  let css: string;
  let threshold = 0;

  if (edge === "top" && position === "bottom") {
    css = "entry 0%";
    threshold = 0;
  } else if (edge === "top" && position === "top") {
    css = "entry 100%";
    threshold = 0.1;
  } else if (edge === "bottom" && position === "top") {
    css = "exit 100%";
    threshold = 0.9;
  } else if (edge === "bottom" && position === "bottom") {
    css = "exit 0%";
    threshold = 0.5;
  } else if (edge === "center" && position === "center") {
    css = "cover 50%";
    threshold = 0.5;
  } else if (edge === "top" && position === "center") {
    css = "cover 0%";
    threshold = 0.3;
  } else if (edge === "bottom" && position === "center") {
    css = "cover 100%";
    threshold = 0.7;
  } else if (position.endsWith("%")) {
    const pct = parseFloat(position) / 100;
    if (edge === "top") {
      css = `entry ${Math.round(pct * 100)}%`;
      threshold = pct * 0.3;
    } else {
      css = `cover ${Math.round(pct * 100)}%`;
      threshold = pct;
    }
  } else {
    // Passthrough — already a CSS range value
    css = offset;
    threshold = 0.2;
  }

  return { css, threshold };
}

// ============================================================================
// Main scroll function
// ============================================================================

/**
 * Animates an element driven by scroll position.
 *
 * With `sync: true` — the animation scrubs with the scroll (like a progress bar).
 * Without sync — the animation plays once when the element enters the viewport.
 *
 * ```ts
 * // Fade in as element enters viewport (one-shot)
 * jump.scroll(el, "fade in slide up")
 *
 * // Sync to scroll position (scrub)
 * jump.scroll(el, { y: [-30, 0] }, { sync: true })
 *
 * // Custom trigger points
 * jump.scroll(el, "fade in", {
 *   enter: "top 80%",   // start when top of el is 80% down the viewport
 *   exit:  "top 20%",   // finish when top of el is 20% down
 * })
 *
 * // Horizontal scroll
 * jump.scroll(el, "enter from left", { axis: "x", sync: true })
 * ```
 */
export function createScroll(
  target: JumpTarget,
  animation: AnimationDefinition,
  options: ScrollOptions = {},
): { stop: () => void } {
  const elements = resolveTargets(target);
  if (elements.length === 0) return { stop: () => {} };

  const {
    enter = "top bottom",
    exit  = "bottom top",
    sync  = false,
    axis  = "y",
    container,
    ...jumpOpts
  } = options;

  const enterOffset = parseOffset(enter);
  const exitOffset  = parseOffset(exit);

  if ((jumpOpts.respectMotionPreference ?? true) && prefersReducedMotion()) {
    return { stop: () => {} };
  }

  const animations: Animation[] = [];

  for (const element of elements) {
    let keyframes: Keyframe[];
    let resolvedEasing: string;

    if (isIntentString(animation)) {
      const resolved = resolveIntent(animation, jumpOpts);
      keyframes = jumpKeyframesToWaapi(resolved.keyframes);
      resolvedEasing = jumpOpts.easing
        ? resolveEasing(jumpOpts.easing)
        : defaultEasingForIntent(animation);
    } else if (Array.isArray(animation)) {
      keyframes = jumpKeyframesToWaapi(animation as JumpKeyframe[]);
      resolvedEasing = jumpOpts.easing ? resolveEasing(jumpOpts.easing) : "ease-in-out";
    } else if (typeof animation === "object") {
      keyframes = propertiesToKeyframes(element, animation as AnimatableProperties);
      resolvedEasing = jumpOpts.easing ? resolveEasing(jumpOpts.easing) : "ease-in-out";
    } else {
      continue;
    }

    if (supportsViewTimeline()) {
      // ── Native ViewTimeline path ─────────────────────────────────
      const scrollContainer = container instanceof Element ? container : undefined;

      const timeline = new ViewTimeline({
        subject: element,
        axis: axis === "x" ? "inline" : "block",
        ...(scrollContainer ? { source: scrollContainer } : {}),
      } as ViewTimelineOptions);

      const wapiOptions: KeyframeAnimationOptions = {
        duration: jumpOpts.duration ?? 1000,
        easing: sync ? "linear" : resolvedEasing,
        fill: "both",
        ...(sync
          ? {
              // Sync to scroll: run the full animation between enter and exit
              rangeStart: enterOffset.css,
              rangeEnd: exitOffset.css,
            }
          : {
              // One-shot: play animation when entering, reversed at exit if exit set
              rangeStart: enterOffset.css,
              rangeEnd: exitOffset.css,
              iterations: 1,
            }),
      };

      const anim = element.animate(keyframes, {
        ...wapiOptions,
        timeline,
      } as KeyframeAnimationOptions);

      animations.push(anim);
    } else {
      // ── IntersectionObserver fallback ────────────────────────────
      // One-shot: animate when threshold is crossed
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const ctrl = animateElement(
                element,
                keyframes,
                jumpOpts,
                resolvedEasing,
              );
              animations.push(ctrl);
              if (!sync) observer.unobserve(element);
            }
          }
        },
        {
          threshold: enterOffset.threshold,
          root: container instanceof Element ? container : undefined,
        },
      );
      observer.observe(element);
      scrollObserverMap.set(element, observer);
    }
  }

  return {
    stop() {
      animations.forEach((a) => a.cancel());
      for (const el of elements) {
        const obs = scrollObserverMap.get(el);
        if (obs) { obs.disconnect(); scrollObserverMap.delete(el); }
      }
    },
  };
}

// ============================================================================
// Type declarations for APIs that may not be in all TS lib versions
// ============================================================================

// ViewTimeline might not be in older @types/lib — declare minimal shape
declare global {
  interface ViewTimelineOptions {
    subject: Element;
    axis?: "block" | "inline" | "x" | "y";
    source?: Element;
  }
  class ViewTimeline extends AnimationTimeline {
    constructor(options: ViewTimelineOptions);
  }
}
