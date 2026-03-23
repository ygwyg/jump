// ============================================================================
// Jump Animation Library - Type System
// ============================================================================

// --- Easing ---

/** Named easing presets. AI can pick any of these by name. */
export type EasingPreset =
  | "linear"
  | "ease"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "ease-in-quad"
  | "ease-out-quad"
  | "ease-in-out-quad"
  | "ease-in-cubic"
  | "ease-out-cubic"
  | "ease-in-out-cubic"
  | "ease-in-quart"
  | "ease-out-quart"
  | "ease-in-out-quart"
  | "ease-in-expo"
  | "ease-out-expo"
  | "ease-in-out-expo"
  | "ease-in-circ"
  | "ease-out-circ"
  | "ease-in-out-circ"
  | "ease-in-back"
  | "ease-out-back"
  | "ease-in-out-back"
  // Note: these are cubic-bezier *approximations* of spring physics.
  // For real physics, use createSpring() / springs.*() from "jump".
  | "spring"
  | "spring-gentle"
  | "spring-bouncy"
  | "spring-stiff";

/**
 * Easing can be a preset name, a cubic-bezier(), or a linear() string.
 * For raw CSS strings, use the template literal types.
 */
export type Easing =
  | EasingPreset
  | `cubic-bezier(${string})`
  | `linear(${string})`;

// --- Intent Animations ---

/** Fade animations */
export type FadeIntent = "fade in" | "fade out";

/** Slide animations with direction */
export type SlideIntent =
  | "slide up"
  | "slide down"
  | "slide left"
  | "slide right";

/** Enter animations - element appearing on screen */
export type EnterIntent =
  | "enter"
  | "enter from top"
  | "enter from bottom"
  | "enter from left"
  | "enter from right";

/** Exit animations - element leaving screen */
export type ExitIntent =
  | "exit"
  | "exit top"
  | "exit bottom"
  | "exit left"
  | "exit right";

/** Scale animations */
export type ScaleIntent = "scale up" | "scale down" | "grow" | "shrink";

/** Flip/rotate animations */
export type FlipIntent = "flip x" | "flip y" | "rotate";

/** Emphasis/attention animations */
export type EmphasisIntent =
  | "emphasize"
  | "pulse"
  | "shake"
  | "bounce"
  | "wiggle"
  | "pop";

/** All animation intents that Jump understands */
export type AnimationIntent =
  | FadeIntent
  | SlideIntent
  | EnterIntent
  | ExitIntent
  | ScaleIntent
  | FlipIntent
  | EmphasisIntent;

// --- Stagger ---

/** A function that returns the delay for each element in a staggered animation */
export type StaggerFn = (index: number, total: number) => number;

// --- Property-Level Animation ---

/** CSS transform shorthand properties that Jump can animate */
export type TransformProperties = {
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
};

/** Standard CSS properties that Jump can animate */
export type CSSAnimationProperties = {
  opacity?: number;
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  backgroundColor?: string;
  color?: string;
  filter?: string;
  clipPath?: string;
};

/** All animatable properties (transforms + CSS) */
export type AnimatableProperties = TransformProperties & CSSAnimationProperties;

// --- Keyframes ---

/** A keyframe is a set of properties at a point in the animation. */
export type JumpKeyframe = AnimatableProperties & {
  /** Position in the animation (0–1). */
  offset?: number;
  easing?: Easing;
  /** How this keyframe composites with others. Default: "replace" */
  composite?: CompositeOperation;
};

// --- Animation Definition ---

/**
 * The animation parameter for jump().
 *
 * Can be:
 * - An intent string: "fade in", "slide up", etc.
 * - A compound intent: "fade in slide up"
 * - A property object: { opacity: 0, x: 100 }
 * - An array of keyframes: [{ opacity: 0 }, { opacity: 1 }]
 */
/**
 * Compound intent: two intent strings space-separated.
 * e.g. "fade in slide up", "fade out exit bottom"
 */
export type CompoundIntent = `${AnimationIntent} ${AnimationIntent}`;

export type AnimationDefinition =
  | AnimationIntent
  | CompoundIntent
  | AnimatableProperties
  | JumpKeyframe[];

// --- Options ---

/** Fill mode for the animation. "auto" is not valid WAAPI — not included. */
export type FillMode = "none" | "forwards" | "backwards" | "both";

/** Direction for the animation */
export type AnimationDirection =
  | "normal"
  | "reverse"
  | "alternate"
  | "alternate-reverse";

/** Options for a single jump() call */
export type JumpOptions = {
  /** Duration in milliseconds. Default: 300 */
  duration?: number;
  /** Delay before animation starts, in milliseconds. Default: 0 */
  delay?: number;
  /** Easing function. Default: auto-selected by intent type */
  easing?: Easing;
  /**
   * How to fill before/after animation. Default: "both".
   * NOTE: avoid "both" with iterations:Infinity — use "none" instead,
   * which jump() applies automatically for infinite loops.
   */
  fill?: FillMode;
  /** Direction of the animation. Default: "normal" */
  direction?: AnimationDirection;
  /**
   * Number of iterations. Default: 1.
   * Use Infinity for looping — jump() will automatically set fill:"none".
   */
  iterations?: number;
  /**
   * Delay between each element when target is an array/selector.
   * - number: flat delay in ms (e.g. 50)
   * - StaggerFn: from stagger() utility for advanced patterns (from:"center", eased, grid)
   */
  stagger?: number | StaggerFn;
  /** Distance for slide/enter/exit animations in px. Default: 20 */
  distance?: number;
  /** Scale factor for scale animations. Default: varies by intent */
  scaleFactor?: number;
  /**
   * How this animation composites with other running animations on the element.
   * "replace" (default) replaces any running animation.
   * "add" adds on top of the current value.
   * "accumulate" combines with the current value.
   */
  composite?: CompositeOperation;
  /**
   * If true and window.matchMedia('(prefers-reduced-motion: reduce)') is set,
   * the animation instantly jumps to its final state instead of playing.
   * Default: true
   */
  respectMotionPreference?: boolean;
  /**
   * A ScrollTimeline or ViewTimeline to drive this animation with scroll
   * instead of time. Requires browser support (Chrome 115+).
   */
  timeline?: AnimationTimeline;
  /** Callback when the first element's animation starts */
  onStart?: () => void;
  /**
   * Called every frame during the animation with the current progress (0–1).
   * Uses requestAnimationFrame polling. Only fires for the first animation
   * in a staggered group.
   *
   * ```ts
   * jump(el, "fade in", {
   *   onUpdate: (progress) => console.log(Math.round(progress * 100) + '%'),
   * })
   * ```
   */
  onUpdate?: (progress: number) => void;
  /** Callback when all animations in this call complete */
  onComplete?: () => void;
};

// --- Targets ---

/** What can be animated */
export type JumpTarget =
  | Element
  | Element[]
  | NodeList
  | string
  | Ref<Element | null>;

/** Minimal ref type so we don't import React in core */
export type Ref<T> = { current: T };

// --- Controls ---

/** Returned by every jump() call for controlling the animation */
export type JumpControls = {
  /** Play the animation (or resume if paused) */
  play: () => JumpControls;
  /** Pause the animation */
  pause: () => JumpControls;
  /** Reverse the animation direction */
  reverse: () => JumpControls;
  /** Stop and reset to the beginning */
  cancel: () => JumpControls;
  /**
   * Immediately jump to the end of the animation,
   * applying the final styles. Respects fill mode.
   */
  finish: () => JumpControls;
  /** Jump to a specific point (0–1) in the total animation duration */
  seek: (progress: number) => JumpControls;
  /** Set playback rate (1 = normal, 2 = double speed, 0.5 = half) */
  speed: (rate: number) => JumpControls;
  /** Promise that resolves when all animations in this call finish */
  finished: Promise<void>;
  /** The underlying WAAPI Animation objects */
  animations: Animation[];
};

// --- Sequence ---

/** A step in a sequence or parallel call: [target, animation, options?] */
export type SequenceStep = [
  target: JumpTarget,
  animation: AnimationDefinition,
  options?: JumpOptions,
];

/** Options for jump.sequence() */
export type SequenceOptions = {
  /**
   * Time in ms by which each step overlaps with the next.
   * Positive = overlap (step n+1 starts before step n ends).
   * Negative = gap (step n+1 starts after step n ends by this amount).
   * Default: 0
   */
  overlap?: number;
  /** Callback when the entire sequence completes */
  onComplete?: () => void;
};

// --- Layout ---

/**
 * Animation style for layout transitions.
 * Pass to jump.layout(), jump.shared(), <Layout>, and <Layout sharedId>.
 */
export type LayoutStyle =
  | "spring"   // default — gentle spring with slight overshoot
  | "smooth"   // ease-in-out-cubic, no overshoot
  | "snappy"   // stiff spring, fast settle
  | "bouncy"   // high overshoot spring
  | "slow";    // slow ease, dramatic

/** Options accepted by layout animation APIs */
export type LayoutOptions = JumpOptions & {
  style?: LayoutStyle;
};

/** Captured visual state of an element, used as the FLIP "First" frame */
export type LayoutSnapshot = {
  rect: DOMRect;
  opacity: number;
  borderRadius: string;
  transform: string;
};

// --- Main Function Signature ---

/** The jump function signature */
export type JumpFunction = {
  (
    target: JumpTarget,
    animation: AnimationDefinition,
    options?: JumpOptions,
  ): JumpControls;

  /**
   * Animate FROM the element's current computed position TO target properties.
   * Correctly interrupts a running animation without snapping.
   * This is the right API for mouse-follow, drag, and continuous re-targeting.
   *
   * ```ts
   * el.addEventListener("mousemove", (e) => {
   *   jump.to(ball, { x: e.clientX, y: e.clientY }, springs.bouncy())
   * })
   * ```
   */
  to: (
    target: JumpTarget,
    properties: AnimatableProperties,
    options?: JumpOptions,
  ) => JumpControls;

  /**
   * Animate FROM a set of starting properties TO the element's current state.
   * The element stays at its current position; this animates *in* from elsewhere.
   *
   * ```ts
   * jump.from(el, { opacity: 0, y: 40 }, { duration: 400 })
   * // same as: jump(el, "enter from bottom") but with explicit start values
   * ```
   */
  from: (
    target: JumpTarget,
    properties: AnimatableProperties,
    options?: JumpOptions,
  ) => JumpControls;

  /**
   * Watch an element and automatically animate it with FLIP whenever
   * its size or position changes due to layout updates.
   *
   * Returns a stop function.
   *
   * ```ts
   * const stop = jump.layout(card)
   * // card will now smoothly animate to any new position/size
   * stop() // unwatch
   * ```
   */
  layout: (
    target: JumpTarget,
    options?: LayoutOptions,
  ) => () => void;

  /**
   * Animate an element from the last recorded position of a shared identity
   * to its current DOM position. Used to create "magic move" transitions
   * where the same logical element moves between DOM locations.
   *
   * Call jump.snapshot(el, id) before the element leaves, then
   * jump.shared(newEl, id) after the new element is mounted.
   *
   * ```ts
   * // Before: record the thumbnail's position
   * jump.snapshot(thumbnail, "product-hero")
   *
   * // After: animate the modal image from where the thumbnail was
   * jump.shared(heroImage, "product-hero")
   * ```
   */
  shared: (
    target: Element,
    id: string,
    options?: LayoutOptions,
  ) => Animation | null;

  /**
   * Captures the current visual position of an element under a shared id,
   * so a future call to jump.shared() can animate from it.
   *
   * ```ts
   * jump.snapshot(el, "hero")
   * // ... unmount el, mount new element ...
   * jump.shared(newEl, "hero")
   * ```
   */
  snapshot: (target: Element, id: string, options?: LayoutOptions) => void;

  /**
   * Low-level: capture the current visual state of an element.
   * Use when you want to manually control the FLIP lifecycle.
   *
   * ```ts
   * const snap = jump.capture(el)
   * doTheDOMChange()
   * jump.flip(el, snap)
   * ```
   */
  capture: (target: Element) => LayoutSnapshot;

  /**
   * Low-level: animate an element from a captured snapshot to its
   * current DOM position. This is the raw FLIP primitive.
   *
   * ```ts
   * const snap = jump.capture(el)
   * doTheDOMChange()
   * jump.flip(el, snap, { style: "spring" })
   * ```
   */
  flip: (
    target: Element,
    from: LayoutSnapshot,
    options?: LayoutOptions,
  ) => Animation | null;

  /**
   * Wire a hover animation to an element. Touch-safe — ignores
   * `pointerType === "touch"` so hover never gets stuck on mobile.
   *
   * ```ts
   * jump.hover(card, {
   *   onEnter: (el) => {
   *     const ctrl = jump.to(el, { scale: 1.04 }, springs.gentle())
   *     return () => jump.to(el, { scale: 1 }, springs.gentle())
   *   }
   * })
   * ```
   */
  hover: (
    target: JumpTarget,
    options: {
      onEnter: (el: Element) => (() => void) | void;
      onLeave?: (el: Element) => void;
    },
  ) => { stop: () => void };

  /**
   * Wire a press animation to an element. Includes keyboard support
   * (Enter and Space) and correctly handles cancelled presses.
   *
   * ```ts
   * jump.press(button, {
   *   onPress:   (el) => jump.to(el, { scale: 0.95 }, springs.stiff()),
   *   onRelease: (el) => jump.to(el, { scale: 1   }, springs.stiff()),
   * })
   * ```
   */
  press: (
    target: JumpTarget,
    options: {
      onPress:    (el: Element) => (() => void) | void;
      onRelease?: (el: Element) => void;
    },
  ) => { stop: () => void };

  /**
   * Scroll-driven animation. Uses ViewTimeline (native WAAPI) when available,
   * falls back to IntersectionObserver.
   *
   * ```ts
   * // One-shot: animate when element enters viewport
   * jump.scroll(el, "fade in slide up")
   *
   * // Scrub: tied to scroll position
   * jump.scroll(el, { y: [-40, 0] }, { sync: true })
   *
   * // Custom trigger window
   * jump.scroll(el, "fade in", {
   *   enter: "top 80%",
   *   exit:  "top 20%",
   * })
   * ```
   */
  scroll: (
    target: JumpTarget,
    animation: AnimationDefinition,
    options?: JumpOptions & {
      container?: Element | Window;
      enter?: string;
      exit?: string;
      sync?: boolean;
      axis?: "x" | "y";
    },
  ) => { stop: () => void };

  /**
   * Make an element draggable with momentum, bounds, and spring physics.
   *
   * ```ts
   * // Basic drag
   * jump.drag(el)
   *
   * // Constrained with bounds and snap
   * jump.drag(el, {
   *   axis: "x",
   *   bounds: { left: -200, right: 200 },
   *   snap: { x: [0, 100, 200] },
   * })
   *
   * // With callbacks
   * jump.drag(el, {
   *   onDragEnd: (state) => {
   *     if (state.x > 200) dismissCard()
   *   }
   * })
   * ```
   */
  drag: (
    target: JumpTarget,
    options?: {
      axis?: "x" | "y" | "both";
      bounds?: { top?: number; right?: number; bottom?: number; left?: number };
      momentum?: boolean;
      deceleration?: number;
      snap?: { x?: number[]; y?: number[] };
      spring?: { stiffness?: number; damping?: number };
      cursor?: string;
      onDrag?: (state: { x: number; y: number; velocityX: number; velocityY: number; isDragging: boolean }) => void;
      onDragStart?: (state: { x: number; y: number; velocityX: number; velocityY: number; isDragging: boolean }) => void;
      onDragEnd?: (state: { x: number; y: number; velocityX: number; velocityY: number; isDragging: boolean }) => void;
      onSettle?: (state: { x: number; y: number; velocityX: number; velocityY: number; isDragging: boolean }) => void;
    },
  ) => {
    stop: () => void;
    state: () => { x: number; y: number; velocityX: number; velocityY: number; isDragging: boolean };
    moveTo: (x: number, y: number) => void;
    reset: () => void;
  };

  /**
   * Text splitting + animation. Splits text into words, characters, or lines,
   * then animates each piece with stagger.
   *
   * ```ts
   * jump.text(heading, "reveal by word")
   * jump.text(heading, "reveal by char", { stagger: 20 })
   * jump.text(el, "typewriter", { typeSpeed: 30 })
   * jump.text(el, "scramble", { duration: 600 })
   * ```
   */
  text: (
    target: JumpTarget,
    mode: "reveal by word" | "reveal by char" | "reveal by line" | "typewriter" | "scramble",
    options?: JumpOptions & {
      scrambleChars?: string;
      typeSpeed?: number;
      enter?: string;
    },
  ) => { cancel: () => void; finished: Promise<void> };

  /**
   * SVG drawing utilities.
   *
   * ```ts
   * jump.svg.drawIn(path)                      // stroke appears drawn
   * jump.svg.drawOut(path)                      // stroke erases
   * jump.svg.draw(path, 0.2, 0.8)              // partial draw
   * jump.svg.prepare(path)                      // set up dasharray manually
   * ```
   */
  svg: {
    prepare: (element: SVGElement) => number;
    draw: (element: SVGElement, from: number, to: number, options?: JumpOptions) => Animation;
    drawIn: (element: SVGElement, options?: JumpOptions) => Animation;
    drawOut: (element: SVGElement, options?: JumpOptions) => Animation;
  };

  /**
   * Animate plain JS objects. Useful for number counters, canvas, WebGL.
   *
   * ```ts
   * jump.animate({ count: 0 }, { count: 1000 }, {
   *   duration: 800,
   *   onUpdate: (v) => el.textContent = Math.round(v.count).toLocaleString(),
   * })
   * ```
   */
  animate: (
    source: Record<string, number>,
    target: Record<string, number>,
    options?: JumpOptions & { onUpdate?: (current: Record<string, number>) => void },
  ) => { cancel: () => void; finished: Promise<void>; pause: () => void; play: () => void };

  /**
   * Scroll progress tracking. Returns a reactive 0→1 value.
   *
   * ```ts
   * // Element progress (0 entering → 1 exiting viewport)
   * const p = jump.scrollProgress(section)
   * p.onChange(v => parallax.style.transform = `translateY(${v * -40}px)`)
   *
   * // Page progress
   * const page = jump.scrollProgress()
   * page.onChange(v => bar.style.width = v * 100 + '%')
   * ```
   */
  scrollProgress: (
    element?: Element,
    options?: { axis?: "x" | "y"; container?: Element | Window },
  ) => {
    get: () => number;
    onChange: (callback: (value: number) => void) => () => void;
    stop: () => void;
  };

  /** Animate a sequence of steps one after another */
  sequence: (
    steps: SequenceStep[],
    options?: SequenceOptions,
  ) => JumpControls;

  /** Animate all steps simultaneously */
  parallel: (
    steps: SequenceStep[],
    options?: Pick<SequenceOptions, "onComplete">,
  ) => JumpControls;
};
