// ============================================================================
// SVG Animation — Line Drawing & Path Utilities
// ============================================================================
//
// API:
//   jump(svgPath, "draw")          — draw the stroke from 0% to 100%
//   jump(svgPath, "draw in")       — same as "draw"
//   jump(svgPath, "draw out")      — reverse: erase from 100% to 0%
//   jump(svgPath, "erase")         — same as "draw out"
//   jump.svg.prepare(el)           — set up dasharray for custom control
//   jump.svg.draw(el, from, to, options) — draw from X% to Y%
//
// Works on: <path>, <line>, <polyline>, <polygon>, <circle>, <ellipse>, <rect>
// ============================================================================

import type { JumpOptions } from "../types/index.js";
import { resolveEasing } from "./easings.js";
import { tagAnimation } from "./engine.js";
import { createSpring } from "./spring.js";

type SVGDrawableElement =
  | SVGPathElement
  | SVGLineElement
  | SVGPolylineElement
  | SVGPolygonElement
  | SVGCircleElement
  | SVGEllipseElement
  | SVGRectElement;

/**
 * Prepares an SVG element for stroke animation by measuring its total
 * length and setting `stroke-dasharray` and `stroke-dashoffset`.
 *
 * Returns the total length in pixels.
 */
export function prepareSVG(element: SVGElement): number {
  const el = element as unknown as SVGGeometryElement;
  if (typeof el.getTotalLength !== "function") {
    throw new Error(
      `[jump] Element does not support getTotalLength(). ` +
        `SVG drawing works on: path, line, polyline, polygon, circle, ellipse, rect.`,
    );
  }

  const length = el.getTotalLength();
  el.style.strokeDasharray = `${length}`;
  el.style.strokeDashoffset = `${length}`;
  return length;
}

/**
 * Animates an SVG element's stroke from one percentage to another.
 *
 * @param element The SVG element to draw
 * @param from Start percentage (0 = fully hidden, 1 = fully drawn)
 * @param to End percentage (0 = fully hidden, 1 = fully drawn)
 * @param options Animation options
 */
export function drawSVG(
  element: SVGElement,
  from: number,
  to: number,
  options: JumpOptions = {},
): Animation {
  const length = prepareSVG(element);

  const fromOffset = length * (1 - from);
  const toOffset = length * (1 - to);

  const { easing, duration: springDur } = createSpring({ stiffness: 200, damping: 30 });
  const resolvedEasing = options.easing
    ? resolveEasing(options.easing)
    : easing;
  const resolvedDuration = options.duration ?? springDur;

  const anim = element.animate(
    [
      { strokeDashoffset: fromOffset },
      { strokeDashoffset: toOffset },
    ],
    {
      duration: resolvedDuration,
      delay: options.delay ?? 0,
      easing: resolvedEasing,
      fill: "forwards",
    },
  );

  tagAnimation(anim);
  return anim;
}

/**
 * Draws an SVG element's stroke from 0% to 100% ("draw in").
 */
export function drawIn(
  element: SVGElement,
  options: JumpOptions = {},
): Animation {
  return drawSVG(element, 0, 1, options);
}

/**
 * Erases an SVG element's stroke from 100% to 0% ("draw out" / "erase").
 */
export function drawOut(
  element: SVGElement,
  options: JumpOptions = {},
): Animation {
  return drawSVG(element, 1, 0, options);
}
