export { S as SpringParams, a as SpringPreset, b as SpringResult, c as cancelAndCommit, d as createSpring, j as jump, p as prefersReducedMotion, s as springs, e as supportsLinear } from './index-0TvokhPe.js';
import { L as LayoutOptions, a as LayoutSnapshot, J as JumpOptions } from './index-CvnaHNs-.js';
export { A as AnimatableProperties, b as AnimationDefinition, c as AnimationDirection, d as AnimationIntent, C as CSSAnimationProperties, E as Easing, e as EasingPreset, f as EmphasisIntent, g as EnterIntent, h as ExitIntent, F as FadeIntent, i as FillMode, j as FlipIntent, k as JumpControls, l as JumpFunction, m as JumpKeyframe, n as JumpTarget, o as LayoutStyle, S as ScaleIntent, p as SequenceOptions, q as SequenceStep, r as SlideIntent, T as TransformProperties } from './index-CvnaHNs-.js';

/**
 * Captures the current visual state of an element.
 * Call this BEFORE a DOM mutation, then call flip() AFTER.
 */
declare function snapshot(element: Element): LayoutSnapshot;
/**
 * Animates an element from a previously captured snapshot to its current
 * DOM position. This is the raw FLIP primitive.
 *
 * The element must already be in its NEW DOM position when this is called.
 */
declare function flip(element: Element, from: LayoutSnapshot, options?: LayoutOptions): Animation | null;
/**
 * Records the current position of an element under a shared identity.
 * The next element registered with the same id will animate from here.
 */
declare function recordShared(element: Element, id: string, options?: LayoutOptions): void;
/**
 * Animates a newly-mounted element from the last recorded position of
 * a shared id to its current DOM position.
 *
 * If the source element is still in the DOM and visible, runs a crossfade:
 * the source fades out while the destination fades in and FLIP-translates.
 *
 * Returns null if there is no prior record for this id.
 */
declare function animateShared(element: Element, id: string, options?: LayoutOptions): Animation | null;
/**
 * Returns the last snapshot for a shared id (or null).
 */
declare function getSharedSnapshot(id: string): LayoutSnapshot | null;
/**
 * Clears a shared id from the registry.
 */
declare function clearShared(id: string): void;
/**
 * Watches an element for layout changes and auto-runs FLIP.
 * Returns an unwatch function.
 */
declare function watchLayout(element: Element, options?: LayoutOptions): () => void;
/**
 * Applies per-frame inverse scale correction to a child element whose parent
 * is being FLIP-animated. Prevents the child from visually distorting when
 * the parent is scaled.
 *
 * Returns a cancel function. Called automatically by the React <Layout>
 * component for children that are also <Layout>-wrapped.
 */
declare function correctChildScale(child: Element, parentAnimation: Animation): () => void;

type StaggerOptions = {
    /**
     * Where in the list to start the cascade.
     * "start" (default): first item is index 0 (no delay)
     * "end":   last item first
     * "center": items ripple outward from the middle
     * number:  specific index to start from (0-based)
     */
    from?: "start" | "end" | "center" | number;
    /**
     * Easing for the stagger timing distribution.
     * Applies across the full stagger span, so early items get small delays
     * and later items get progressively larger ones (or vice-versa).
     *
     * "linear" (default), "ease-in", "ease-out", "ease-in-out"
     */
    ease?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
    /**
     * Grid dimensions [columns, rows] for 2D stagger.
     * When set, items are treated as a grid and the origin is the grid cell
     * closest to `from` (which accepts "center", "start", "end", or [col, row]).
     */
    grid?: [number, number];
    /**
     * For grid stagger, the starting cell.
     * "center" (default), "start" (top-left), "end" (bottom-right),
     * or [column, row] zero-based coordinates.
     */
    gridFrom?: "center" | "start" | "end" | [number, number];
};
/** A stagger function — pass as JumpOptions.stagger */
type StaggerFn = (index: number, total: number) => number;
/**
 * Creates an advanced stagger timing function.
 *
 * ```ts
 * // Ripple from center
 * jump(".dot", "pop", { stagger: stagger(40, { from: "center" }) })
 *
 * // Ease-in cascade — slow start, faster finish
 * jump(".item", "enter from bottom", { stagger: stagger(60, { ease: "ease-in" }) })
 *
 * // Grid ripple from center
 * jump(".cell", "fade in", { stagger: stagger(30, { grid: [8, 6], gridFrom: "center" }) })
 *
 * // Plain number still works — stagger() is opt-in
 * jump(".item", "enter from bottom", { stagger: 50 })
 * ```
 */
declare function stagger(baseDelay: number, options?: StaggerOptions): StaggerFn;

/**
 * Prepares an SVG element for stroke animation by measuring its total
 * length and setting `stroke-dasharray` and `stroke-dashoffset`.
 *
 * Returns the total length in pixels.
 */
declare function prepareSVG(element: SVGElement): number;
/**
 * Animates an SVG element's stroke from one percentage to another.
 *
 * @param element The SVG element to draw
 * @param from Start percentage (0 = fully hidden, 1 = fully drawn)
 * @param to End percentage (0 = fully hidden, 1 = fully drawn)
 * @param options Animation options
 */
declare function drawSVG(element: SVGElement, from: number, to: number, options?: JumpOptions): Animation;
/**
 * Draws an SVG element's stroke from 0% to 100% ("draw in").
 */
declare function drawIn(element: SVGElement, options?: JumpOptions): Animation;
/**
 * Erases an SVG element's stroke from 100% to 0% ("draw out" / "erase").
 */
declare function drawOut(element: SVGElement, options?: JumpOptions): Animation;

type AnimateValueOptions = JumpOptions & {
    /** Called every frame with the current interpolated values */
    onUpdate?: (current: Record<string, number>) => void;
};
type ValueControls = {
    cancel: () => void;
    finished: Promise<void>;
    pause: () => void;
    play: () => void;
};
/**
 * Animates properties of a plain JS object from their current values to
 * a target using requestAnimationFrame. The source object is mutated in place.
 *
 * ```ts
 * const counter = { value: 0 }
 * jump.animate(counter, { value: 1000 }, {
 *   duration: 800,
 *   easing: "ease-out-cubic",
 *   onUpdate: (c) => el.textContent = Math.round(c.value).toLocaleString(),
 * })
 * ```
 */
declare function animateValues(source: Record<string, number>, target: Record<string, number>, options?: AnimateValueOptions): ValueControls;

type ScrollProgressOptions = {
    /** Scroll axis. Default: "y" */
    axis?: "x" | "y";
    /** The scrollable container. Default: window */
    container?: Element | Window;
    /**
     * When to start tracking (0 = element's top at viewport bottom).
     * When to finish (1 = element's bottom at viewport top).
     * These are the defaults and match the element's full transit through the viewport.
     */
    offset?: [number, number];
};
type ScrollProgressValue = {
    /** Get the current progress (0–1) */
    get: () => number;
    /** Subscribe to progress changes. Returns an unsubscribe function. */
    onChange: (callback: (value: number) => void) => () => void;
    /** Stop tracking and clean up all listeners */
    stop: () => void;
};
/**
 * Creates a reactive scroll progress value for an element or the page.
 *
 * ```ts
 * // Element progress (0 when entering viewport, 1 when leaving)
 * const progress = jump.scrollProgress(section)
 * progress.onChange(v => {
 *   hero.style.opacity = String(1 - v)
 *   hero.style.transform = `translateY(${v * -40}px)`
 * })
 *
 * // Page progress (0 at top, 1 at bottom)
 * const page = jump.scrollProgress()
 * page.onChange(v => progressBar.style.width = v * 100 + '%')
 * ```
 */
declare function createScrollProgress(element?: Element, options?: ScrollProgressOptions): ScrollProgressValue;

export { JumpOptions, LayoutOptions, LayoutSnapshot, type StaggerFn, type StaggerOptions, animateShared, animateValues, clearShared, correctChildScale, createScrollProgress, drawIn, drawOut, drawSVG, flip, getSharedSnapshot, prepareSVG, recordShared, snapshot, stagger, watchLayout };
