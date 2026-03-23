import type { EasingPreset } from "../types/index.js";

/**
 * Maps easing preset names to CSS easing strings (cubic-bezier or linear).
 * Spring easings use approximated cubic-bezier curves for WAAPI compatibility.
 */
const EASING_MAP: Record<EasingPreset, string> = {
  // Standard CSS easings
  linear: "linear",
  ease: "ease",
  "ease-in": "ease-in",
  "ease-out": "ease-out",
  "ease-in-out": "ease-in-out",

  // Quad
  "ease-in-quad": "cubic-bezier(0.55, 0.085, 0.68, 0.53)",
  "ease-out-quad": "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  "ease-in-out-quad": "cubic-bezier(0.455, 0.03, 0.515, 0.955)",

  // Cubic
  "ease-in-cubic": "cubic-bezier(0.55, 0.055, 0.675, 0.19)",
  "ease-out-cubic": "cubic-bezier(0.215, 0.61, 0.355, 1)",
  "ease-in-out-cubic": "cubic-bezier(0.645, 0.045, 0.355, 1)",

  // Quart
  "ease-in-quart": "cubic-bezier(0.895, 0.03, 0.685, 0.22)",
  "ease-out-quart": "cubic-bezier(0.165, 0.84, 0.44, 1)",
  "ease-in-out-quart": "cubic-bezier(0.77, 0, 0.175, 1)",

  // Expo
  "ease-in-expo": "cubic-bezier(0.95, 0.05, 0.795, 0.035)",
  "ease-out-expo": "cubic-bezier(0.19, 1, 0.22, 1)",
  "ease-in-out-expo": "cubic-bezier(1, 0, 0, 1)",

  // Circ
  "ease-in-circ": "cubic-bezier(0.6, 0.04, 0.98, 0.335)",
  "ease-out-circ": "cubic-bezier(0.075, 0.82, 0.165, 1)",
  "ease-in-out-circ": "cubic-bezier(0.785, 0.135, 0.15, 0.86)",

  // Back (overshoot)
  "ease-in-back": "cubic-bezier(0.6, -0.28, 0.735, 0.045)",
  "ease-out-back": "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  "ease-in-out-back": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",

  // Spring approximations
  spring: "cubic-bezier(0.2, 1.2, 0.4, 1)",
  "spring-gentle": "cubic-bezier(0.25, 1.1, 0.5, 1)",
  "spring-bouncy": "cubic-bezier(0.15, 1.4, 0.35, 1)",
  "spring-stiff": "cubic-bezier(0.1, 1.0, 0.3, 1)",
};

/**
 * Resolves an easing preset name to a CSS easing string.
 * If the input is already a CSS string (e.g. cubic-bezier(...)), it passes through.
 */
export function resolveEasing(easing: string): string {
  return EASING_MAP[easing as EasingPreset] ?? easing;
}

/**
 * Returns the default easing for a given animation intent category.
 * Enters use ease-out (decelerate into place).
 * Exits use ease-in (accelerate away).
 * Emphasis uses ease-in-out.
 */
export function defaultEasingForIntent(intent: string): string {
  if (
    intent.includes("enter") ||
    intent.includes("fade in") ||
    intent.includes("slide") ||
    intent.includes("scale up") ||
    intent.includes("grow")
  ) {
    return EASING_MAP["ease-out-cubic"];
  }
  if (
    intent.includes("exit") ||
    intent.includes("fade out") ||
    intent.includes("scale down") ||
    intent.includes("shrink")
  ) {
    return EASING_MAP["ease-in-cubic"];
  }
  if (
    intent.includes("flip") ||
    intent.includes("rotate")
  ) {
    return EASING_MAP["ease-in-out-cubic"];
  }
  // Emphasis animations get a spring feel
  return EASING_MAP["spring"];
}
