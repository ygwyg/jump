import { useRef, useEffect, useCallback } from "react";
import type { AnimationDefinition, JumpOptions, JumpControls } from "../types/index.js";
import { jump } from "../core/index.js";

export type JumpTrigger =
  | "mount"   // animate on mount (default)
  | "visible" // animate when element enters viewport
  | "manual"; // only animate when animate() is called explicitly

export type UseJumpOptions = JumpOptions & {
  /** When to trigger. Default: "mount" */
  trigger?: JumpTrigger;
  /** IntersectionObserver threshold (0–1). Default: 0.1 */
  threshold?: number;
  /** Re-trigger every time element enters viewport. Default: false */
  replay?: boolean;
};

export type UseJumpReturn<T extends Element> = {
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
export function useJump<T extends Element = HTMLElement>(
  animation: AnimationDefinition,
  options: UseJumpOptions = {},
): UseJumpReturn<T> {
  const ref = useRef<T | null>(null);
  const controlsRef = useRef<JumpControls | null>(null);
  const hasAnimatedRef = useRef(false);

  // Store options in a ref so animate() always reads the latest values
  // without needing to be in the dep array (avoids stale closure bug)
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const { trigger = "mount", threshold = 0.1, replay = false } = options;

  const animate = useCallback(
    (overrideAnimation?: AnimationDefinition, overrideOptions?: JumpOptions): JumpControls => {
      const element = ref.current;
      if (!element) return jump([], animation as AnimationDefinition);

      const { trigger: _t, threshold: _th, replay: _r, ...jumpOpts } = optionsRef.current;
      const controls = jump(
        element,
        overrideAnimation ?? animation,
        overrideOptions ?? jumpOpts,
      );
      controlsRef.current = controls;
      return controls;
    },
    [animation], // animation identity change resets the callback
  );

  // Mount trigger
  useEffect(() => {
    if (trigger !== "mount") return;
    animate();
  }, [trigger, animate]);

  // Visible trigger
  useEffect(() => {
    if (trigger !== "visible") return;
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!hasAnimatedRef.current || replay) {
              animate();
              hasAnimatedRef.current = true;
            }
            if (!replay) observer.unobserve(element);
          }
        }
      },
      { threshold },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [trigger, threshold, replay, animate]);

  // Cancel running animations on unmount to prevent:
  // - animations running on detached DOM nodes
  // - onComplete callbacks firing after unmount
  // - memory leaks from animation holding element references
  useEffect(() => {
    return () => { controlsRef.current?.cancel(); };
  }, []);

  return {
    ref,
    animate,
    get controls() { return controlsRef.current; },
  };
}
