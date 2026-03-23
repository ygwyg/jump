import type {
  JumpTarget,
  AnimationDefinition,
  JumpOptions,
  JumpControls,
  JumpFunction,
  SequenceStep,
  SequenceOptions,
  AnimatableProperties,
  JumpKeyframe,
  LayoutOptions,
  LayoutSnapshot,
  StaggerFn,
} from "../types/index.js";
import {
  resolveTargets,
  propertiesToKeyframes,
  propertiesToKeyframesFrom,
  jumpKeyframesToWaapi,
  animateElement,
  createControls,
  cancelAndCommit,
  prefersReducedMotion,
} from "./engine.js";
import { resolveIntent, isIntentString } from "./intent.js";
import { resolveEasing, defaultEasingForIntent } from "./easings.js";
import { runSequence, runParallel } from "./timeline.js";
import {
  watchLayout,
  snapshot as layoutSnapshot,
  recordShared,
  animateShared,
  flip,
} from "./layout.js";
import { createHover, createPress } from "./gestures.js";
import { createScroll } from "./scroll.js";
import { createDrag } from "./drag.js";
import { createTextAnimation, type TextMode, type TextOptions } from "./text.js";
import { drawIn, drawOut, drawSVG, prepareSVG } from "./svg.js";
import { animateValues, type AnimateValueOptions } from "./animate.js";
import { createScrollProgress, type ScrollProgressOptions } from "./scrollProgress.js";

// ============================================================================
// jump() — The main animation function
// ============================================================================

function jumpCore(
  target: JumpTarget,
  animation: AnimationDefinition,
  options: JumpOptions = {},
): JumpControls {
  const elements = resolveTargets(target);
  if (elements.length === 0) return createControls([]);

  // Reduced motion: skip to final state
  if ((options.respectMotionPreference ?? true) && prefersReducedMotion()) {
    return skipToEnd(elements, animation, options);
  }

  const staggerOpt = options.stagger ?? 0;
  const staggerDelay: (i: number) => number =
    typeof staggerOpt === "function"
      ? (i) => (staggerOpt as StaggerFn)(i, elements.length)
      : (i) => i * (staggerOpt as number);
  const allAnimations: Animation[] = [];

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i]!;

    // Cancel previous Jump animations on this element before starting new ones.
    // Skip if composite:"add" — additive animations intentionally stack.
    if ((options.composite ?? "replace") === "replace") {
      cancelAndCommit(element);
    }

    const elementOptions: JumpOptions = {
      ...options,
      delay: (options.delay ?? 0) + staggerDelay(i),
    };

    let keyframes: Keyframe[];
    let resolvedEasing: string;

    if (isIntentString(animation)) {
      const resolved = resolveIntent(animation, options);
      keyframes = jumpKeyframesToWaapi(resolved.keyframes);
      resolvedEasing = options.easing
        ? resolveEasing(options.easing)
        : defaultEasingForIntent(animation);
    } else if (Array.isArray(animation)) {
      keyframes = jumpKeyframesToWaapi(animation as JumpKeyframe[]);
      resolvedEasing = options.easing ? resolveEasing(options.easing) : "ease-in-out";
    } else if (typeof animation === "object") {
      // Per-element keyframes: each element reads its own current state
      keyframes = propertiesToKeyframes(element, animation as AnimatableProperties);
      resolvedEasing = options.easing ? resolveEasing(options.easing) : "ease-in-out";
    } else {
      throw new Error(
        `[jump] Invalid animation. Expected an intent string, properties object, ` +
          `or keyframes array. Got: ${typeof animation}`,
      );
    }

    allAnimations.push(animateElement(element, keyframes, elementOptions, resolvedEasing));
  }

  return createControls(allAnimations, options);
}

// ============================================================================
// jump.to() — Re-targeting with commitStyles (no snap)
// ============================================================================

function jumpTo(
  target: JumpTarget,
  properties: AnimatableProperties,
  options: JumpOptions = {},
): JumpControls {
  const elements = resolveTargets(target);
  if (elements.length === 0) return createControls([]);

  if ((options.respectMotionPreference ?? true) && prefersReducedMotion()) {
    return skipToEnd(elements, properties, options);
  }

  const staggerOpt2 = options.stagger ?? 0;
  const staggerDelay2: (i: number) => number =
    typeof staggerOpt2 === "function"
      ? (i) => (staggerOpt2 as StaggerFn)(i, elements.length)
      : (i) => i * (staggerOpt2 as number);
  const resolvedEasing = options.easing
    ? resolveEasing(options.easing)
    : "ease-out-cubic";
  const allAnimations: Animation[] = [];

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i]!;
    // Commit → cancel → re-target from current position (no snap)
    cancelAndCommit(element);
    const keyframes = propertiesToKeyframes(element, properties);
    const elementOptions: JumpOptions = {
      ...options,
      delay: (options.delay ?? 0) + staggerDelay2(i),
    };
    allAnimations.push(animateElement(element, keyframes, elementOptions, resolvedEasing));
  }

  return createControls(allAnimations, options);
}

// ============================================================================
// jump.from() — Animate IN from explicit start values
// ============================================================================

function jumpFrom(
  target: JumpTarget,
  properties: AnimatableProperties,
  options: JumpOptions = {},
): JumpControls {
  const elements = resolveTargets(target);
  if (elements.length === 0) return createControls([]);

  if ((options.respectMotionPreference ?? true) && prefersReducedMotion()) {
    return createControls([]); // skip: element stays at current position
  }

  const staggerOpt3 = options.stagger ?? 0;
  const staggerDelay3: (i: number) => number =
    typeof staggerOpt3 === "function"
      ? (i) => (staggerOpt3 as StaggerFn)(i, elements.length)
      : (i) => i * (staggerOpt3 as number);
  const resolvedEasing = options.easing
    ? resolveEasing(options.easing)
    : defaultEasingForIntent("enter");
  const allAnimations: Animation[] = [];

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i]!;
    const keyframes = propertiesToKeyframesFrom(element, properties);
    const elementOptions: JumpOptions = {
      ...options,
      delay: (options.delay ?? 0) + staggerDelay3(i),
    };
    allAnimations.push(animateElement(element, keyframes, elementOptions, resolvedEasing));
  }

  return createControls(allAnimations, options);
}

// ============================================================================
// Reduced motion: instant skip to final state
// ============================================================================

function skipToEnd(
  elements: Element[],
  animation: AnimationDefinition,
  options: JumpOptions,
): JumpControls {
  // Run with duration:0 so WAAPI fires all events but instantly
  const noMotionOptions: JumpOptions = {
    ...options,
    duration: 0,
    delay: 0,
    stagger: 0,
    easing: "linear",
    iterations: options.iterations === Infinity ? 1 : options.iterations,
  };

  // Re-enter jumpCore without the reduced-motion check (infinite loop guard)
  const allAnimations: Animation[] = [];

  for (const element of elements) {
    let keyframes: Keyframe[];
    if (isIntentString(animation)) {
      const resolved = resolveIntent(animation, noMotionOptions);
      keyframes = jumpKeyframesToWaapi(resolved.keyframes);
    } else if (Array.isArray(animation)) {
      keyframes = jumpKeyframesToWaapi(animation as JumpKeyframe[]);
    } else if (typeof animation === "object") {
      keyframes = propertiesToKeyframes(element, animation as AnimatableProperties);
    } else {
      continue;
    }
    allAnimations.push(
      animateElement(element, keyframes, noMotionOptions, "linear"),
    );
  }

  return createControls(allAnimations, options);
}

// ============================================================================
// Assemble
// ============================================================================

export const jump: JumpFunction = Object.assign(jumpCore, {
  to: jumpTo,
  from: jumpFrom,

  layout(target: JumpTarget, options?: LayoutOptions): () => void {
    const elements = resolveTargets(target);
    const stoppers = elements.map((el) => watchLayout(el, options));
    return () => stoppers.forEach((s) => s());
  },

  shared(
    target: Element,
    id: string,
    options?: LayoutOptions,
  ): Animation | null {
    return animateShared(target, id, options);
  },

  snapshot(target: Element, id: string, options?: LayoutOptions): void {
    recordShared(target, id, options);
  },

  capture(target: Element): LayoutSnapshot {
    return layoutSnapshot(target);
  },

  flip(
    target: Element,
    from: LayoutSnapshot,
    options?: LayoutOptions,
  ): Animation | null {
    return flip(target, from, options);
  },

  hover(
    target: JumpTarget,
    options: { onEnter: (el: Element) => (() => void) | void; onLeave?: (el: Element) => void },
  ) {
    return createHover(target, options);
  },

  press(
    target: JumpTarget,
    options: { onPress: (el: Element) => (() => void) | void; onRelease?: (el: Element) => void },
  ) {
    return createPress(target, options);
  },

  scroll(
    target: JumpTarget,
    animation: AnimationDefinition,
    options?: JumpOptions & { container?: Element | Window; enter?: string; exit?: string; sync?: boolean; axis?: "x" | "y" },
  ) {
    return createScroll(target, animation, options);
  },

  drag(target: JumpTarget, options?: Parameters<typeof createDrag>[1]) {
    return createDrag(target, options);
  },

  text(target: JumpTarget, mode: TextMode, options?: TextOptions) {
    const elements = resolveTargets(target);
    if (elements.length === 0) return { cancel: () => {}, finished: Promise.resolve() };
    return createTextAnimation(elements[0] as HTMLElement, mode, options);
  },

  svg: {
    prepare: prepareSVG,
    draw: drawSVG,
    drawIn,
    drawOut,
  },

  animate(
    source: Record<string, number>,
    target: Record<string, number>,
    options?: AnimateValueOptions,
  ) {
    return animateValues(source, target, options);
  },

  scrollProgress(element?: Element, options?: ScrollProgressOptions) {
    return createScrollProgress(element, options);
  },

  sequence(steps: SequenceStep[], options?: SequenceOptions): JumpControls {
    return runSequence(steps, options, jumpCore);
  },

  parallel(
    steps: SequenceStep[],
    options?: Pick<SequenceOptions, "onComplete">,
  ): JumpControls {
    return runParallel(steps, options, jumpCore);
  },
});

// Re-exports
export { resolveEasing, defaultEasingForIntent } from "./easings.js";
export { createSpring, springs } from "./spring.js";
export type { SpringParams, SpringResult, SpringPreset } from "./spring.js";
export { resolveTargets, createControls, cancelAndCommit, prefersReducedMotion } from "./engine.js";
export { resolveIntent, isIntentString } from "./intent.js";
export { runSequence, runParallel } from "./timeline.js";
