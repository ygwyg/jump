// ============================================================================
// jump.text() — Text Splitting & Animation
// ============================================================================
// Splits text into characters, words, or lines, then animates each piece
// with stagger. Preserves accessibility (screen readers see the original text).
//
// API:
//   jump.text(el, "reveal by word")
//   jump.text(el, "reveal by char")
//   jump.text(el, "typewriter")
//   jump.text(el, "scramble", { duration: 800 })
// ============================================================================

import type { JumpOptions, JumpControls } from "../types/index.js";
import { createSpring } from "./spring.js";

export type TextMode =
  | "reveal by word"
  | "reveal by char"
  | "reveal by line"
  | "typewriter"
  | "scramble";

export type TextOptions = JumpOptions & {
  /** Characters used for the scramble effect. Default: alphanumeric */
  scrambleChars?: string;
  /** For typewriter: milliseconds between each character. Default: 40 */
  typeSpeed?: number;
  /** For reveal modes: the enter animation intent for each piece. Default: "enter from bottom" */
  enter?: string;
};

const DEFAULT_SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&";

/**
 * Splits text into animatable pieces and runs a coordinated animation.
 *
 * The original text is preserved in an `aria-label` on the container
 * so screen readers read it normally.
 *
 * Returns JumpControls for the animation (except typewriter/scramble
 * which return a simpler { cancel, finished } object).
 */
export function createTextAnimation(
  element: HTMLElement,
  mode: TextMode,
  options: TextOptions = {},
): { cancel: () => void; finished: Promise<void> } {
  const originalText = element.textContent ?? "";

  switch (mode) {
    case "reveal by word":
      return revealSplit(element, originalText, splitWords, options);
    case "reveal by char":
      return revealSplit(element, originalText, splitChars, options);
    case "reveal by line":
      return revealSplit(element, originalText, splitLines, options);
    case "typewriter":
      return typewriter(element, originalText, options);
    case "scramble":
      return scramble(element, originalText, options);
  }
}

// ============================================================================
// Splitting utilities
// ============================================================================

function splitWords(text: string): string[] {
  return text.split(/(\s+)/).filter(Boolean);
}

function splitChars(text: string): string[] {
  return [...text];
}

function splitLines(text: string): string[] {
  return text.split("\n").filter(Boolean);
}

// ============================================================================
// Reveal animation (word/char/line)
// ============================================================================

function revealSplit(
  element: HTMLElement,
  originalText: string,
  splitFn: (text: string) => string[],
  options: TextOptions,
): { cancel: () => void; finished: Promise<void> } {
  const pieces = splitFn(originalText);
  const enter = options.enter ?? "enter from bottom";

  // Preserve accessibility
  element.setAttribute("aria-label", originalText);
  element.setAttribute("role", "text");
  element.innerHTML = "";

  const spans: HTMLSpanElement[] = [];

  for (const piece of pieces) {
    if (piece.match(/^\s+$/)) {
      // Whitespace — preserve as-is, don't wrap in span
      element.appendChild(document.createTextNode(piece));
    } else {
      const span = document.createElement("span");
      span.textContent = piece;
      span.style.display = "inline-block";
      span.style.opacity = "0";
      element.appendChild(span);
      spans.push(span);
    }
  }

  const animations: Animation[] = [];
  const spring = createSpring({ stiffness: 260, damping: 24 });
  const dur = options.duration ?? spring.duration;
  const userStagger = options.stagger;
  const total = spans.length;

  spans.forEach((span, i) => {
    // Stagger: if user provided explicit stagger, use flat sequential delay.
    // If not, default to center-outward (the "reveal" feel).
    let staggerDelay: number;
    if (userStagger !== undefined) {
      staggerDelay = typeof userStagger === "function"
        ? userStagger(i, total)
        : i * userStagger;
    } else {
      // Center-outward: items near the middle animate first
      const center = (total - 1) / 2;
      const maxDist = Math.max(center, total - 1 - center) || 1;
      const t = Math.abs(i - center) / maxDist;
      staggerDelay = t * 40 * (total - 1); // 40ms base
    }

    const delay = (options.delay ?? 0) + staggerDelay;
    const dist_px = options.distance ?? 12;

    // Determine animation direction from the enter option
    let fromTransform = `translateY(${dist_px}px)`;
    if (enter.includes("top")) fromTransform = `translateY(${-dist_px}px)`;
    else if (enter.includes("left")) fromTransform = `translateX(${-dist_px}px)`;
    else if (enter.includes("right")) fromTransform = `translateX(${dist_px}px)`;
    else if (enter.includes("scale") || enter === "grow") fromTransform = `scale(0.8)`;

    // Use fill:"forwards" so spans stay visible if animation is interrupted.
    // The initial opacity:"0" inline style is overridden by the animation.
    const anim = span.animate(
      [
        { opacity: 0, transform: fromTransform },
        { opacity: 1, transform: "none" },
      ],
      {
        duration: dur,
        delay,
        easing: options.easing ?? spring.easing,
        fill: "forwards",
      },
    );

    animations.push(anim);
  });

  const finished = Promise.all(animations.map(a => a.finished))
    .then(() => { options.onComplete?.(); })
    .catch(() => {}) as Promise<void>;

  return {
    cancel() {
      animations.forEach(a => a.cancel());
      element.textContent = originalText;
      element.removeAttribute("aria-label");
      element.removeAttribute("role");
    },
    finished,
  };
}

// ============================================================================
// Typewriter
// ============================================================================

function typewriter(
  element: HTMLElement,
  text: string,
  options: TextOptions,
): { cancel: () => void; finished: Promise<void> } {
  const speed = options.typeSpeed ?? 40;
  let idx = 0;
  let cancelled = false;

  element.setAttribute("aria-label", text);
  element.textContent = "";

  // Add cursor
  const cursor = document.createElement("span");
  cursor.textContent = "|";
  cursor.style.animation = "jump-blink 1s step-end infinite";
  element.appendChild(cursor);

  // Inject blink keyframes if not present
  injectBlinkStyle();

  const finished = new Promise<void>((resolve) => {
    function tick() {
      if (cancelled || idx >= text.length) {
        if (!cancelled) {
          cursor.remove();
          options.onComplete?.();
        }
        resolve();
        return;
      }
      cursor.before(text[idx]!);
      idx++;
      setTimeout(tick, speed);
    }
    setTimeout(tick, options.delay ?? 0);
  });

  return {
    cancel() {
      cancelled = true;
      element.textContent = text;
      element.removeAttribute("aria-label");
    },
    finished,
  };
}

let blinkInjected = false;
function injectBlinkStyle(): void {
  if (blinkInjected) return;
  blinkInjected = true;
  const style = document.createElement("style");
  style.textContent = `@keyframes jump-blink{0%,100%{opacity:1}50%{opacity:0}}`;
  document.head.appendChild(style);
}

// ============================================================================
// Scramble
// ============================================================================

function scramble(
  element: HTMLElement,
  text: string,
  options: TextOptions,
): { cancel: () => void; finished: Promise<void> } {
  const chars = options.scrambleChars ?? DEFAULT_SCRAMBLE;
  const duration = options.duration ?? 800;
  const delay = options.delay ?? 0;
  let cancelled = false;

  element.setAttribute("aria-label", text);

  const finished = new Promise<void>((resolve) => {
    const start = performance.now() + delay;

    function frame(now: number) {
      if (cancelled) { resolve(); return; }

      const elapsed = now - start;
      if (elapsed < 0) {
        requestAnimationFrame(frame);
        return;
      }

      const progress = Math.min(1, elapsed / duration);
      // Number of characters that have settled
      const settled = Math.floor(progress * text.length);

      let display = "";
      for (let i = 0; i < text.length; i++) {
        if (i < settled) {
          display += text[i];
        } else if (text[i] === " ") {
          display += " ";
        } else {
          display += chars[Math.floor(Math.random() * chars.length)];
        }
      }

      element.textContent = display;

      if (progress >= 1) {
        element.textContent = text;
        element.removeAttribute("aria-label");
        options.onComplete?.();
        resolve();
      } else {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
  });

  return {
    cancel() {
      cancelled = true;
      element.textContent = text;
      element.removeAttribute("aria-label");
    },
    finished,
  };
}


