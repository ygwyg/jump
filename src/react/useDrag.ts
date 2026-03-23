import { useRef, useEffect, useCallback } from "react";
import { createDrag } from "../core/drag.js";
import type { DragOptions, DragControls, DragState } from "../core/drag.js";

export type UseDragOptions = DragOptions;

export type UseDragReturn = {
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
export function useDrag(options: UseDragOptions = {}): UseDragReturn {
  const ref = useRef<HTMLElement | null>(null);
  const controlsRef = useRef<DragControls | null>(null);

  // Store options in ref to avoid stale closures in callbacks
  const optsRef = useRef(options);
  useEffect(() => { optsRef.current = options; });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    controlsRef.current = createDrag(el, optsRef.current);
    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  // Re-create on axis/bounds changes — these are structural, not just callbacks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.axis, JSON.stringify(options.bounds), JSON.stringify(options.snap)]);

  const state = useCallback((): DragState => {
    return controlsRef.current?.state() ?? {
      x: 0, y: 0, velocityX: 0, velocityY: 0, isDragging: false,
    };
  }, []);

  const moveTo = useCallback((x: number, y: number) => {
    controlsRef.current?.moveTo(x, y);
  }, []);

  const reset = useCallback(() => {
    controlsRef.current?.reset();
  }, []);

  return { ref, state, moveTo, reset };
}
