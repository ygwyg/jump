import { J as JumpOptions, k as JumpControls, n as JumpTarget, m as JumpKeyframe, q as SequenceStep, p as SequenceOptions, b as AnimationDefinition, l as JumpFunction } from './index-CvnaHNs-.js';

/**
 * Resolves an easing preset name to a CSS easing string.
 * If the input is already a CSS string (e.g. cubic-bezier(...)), it passes through.
 */
declare function resolveEasing(easing: string): string;
/**
 * Returns the default easing for a given animation intent category.
 * Enters use ease-out (decelerate into place).
 * Exits use ease-in (accelerate away).
 * Emphasis uses ease-in-out.
 */
declare function defaultEasingForIntent(intent: string): string;

type SpringParams = {
    /** Spring stiffness. Higher = snappier response. Default: 170 */
    stiffness?: number;
    /** Damping coefficient. Lower = more oscillation. Default: 26 */
    damping?: number;
    /** Mass of the simulated object. Higher = slower. Default: 1 */
    mass?: number;
    /** Initial velocity (units/s). Default: 0 */
    velocity?: number;
};
type SpringResult = {
    /** CSS linear() easing string — pass directly to JumpOptions.easing */
    easing: string;
    /** Duration in ms for this spring to settle — pass to JumpOptions.duration */
    duration: number;
};
/**
 * Returns true if the browser supports CSS linear() easing.
 * Chrome 113+, Firefox 112+, Safari 17.2+
 *
 * When false, createSpring() falls back to a cubic-bezier approximation
 * that captures the spring's feel without real overshoot.
 */
declare function supportsLinear(): boolean;
/**
 * Creates a real spring physics easing curve encoded as CSS linear().
 *
 * Returns `{ easing, duration }` — spread directly into JumpOptions:
 * ```ts
 * jump(el, "enter from bottom", { ...createSpring({ stiffness: 200, damping: 18 }) })
 * ```
 */
declare function createSpring(params?: SpringParams): SpringResult;
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
declare const springs: {
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
};
type SpringPreset = keyof typeof springs;

declare function resolveTargets(target: JumpTarget): Element[];
/**
 * Returns true if the user has requested reduced motion.
 * Safe to call in SSR contexts (returns false).
 */
declare function prefersReducedMotion(): boolean;
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
declare function cancelAndCommit(element: Element): void;
declare function createControls(animations: Animation[], options?: JumpOptions): JumpControls;

type ResolvedIntent = {
    keyframes: JumpKeyframe[];
    isEnter: boolean;
    isExit: boolean;
    isEmphasis: boolean;
};
/**
 * Checks whether a string is a known intent or compound of known intents.
 * Rejects CSS property values ("red", "none", "auto") that would previously
 * have matched the old /^[a-z ]+$/ regex.
 */
declare function isIntentString(value: unknown): value is string;
/**
 * Resolves an intent string (possibly compound) into keyframes.
 *
 * Throws for completely unrecognized strings.
 * In development, warns about partially-recognized compound intents
 * that contain unknown tokens.
 */
declare function resolveIntent(intentStr: string, options: JumpOptions): ResolvedIntent;

/**
 * Plays steps one after another. Returns controls that affect all animations
 * in the sequence, including correctly pausing/cancelling future steps.
 */
declare function runSequence(steps: SequenceStep[], options: SequenceOptions | undefined, jumpFn: (target: JumpTarget, animation: AnimationDefinition, options?: JumpOptions) => JumpControls): JumpControls;
/**
 * Plays all steps simultaneously. All animations share the same controls.
 */
declare function runParallel(steps: SequenceStep[], options: Pick<SequenceOptions, "onComplete"> | undefined, jumpFn: (target: JumpTarget, animation: AnimationDefinition, options?: JumpOptions) => JumpControls): JumpControls;

declare const jump: JumpFunction;

export { type SpringParams as S, type SpringPreset as a, type SpringResult as b, cancelAndCommit as c, createSpring as d, supportsLinear as e, createControls as f, defaultEasingForIntent as g, resolveIntent as h, isIntentString as i, jump as j, resolveTargets as k, runParallel as l, runSequence as m, prefersReducedMotion as p, resolveEasing as r, springs as s };
