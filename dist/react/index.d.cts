import { ReactNode, ReactElement, RefObject } from 'react';

/** Named easing presets. AI can pick any of these by name. */
type EasingPreset = "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out" | "ease-in-quad" | "ease-out-quad" | "ease-in-out-quad" | "ease-in-cubic" | "ease-out-cubic" | "ease-in-out-cubic" | "ease-in-quart" | "ease-out-quart" | "ease-in-out-quart" | "ease-in-expo" | "ease-out-expo" | "ease-in-out-expo" | "ease-in-circ" | "ease-out-circ" | "ease-in-out-circ" | "ease-in-back" | "ease-out-back" | "ease-in-out-back" | "spring" | "spring-gentle" | "spring-bouncy" | "spring-stiff";
/**
 * Easing can be a preset name, a cubic-bezier(), or a linear() string.
 * For raw CSS strings, use the template literal types.
 */
type Easing = EasingPreset | `cubic-bezier(${string})` | `linear(${string})`;
/** Fade animations */
type FadeIntent = "fade in" | "fade out";
/** Slide animations with direction */
type SlideIntent = "slide up" | "slide down" | "slide left" | "slide right";
/** Enter animations - element appearing on screen */
type EnterIntent = "enter" | "enter from top" | "enter from bottom" | "enter from left" | "enter from right";
/** Exit animations - element leaving screen */
type ExitIntent = "exit" | "exit top" | "exit bottom" | "exit left" | "exit right";
/** Scale animations */
type ScaleIntent = "scale up" | "scale down" | "grow" | "shrink";
/** Flip/rotate animations */
type FlipIntent = "flip x" | "flip y" | "rotate";
/** Emphasis/attention animations */
type EmphasisIntent = "emphasize" | "pulse" | "shake" | "bounce" | "wiggle" | "pop";
/** All animation intents that Jump understands */
type AnimationIntent = FadeIntent | SlideIntent | EnterIntent | ExitIntent | ScaleIntent | FlipIntent | EmphasisIntent;
/** A function that returns the delay for each element in a staggered animation */
type StaggerFn = (index: number, total: number) => number;
/** CSS transform shorthand properties that Jump can animate */
type TransformProperties = {
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
type CSSAnimationProperties = {
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
type AnimatableProperties = TransformProperties & CSSAnimationProperties;
/** A keyframe is a set of properties at a point in the animation. */
type JumpKeyframe = AnimatableProperties & {
    /** Position in the animation (0–1). */
    offset?: number;
    easing?: Easing;
    /** How this keyframe composites with others. Default: "replace" */
    composite?: CompositeOperation;
};
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
type CompoundIntent = `${AnimationIntent} ${AnimationIntent}`;
type AnimationDefinition = AnimationIntent | CompoundIntent | AnimatableProperties | JumpKeyframe[];
/** Fill mode for the animation. "auto" is not valid WAAPI — not included. */
type FillMode = "none" | "forwards" | "backwards" | "both";
/** Direction for the animation */
type AnimationDirection = "normal" | "reverse" | "alternate" | "alternate-reverse";
/** Options for a single jump() call */
type JumpOptions = {
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
/** Returned by every jump() call for controlling the animation */
type JumpControls = {
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
/**
 * Animation style for layout transitions.
 * Pass to jump.layout(), jump.shared(), <Layout>, and <Layout sharedId>.
 */
type LayoutStyle = "spring" | "smooth" | "snappy" | "bouncy" | "slow";
/** Options accepted by layout animation APIs */
type LayoutOptions = JumpOptions & {
    style?: LayoutStyle;
};

type JumpTrigger = "mount" | "visible" | "manual";
type UseJumpOptions = JumpOptions & {
    /** When to trigger. Default: "mount" */
    trigger?: JumpTrigger;
    /** IntersectionObserver threshold (0–1). Default: 0.1 */
    threshold?: number;
    /** Re-trigger every time element enters viewport. Default: false */
    replay?: boolean;
};
type UseJumpReturn<T extends Element> = {
    ref: React.RefObject<T | null>;
    animate: (animation?: AnimationDefinition, options?: JumpOptions) => JumpControls;
    controls: JumpControls | null;
};
/**
 * React hook for animating DOM elements with Jump.
 *
 * ```tsx
 * // Mount
 * const { ref } = useJump("fade in slide up")
 * <div ref={ref}>Hello</div>
 *
 * // On scroll into view
 * const { ref } = useJump("enter from bottom", { trigger: "visible" })
 * <section ref={ref}>...</section>
 *
 * // Manual
 * const { ref, animate } = useJump("pop", { trigger: "manual" })
 * <button ref={ref} onClick={() => animate()}>Click</button>
 * ```
 */
declare function useJump<T extends Element = HTMLElement>(animation: AnimationDefinition, options?: UseJumpOptions): UseJumpReturn<T>;

type AnimateProps = JumpOptions & {
    animation: AnimationDefinition;
    trigger?: JumpTrigger;
    threshold?: number;
    replay?: boolean;
    children: ReactNode;
};
declare function Animate({ animation, trigger, threshold, replay, children, ...options }: AnimateProps): ReactElement | null;

type PresenceProps = {
    show: boolean;
    enter?: AnimationDefinition;
    exit?: AnimationDefinition;
    enterOptions?: JumpOptions;
    exitOptions?: JumpOptions;
    /** If false, skip the enter animation on the very first render. Default: true */
    initial?: boolean;
    children: ReactNode;
};
/**
 * Animate mount/unmount. Keeps the child in the DOM during exit animation.
 *
 * ```tsx
 * <Presence show={open} enter="fade in slide up" exit="fade out">
 *   <Dialog />
 * </Presence>
 * ```
 */
declare function Presence({ show, enter, exit, enterOptions, exitOptions, initial, children, }: PresenceProps): ReactElement | null;

type LayoutParentContextValue = {
    /** Register as a layout child. Returns an unregister fn. */
    registerChild: (ref: RefObject<HTMLElement | null>) => () => void;
    /** Called by the parent when a new FLIP animation starts */
    notifyAnimation: (anim: Animation) => void;
};
type LayoutGroupProps = {
    /** Optional namespace to scope sharedId values within this group */
    id?: string;
    children: ReactNode;
};
/**
 * Synchronises layout animations across sibling components.
 * When any <Layout> inside the group changes, all others re-measure and FLIP.
 * Also namespaces sharedId values to prevent cross-instance collisions.
 *
 * ```tsx
 * <LayoutGroup>
 *   <Accordion />
 *   <Accordion />
 * </LayoutGroup>
 * ```
 */
declare function LayoutGroup({ id, children }: LayoutGroupProps): ReactElement;
type UseLayoutOptions = LayoutOptions & {
    /**
     * Shared element identity. Elements with the same sharedId animate
     * between each other's positions (magic move).
     * Automatically namespaced by the nearest <LayoutGroup>.
     */
    sharedId?: string;
    /**
     * Watch for layout changes and auto-animate.
     * Default: true when no sharedId is set.
     */
    watch?: boolean;
};
type UseLayoutReturn = {
    ref: RefObject<HTMLElement | null>;
    /** @internal Used by <Layout> to provide parent context */
    _parentContext: LayoutParentContextValue | null;
};
/**
 * React hook for layout animations.
 *
 * ```tsx
 * // Auto-layout
 * const { ref } = useLayout()
 * <div ref={ref} className={expanded ? "big" : "small"} />
 *
 * // Shared element
 * const { ref } = useLayout({ sharedId: "hero" })
 * ```
 */
declare function useLayout(options?: UseLayoutOptions): UseLayoutReturn;
type LayoutProps = UseLayoutOptions & {
    children: ReactNode;
};
/**
 * Declarative layout animation component.
 *
 * ```tsx
 * // Auto-layout
 * <Layout>
 *   <div className={expanded ? "big" : "small"}>...</div>
 * </Layout>
 *
 * // Shared element: thumbnail → modal hero
 * <Layout sharedId={`card-${id}`}>
 *   <img src={thumbnail} />
 * </Layout>
 *
 * // Style tokens
 * <Layout style="bouncy">
 *   <div>...</div>
 * </Layout>
 *
 * // Scale correction: children with <Layout> are auto-corrected
 * <Layout>
 *   <div className="card">
 *     <Layout>
 *       <p>Text won't distort during parent's scale animation</p>
 *     </Layout>
 *   </div>
 * </Layout>
 * ```
 */
declare function Layout({ children, ...options }: LayoutProps): ReactElement | null;

type DragAxis = "x" | "y" | "both";
type DragBounds = {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
};
type SnapTo = {
    /** Array of x values to snap to */
    x?: number[];
    /** Array of y values to snap to */
    y?: number[];
};
type DragOptions = {
    /**
     * Which axis the element can be dragged along.
     * "x" | "y" | "both" (default: "both")
     */
    axis?: DragAxis;
    /**
     * Pixel boundaries the element cannot be dragged past.
     * Relative to the element's starting position.
     * { top: -100, bottom: 100, left: -200, right: 200 }
     */
    bounds?: DragBounds;
    /**
     * If true, the element decelerates with momentum after release.
     * The element glides based on its release velocity and gradually stops.
     * Default: true
     */
    momentum?: boolean;
    /**
     * Deceleration rate for momentum (px/s²). Higher = stops faster.
     * Default: 800
     */
    deceleration?: number;
    /**
     * Snap points. After drag ends (and momentum settles), the element
     * springs to the nearest snap point.
     */
    snap?: SnapTo;
    /**
     * Spring config for the bounds bounce-back and snap animation.
     * Default: { stiffness: 300, damping: 28 }
     */
    spring?: {
        stiffness?: number;
        damping?: number;
    };
    /**
     * Cursor style during drag. Default: "grabbing"
     */
    cursor?: string;
    /**
     * Called on every frame during drag with the current offset.
     */
    onDrag?: (state: DragState) => void;
    /**
     * Called when drag starts.
     */
    onDragStart?: (state: DragState) => void;
    /**
     * Called when drag ends (before momentum/snap).
     */
    onDragEnd?: (state: DragState) => void;
    /**
     * Called when the element reaches its final resting position
     * (after momentum and snap complete).
     */
    onSettle?: (state: DragState) => void;
};
type DragState = {
    /** Current x offset from starting position (px) */
    x: number;
    /** Current y offset from starting position (px) */
    y: number;
    /** Current x velocity (px/s) */
    velocityX: number;
    /** Current y velocity (px/s) */
    velocityY: number;
    /** Whether currently being dragged */
    isDragging: boolean;
};

type UseDragOptions = DragOptions;
type UseDragReturn = {
    /** Attach to the element you want to make draggable */
    ref: React.RefObject<HTMLElement | null>;
    /** Get current drag state (position, velocity, isDragging) */
    state: () => DragState;
    /** Programmatically move to a position with spring animation */
    moveTo: (x: number, y: number) => void;
    /** Spring back to starting position */
    reset: () => void;
};
/**
 * React hook for making elements draggable with momentum and spring physics.
 *
 * ```tsx
 * // Basic drag
 * const { ref } = useDrag()
 * <div ref={ref}>Drag me</div>
 *
 * // Constrained to horizontal with bounds
 * const { ref } = useDrag({
 *   axis: "x",
 *   bounds: { left: -200, right: 200 },
 * })
 *
 * // With snap points
 * const { ref } = useDrag({
 *   snap: { x: [0, 100, 200, 300] },
 *   momentum: true,
 * })
 *
 * // Swipeable card
 * const { ref } = useDrag({
 *   axis: "x",
 *   bounds: { left: -300, right: 300 },
 *   onDragEnd: (state) => {
 *     if (Math.abs(state.x) > 150) dismissCard()
 *   }
 * })
 * ```
 */
declare function useDrag(options?: UseDragOptions): UseDragReturn;

type ReorderProps<T> = {
    /** The ordered array of values */
    values: T[];
    /** Called when the order changes (on drop) */
    onReorder: (newOrder: T[]) => void;
    /** Axis of reordering. Default: "y" */
    axis?: "x" | "y";
    /** FLIP animation style. Default: "spring" */
    style?: LayoutStyle;
    children: ReactNode;
};
type ReorderItemProps = {
    /** The value this item represents (must match one entry in `values`) */
    value: unknown;
    /** If true, only this sub-element acts as the drag handle */
    dragHandle?: boolean;
    children: ReactNode;
};
/**
 * Container for a reorderable list. Wrap `<Reorder.Item>` children inside.
 *
 * ```tsx
 * const [items, setItems] = useState(["A", "B", "C"])
 *
 * <Reorder values={items} onReorder={setItems}>
 *   {items.map(item => (
 *     <Reorder.Item key={item} value={item}>
 *       <div className="list-item">{item}</div>
 *     </Reorder.Item>
 *   ))}
 * </Reorder>
 * ```
 */
declare function ReorderRoot<T>({ values, onReorder, axis, style, children, }: ReorderProps<T>): ReactElement;
/**
 * An item within a `<Reorder>` list. Must have a `value` prop that matches
 * one of the values in the parent's `values` array.
 *
 * ```tsx
 * <Reorder.Item value={item}>
 *   <div>{item}</div>
 * </Reorder.Item>
 * ```
 */
declare function ReorderItem({ value, children }: ReorderItemProps): ReactElement | null;
declare const Reorder: typeof ReorderRoot & {
    Item: typeof ReorderItem;
};

export { Animate, type AnimateProps, type JumpTrigger, Layout, LayoutGroup, type LayoutGroupProps, type LayoutProps, Presence, type PresenceProps, Reorder, type ReorderItemProps, type ReorderProps, type UseDragOptions, type UseDragReturn, type UseJumpOptions, type UseJumpReturn, type UseLayoutOptions, type UseLayoutReturn, useDrag, useJump, useLayout };
