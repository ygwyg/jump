import {
  type ReactNode,
  type ReactElement,
  type Key,
  useState,
  useRef,
  useEffect,
  useCallback,
  createContext,
  useContext,
  Children,
  cloneElement,
  isValidElement,
} from "react";
import type { LayoutStyle } from "../types/index.js";
import { snapshot, flip } from "../core/layout.js";

// ============================================================================
// Reorder — Drag-to-reorder list with FLIP animations
// ============================================================================

export type ReorderProps<T> = {
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

export type ReorderItemProps = {
  /** The value this item represents (must match one entry in `values`) */
  value: unknown;
  /** If true, only this sub-element acts as the drag handle */
  dragHandle?: boolean;
  children: ReactNode;
};

type ReorderContextValue = {
  axis: "x" | "y";
  style: LayoutStyle;
  registerItem: (value: unknown, ref: React.RefObject<HTMLElement | null>) => () => void;
  onDragStart: (value: unknown, pointerY: number, pointerX: number) => void;
  onDragMove: (value: unknown, pointerY: number, pointerX: number) => void;
  onDragEnd: (value: unknown) => void;
  draggedValue: unknown | null;
};

const ReorderContext = createContext<ReorderContextValue | null>(null);

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
function ReorderRoot<T>({
  values,
  onReorder,
  axis = "y",
  style = "spring",
  children,
}: ReorderProps<T>): ReactElement {
  const itemRefs = useRef(new Map<unknown, React.RefObject<HTMLElement | null>>());
  const [draggedValue, setDraggedValue] = useState<unknown | null>(null);
  const orderRef = useRef(values);
  orderRef.current = values;

  const registerItem = useCallback(
    (value: unknown, ref: React.RefObject<HTMLElement | null>) => {
      itemRefs.current.set(value, ref);
      return () => { itemRefs.current.delete(value); };
    },
    [],
  );

  const snapshotAll = useCallback(() => {
    const snaps = new Map<unknown, ReturnType<typeof snapshot>>();
    for (const [value, ref] of itemRefs.current) {
      if (ref.current) snaps.set(value, snapshot(ref.current));
    }
    return snaps;
  }, []);

  const flipAll = useCallback(
    (snaps: Map<unknown, ReturnType<typeof snapshot>>) => {
      for (const [value, ref] of itemRefs.current) {
        const prev = snaps.get(value);
        if (prev && ref.current) {
          flip(ref.current, prev, { style });
        }
      }
    },
    [style],
  );

  // Cache bounding rects during a drag to avoid layout thrashing
  const rectCache = useRef(new Map<unknown, DOMRect>());

  const cacheAllRects = useCallback(() => {
    rectCache.current.clear();
    for (const [value, ref] of itemRefs.current) {
      if (ref.current) rectCache.current.set(value, ref.current.getBoundingClientRect());
    }
  }, []);

  const onDragStart = useCallback(
    (value: unknown, _py: number, _px: number) => {
      setDraggedValue(value);
      cacheAllRects(); // snapshot all rects once at drag start
    },
    [cacheAllRects],
  );

  const onDragMove = useCallback(
    (value: unknown, pointerY: number, pointerX: number) => {
      const currentOrder = orderRef.current as T[];
      const dragIdx = currentOrder.indexOf(value as T);
      if (dragIdx === -1) return;

      // Use cached rects instead of querying DOM on every pointermove
      for (const [otherValue] of itemRefs.current) {
        if (otherValue === value) continue;
        const rect = rectCache.current.get(otherValue);
        if (!rect) continue;
        const centerY = rect.top + rect.height / 2;
        const centerX = rect.left + rect.width / 2;
        const otherIdx = currentOrder.indexOf(otherValue as T);

        const isOver = axis === "y"
          ? (dragIdx < otherIdx && pointerY > centerY) || (dragIdx > otherIdx && pointerY < centerY)
          : (dragIdx < otherIdx && pointerX > centerX) || (dragIdx > otherIdx && pointerX < centerX);

        if (isOver && otherIdx !== -1) {
          const snaps = snapshotAll();
          const newOrder = [...currentOrder];
          newOrder.splice(dragIdx, 1);
          newOrder.splice(otherIdx, 0, value as T);
          onReorder(newOrder);
          // FLIP and re-cache after React re-renders
          requestAnimationFrame(() => { flipAll(snaps); cacheAllRects(); });
          return;
        }
      }
    },
    [axis, onReorder, snapshotAll, flipAll],
  );

  const onDragEnd = useCallback(
    (_value: unknown) => {
      setDraggedValue(null);
    },
    [],
  );

  return (
    <ReorderContext.Provider
      value={{ axis, style, registerItem, onDragStart, onDragMove, onDragEnd, draggedValue }}
    >
      {children}
    </ReorderContext.Provider>
  );
}

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
function ReorderItem({ value, children }: ReorderItemProps): ReactElement | null {
  const ctx = useContext(ReorderContext);
  if (!ctx) throw new Error("[jump] <Reorder.Item> must be inside a <Reorder>");

  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return ctx.registerItem(value, ref);
  }, [value, ctx]);

  // Pointer events for drag
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let dragging = false;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      el.setPointerCapture(e.pointerId);
      el.style.zIndex = "10";
      el.style.cursor = "grabbing";
      ctx.onDragStart(value, e.clientY, e.clientX);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      ctx.onDragMove(value, e.clientY, e.clientX);
    };

    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      el.style.zIndex = "";
      el.style.cursor = "";
      ctx.onDragEnd(value);
    };

    el.style.cursor = "grab";
    el.style.touchAction = ctx.axis === "x" ? "pan-y" : "pan-x";
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, [value, ctx]);

  const child = Children.only(children);
  if (!isValidElement(child)) return child as unknown as ReactElement;

  return cloneElement(child as ReactElement<{ ref?: React.Ref<HTMLElement> }>, { ref });
}

// Attach Item as a static property
export const Reorder = Object.assign(ReorderRoot, { Item: ReorderItem });
