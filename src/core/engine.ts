import type {
  AnimatableProperties,
  JumpKeyframe,
  JumpOptions,
  JumpControls,
  JumpTarget,
  Ref,
} from "../types/index.js";
import { resolveEasing } from "./easings.js";

// ============================================================================
// Target Resolution
// ============================================================================

export function resolveTargets(target: JumpTarget): Element[] {
  if (typeof target === "string") {
    return Array.from(document.querySelectorAll(target));
  }
  if (target instanceof Element) return [target];
  if (target instanceof NodeList) return Array.from(target) as Element[];
  if (Array.isArray(target)) return target;
  if (isRef(target)) return target.current ? [target.current] : [];
  return [];
}

function isRef(value: unknown): value is Ref<Element | null> {
  return typeof value === "object" && value !== null && "current" in value;
}

// ============================================================================
// Motion Preference
// ============================================================================

/**
 * Returns true if the user has requested reduced motion.
 * Safe to call in SSR contexts (returns false).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ============================================================================
// Safe cancel with commitStyles
// ============================================================================

/** Tag used to identify animations created by Jump */
const JUMP_TAG = "__jump";

/** Marks an animation as created by Jump so cancelAndCommit only touches ours */
export function tagAnimation(anim: Animation): Animation {
  (anim as unknown as Record<string, unknown>)[JUMP_TAG] = true;
  return anim;
}

function isJumpAnimation(anim: Animation): boolean {
  return (anim as unknown as Record<string, unknown>)[JUMP_TAG] === true;
}

/**
 * Commits current animated styles into inline style, cancels all Jump
 * animations, then cleans up the committed inline styles.
 *
 * This three-step process ensures:
 * 1. The element doesn't snap back to pre-animation state (commitStyles)
 * 2. The animation effect stack is clear (cancel)
 * 3. Inline styles from previous animations don't pollute CSS specificity
 *    (cleanupCommittedStyles — runs only when a NEW animation starts,
 *    meaning the inline styles are temporary bridges between animations)
 *
 * Only affects animations created by Jump.
 */
export function cancelAndCommit(element: Element): void {
  const anims = element.getAnimations().filter(isJumpAnimation);
  if (anims.length === 0) {
    // Even if no animations running, clean up any lingering inline styles
    // from previous committed animations
    cleanupCommittedStyles(element);
    return;
  }

  for (const anim of anims) {
    try { anim.commitStyles(); } catch { /* not rendered */ }
  }
  for (const anim of anims) {
    anim.cancel();
  }
  // Clean up: the committed inline styles are temporary — they keep the
  // element at its current position until the new animation takes over.
  // The new animation's fill:"forwards" will hold the visual state.
  // We clean the inline styles so they don't override CSS rules.
  cleanupCommittedStyles(element);
}

// ============================================================================
// Transform matrix parsing
// ============================================================================

// Scientific notation floats, e.g. "1.23e-4" and "-5.67e+8"
const FLOAT_RE = /[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g;

function getCurrentTransform(element: Element): {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotate: number;
} {
  const style = window.getComputedStyle(element);
  const matrix = style.transform;

  if (!matrix || matrix === "none") {
    return { x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0 };
  }

  const values = Array.from(matrix.matchAll(FLOAT_RE), (m) => Number(m[0]));

  if (matrix.startsWith("matrix(") && values.length === 6) {
    const [a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0] = values;
    return {
      x: tx,
      y: ty,
      scaleX: Math.sqrt(a * a + b * b),
      scaleY: Math.sqrt(c * c + d * d),
      rotate: Math.atan2(b, a) * (180 / Math.PI),
    };
  }

  if (matrix.startsWith("matrix3d(") && values.length === 16) {
    const a = values[0] ?? 1;
    const b = values[1] ?? 0;
    const c = values[4] ?? 0;
    const d = values[5] ?? 1;
    return {
      x: values[12] ?? 0,
      y: values[13] ?? 0,
      scaleX: Math.sqrt(a * a + b * b),
      scaleY: Math.sqrt(c * c + d * d),
      rotate: Math.atan2(b, a) * (180 / Math.PI),
    };
  }

  return { x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0 };
}

function getCurrentOpacity(element: Element): number {
  return parseFloat(window.getComputedStyle(element).opacity ?? "1");
}

// ============================================================================
// Keyframe building helpers
// ============================================================================

function px(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value;
}

function deg(value: number | string): string {
  return typeof value === "number" ? `${value}deg` : value;
}

function buildTransform(props: {
  x?: number | string;
  y?: number | string;
  z?: number | string;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: number | string;
  rotateX?: number | string;
  rotateY?: number | string;
  rotateZ?: number | string;
  skewX?: number | string;
  skewY?: number | string;
}): string | undefined {
  const parts: string[] = [];
  if (props.x !== undefined) parts.push(`translateX(${px(props.x)})`);
  if (props.y !== undefined) parts.push(`translateY(${px(props.y)})`);
  if (props.z !== undefined) parts.push(`translateZ(${px(props.z)})`);
  if (props.scale !== undefined) parts.push(`scale(${props.scale})`);
  if (props.scaleX !== undefined) parts.push(`scaleX(${props.scaleX})`);
  if (props.scaleY !== undefined) parts.push(`scaleY(${props.scaleY})`);
  if (props.rotate !== undefined) parts.push(`rotate(${deg(props.rotate)})`);
  if (props.rotateX !== undefined) parts.push(`perspective(800px) rotateX(${deg(props.rotateX)})`);
  if (props.rotateY !== undefined) parts.push(`perspective(800px) rotateY(${deg(props.rotateY)})`);
  if (props.rotateZ !== undefined) parts.push(`rotateZ(${deg(props.rotateZ)})`);
  if (props.skewX !== undefined) parts.push(`skewX(${deg(props.skewX)})`);
  if (props.skewY !== undefined) parts.push(`skewY(${deg(props.skewY)})`);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

// ============================================================================
// Keyframe conversion
// ============================================================================

export function jumpKeyframesToWaapi(keyframes: JumpKeyframe[]): Keyframe[] {
  return keyframes.map((kf) => {
    const result: Keyframe = {};
    const transform = buildTransform(kf);
    if (transform) result.transform = transform;
    if (kf.opacity !== undefined) result.opacity = kf.opacity;
    if (kf.width !== undefined) result.width = px(kf.width);
    if (kf.height !== undefined) result.height = px(kf.height);
    if (kf.borderRadius !== undefined) result.borderRadius = px(kf.borderRadius);
    if (kf.backgroundColor !== undefined) result.backgroundColor = kf.backgroundColor;
    if (kf.color !== undefined) result.color = kf.color;
    if (kf.filter !== undefined) result.filter = kf.filter;
    if (kf.clipPath !== undefined) result.clipPath = kf.clipPath;
    if (kf.offset !== undefined) result.offset = kf.offset;
    if (kf.easing !== undefined) result.easing = resolveEasing(kf.easing);
    if (kf.composite !== undefined) result.composite = kf.composite;
    return result;
  });
}

/**
 * Builds a [from, to] keyframe pair where "from" is read from the element's
 * current computed state. Handles all animatable properties, not just transforms.
 *
 * Used by jump.to() for correct mid-animation re-targeting.
 */
export function propertiesToKeyframes(
  element: Element,
  props: AnimatableProperties,
): Keyframe[] {
  const current = getCurrentTransform(element);
  const cs = window.getComputedStyle(element);

  const from: Keyframe = {};
  const to: Keyframe = {};

  // Transform: read current matrix, write target
  const hasTransform =
    props.x !== undefined ||
    props.y !== undefined ||
    props.z !== undefined ||
    props.scale !== undefined ||
    props.scaleX !== undefined ||
    props.scaleY !== undefined ||
    props.rotate !== undefined ||
    props.rotateX !== undefined ||
    props.rotateY !== undefined ||
    props.rotateZ !== undefined ||
    props.skewX !== undefined ||
    props.skewY !== undefined;

  if (hasTransform) {
    // Build "from" transform from current computed matrix
    const fromTransform = buildTransform({
      x: current.x,
      y: current.y,
      scaleX: current.scaleX !== 1 ? current.scaleX : undefined,
      scaleY: current.scaleY !== 1 ? current.scaleY : undefined,
      rotate: current.rotate !== 0 ? current.rotate : undefined,
    });
    if (fromTransform) from.transform = fromTransform;

    const toTransform = buildTransform(props);
    if (toTransform) to.transform = toTransform;
  }

  // Opacity
  if (props.opacity !== undefined) {
    from.opacity = getCurrentOpacity(element);
    to.opacity = props.opacity;
  }

  // CSS box properties — read current computed value for from
  if (props.width !== undefined) {
    from.width = cs.width;
    to.width = px(props.width);
  }
  if (props.height !== undefined) {
    from.height = cs.height;
    to.height = px(props.height);
  }
  if (props.borderRadius !== undefined) {
    from.borderRadius = cs.borderRadius;
    to.borderRadius = px(props.borderRadius);
  }
  if (props.backgroundColor !== undefined) {
    from.backgroundColor = cs.backgroundColor;
    to.backgroundColor = props.backgroundColor;
  }
  if (props.color !== undefined) {
    from.color = cs.color;
    to.color = props.color;
  }
  if (props.filter !== undefined) {
    from.filter = cs.filter;
    to.filter = props.filter;
  }
  if (props.clipPath !== undefined) {
    from.clipPath = cs.clipPath;
    to.clipPath = props.clipPath;
  }

  return [from, to];
}

/**
 * Builds a [from, to] keyframe pair where "from" is the provided properties
 * and "to" is the element's current computed state.
 *
 * Used by jump.from() — animate IN from a starting position.
 */
/**
 * Builds a [from, to] keyframe pair where "from" is the provided properties
 * and "to" is the element's current computed state.
 *
 * Used by jump.from() — animate IN from a starting position TO current state.
 */
export function propertiesToKeyframesFrom(
  element: Element,
  props: AnimatableProperties,
): Keyframe[] {
  const providedFrom = jumpKeyframesToWaapi([props as JumpKeyframe])[0] ?? {};

  // Build the "to" keyframe from the element's current computed state.
  // We read transform, opacity, and any CSS property that the "from" specifies,
  // so the "to" has matching properties for WAAPI to interpolate.
  const cs = window.getComputedStyle(element);
  const to: Keyframe = {};

  // If "from" has a transform, "to" needs the current computed transform (or none)
  if (providedFrom.transform) {
    to.transform = cs.transform === "none" ? "none" : cs.transform;
  }
  if (props.opacity !== undefined) to.opacity = parseFloat(cs.opacity ?? "1");
  if (props.width !== undefined) to.width = cs.width;
  if (props.height !== undefined) to.height = cs.height;
  if (props.borderRadius !== undefined) to.borderRadius = cs.borderRadius;
  if (props.backgroundColor !== undefined) to.backgroundColor = cs.backgroundColor;
  if (props.color !== undefined) to.color = cs.color;
  if (props.filter !== undefined) to.filter = cs.filter === "none" ? "none" : cs.filter;
  if (props.clipPath !== undefined) to.clipPath = cs.clipPath === "none" ? "none" : cs.clipPath;

  return [providedFrom, to];
}

// ============================================================================
// Animation Execution
// ============================================================================

/**
 * Track which properties Jump has committed to inline styles per element,
 * so cancelAndCommit can clean them up when the next animation starts.
 * This prevents CSS specificity pollution from accumulating inline styles.
 */
const committedProps = new WeakMap<Element, Set<string>>();

function trackCommittedProps(element: Element, keyframes: Keyframe[]): void {
  let props = committedProps.get(element);
  if (!props) { props = new Set(); committedProps.set(element, props); }
  for (const kf of keyframes) {
    for (const key of Object.keys(kf)) {
      if (key !== "offset" && key !== "easing" && key !== "composite") {
        props.add(key);
      }
    }
  }
}

/**
 * Removes inline styles that were set by Jump's commitStyles().
 * Called by cancelAndCommit before starting a new animation,
 * so leftover inline styles from previous animations don't pollute
 * CSS specificity.
 */
export function cleanupCommittedStyles(element: Element): void {
  const props = committedProps.get(element);
  if (!props) return;
  const style = (element as HTMLElement).style;
  for (const prop of props) {
    style.removeProperty(camelToDash(prop));
  }
  committedProps.delete(element);
}

function camelToDash(str: string): string {
  return str.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}

export function animateElement(
  element: Element,
  keyframes: Keyframe[],
  options: JumpOptions,
  resolvedEasing: string,
): Animation {
  const isInfinite = (options.iterations ?? 1) === Infinity;
  const userFill = options.fill;
  // Use fill:"forwards" to hold visual state, not "none"+commitStyles.
  // Infinite loops use "none" since fill:"forwards" with Infinity locks permanently.
  const effectiveFill = userFill ?? (isInfinite ? "none" : "forwards");

  const wapiOptions: KeyframeAnimationOptions = {
    duration: options.duration ?? 300,
    delay: options.delay ?? 0,
    easing: options.easing ? resolveEasing(options.easing) : resolvedEasing,
    fill: effectiveFill,
    direction: options.direction ?? "normal",
    iterations: options.iterations ?? 1,
    composite: options.composite ?? "replace",
  };

  // Scroll-linked animations
  if (options.timeline) {
    wapiOptions.fill = userFill ?? "both";
    const anim = element.animate(keyframes, {
      ...wapiOptions,
      timeline: options.timeline,
    } as KeyframeAnimationOptions);
    return tagAnimation(anim);
  }

  const anim = element.animate(keyframes, wapiOptions);
  tagAnimation(anim);

  // Track which properties this animation touches, so we can clean up
  // when a new animation replaces it via cancelAndCommit.
  trackCommittedProps(element, keyframes);

  return anim;
}

// ============================================================================
// Controls factory
// ============================================================================

export function createControls(
  animations: Animation[],
  options?: JumpOptions,
): JumpControls {
  if (options?.onStart && animations.length > 0) {
    animations[0]!.ready.then(() => options.onStart?.()).catch(() => {});
  }

  // onUpdate: poll the first animation's progress via rAF
  let updateRafId = 0;
  if (options?.onUpdate && animations.length > 0) {
    const anim = animations[0]!;
    const onUpdate = options.onUpdate;
    function pollProgress() {
      if (anim.playState === "finished" || anim.playState === "idle") {
        onUpdate(1);
        return;
      }
      const timing = anim.effect?.getComputedTiming();
      const progress = typeof timing?.progress === "number" ? timing.progress : 0;
      onUpdate(Math.max(0, Math.min(1, progress)));
      updateRafId = requestAnimationFrame(pollProgress);
    }
    updateRafId = requestAnimationFrame(pollProgress);
  }

  const finished = Promise.all(animations.map((a) => a.finished))
    .then(() => {
      cancelAnimationFrame(updateRafId);
      options?.onComplete?.();
    })
    .catch(() => { cancelAnimationFrame(updateRafId); }) as Promise<void>;

  const controls: JumpControls = {
    play() {
      animations.forEach((a) => a.play());
      return controls;
    },
    pause() {
      animations.forEach((a) => a.pause());
      return controls;
    },
    reverse() {
      animations.forEach((a) => a.reverse());
      return controls;
    },
    cancel() {
      cancelAnimationFrame(updateRafId);
      animations.forEach((a) => a.cancel());
      return controls;
    },
    finish() {
      animations.forEach((a) => a.finish());
      return controls;
    },
    seek(progress: number) {
      // Use the longest animation's endTime as the total timeline duration.
      // This preserves stagger timing: at seek(0.5), early items are near done
      // while late items are just starting.
      const maxEnd = animations.reduce((max, a) => {
        const t = a.effect?.getComputedTiming();
        const end = (t?.endTime as number | null) ?? (t?.duration as number) ?? 300;
        return Math.max(max, end);
      }, 0) || 300;
      animations.forEach((a) => { a.currentTime = progress * maxEnd; });
      return controls;
    },
    speed(rate: number) {
      animations.forEach((a) => { a.playbackRate = rate; });
      return controls;
    },
    finished,
    animations,
  };

  return controls;
}
