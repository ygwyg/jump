import {
  type ReactNode,
  type ReactElement,
  type RefObject,
  useRef,
  useEffect,
  useLayoutEffect,
  useContext,
  useCallback,
  cloneElement,
  isValidElement,
  Children,
  createContext,
} from "react";
import type { LayoutOptions, LayoutSnapshot } from "../types/index.js";
import {
  snapshot,
  animateShared,
  recordShared,
  flip,
  watchLayout,
  correctChildScale,
} from "../core/layout.js";

// ============================================================================
// Parent-Child Scale Correction Context
// ============================================================================
// When a parent <Layout> runs a FLIP animation that includes scale,
// children with <Layout> need per-frame inverse-scale correction.
// This context lets children discover their parent's current FLIP animation.

type LayoutParentContextValue = {
  /** Register as a layout child. Returns an unregister fn. */
  registerChild: (ref: RefObject<HTMLElement | null>) => () => void;
  /** Called by the parent when a new FLIP animation starts */
  notifyAnimation: (anim: Animation) => void;
};

const LayoutParentContext = createContext<LayoutParentContextValue | null>(null);

// ============================================================================
// LayoutGroup Context
// ============================================================================

type LayoutGroupContextValue = {
  id?: string;
  subscribe: (cb: () => void) => () => void;
  notify: () => void;
};

const LayoutGroupContext = createContext<LayoutGroupContextValue>({
  subscribe: () => () => {},
  notify: () => {},
});

export type LayoutGroupProps = {
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
export function LayoutGroup({ id, children }: LayoutGroupProps): ReactElement {
  const subscribers = useRef(new Set<() => void>());

  const subscribe = useCallback((cb: () => void) => {
    subscribers.current.add(cb);
    return () => { subscribers.current.delete(cb); };
  }, []);

  const notify = useCallback(() => {
    subscribers.current.forEach((cb) => cb());
  }, []);

  return (
    <LayoutGroupContext.Provider value={{ id, subscribe, notify }}>
      {children as ReactElement}
    </LayoutGroupContext.Provider>
  );
}

// ============================================================================
// useLayout hook
// ============================================================================

export type UseLayoutOptions = LayoutOptions & {
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

export type UseLayoutReturn = {
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
export function useLayout(options: UseLayoutOptions = {}): UseLayoutReturn {
  const { sharedId, watch = !sharedId, ...layoutOpts } = options;
  const ref = useRef<HTMLElement | null>(null);
  const group = useContext(LayoutGroupContext);
  const parentLayout = useContext(LayoutParentContext);

  const resolvedId = sharedId
    ? group.id ? `${group.id}:${sharedId}` : sharedId
    : null;

  // ── Strict Mode double-invoke guard ──────────────────────────────────
  // React 18/19 Strict Mode invokes effects twice on mount. We track
  // whether this is a genuine first mount vs a strict-mode re-invoke.
  const mountCount = useRef(0);
  const isStrictModeReinvoke = useRef(false);

  // ── Children registry for scale correction ───────────────────────────
  const childRefs = useRef(new Set<RefObject<HTMLElement | null>>());
  const childCancelFns = useRef(new Map<RefObject<HTMLElement | null>, () => void>());

  const registerChild = useCallback((childRef: RefObject<HTMLElement | null>) => {
    childRefs.current.add(childRef);
    return () => {
      childRefs.current.delete(childRef);
      childCancelFns.current.get(childRef)?.();
      childCancelFns.current.delete(childRef);
    };
  }, []);

  const notifyAnimation = useCallback((anim: Animation) => {
    // Start scale correction for each registered child
    for (const childRef of childRefs.current) {
      // Cancel any previous correction for this child
      childCancelFns.current.get(childRef)?.();

      const childEl = childRef.current;
      if (childEl) {
        const cancel = correctChildScale(childEl, anim);
        childCancelFns.current.set(childRef, cancel);
      }
    }
  }, []);

  // ── Register this element as a child of a parent <Layout> ────────────
  useEffect(() => {
    if (!parentLayout) return;
    return parentLayout.registerChild(ref);
  }, [parentLayout]);

  // ── Store layoutOpts in a ref to avoid stale closures ────────────────
  const optsRef = useRef(layoutOpts);
  useEffect(() => { optsRef.current = layoutOpts; });

  // ── Shared element: animate from last position on mount ──────────────
  useLayoutEffect(() => {
    mountCount.current++;

    // In strict mode, the second invoke has stale/torn-down state.
    // Skip it — the third invoke (if strict mode) is the real one.
    if (mountCount.current === 2) {
      isStrictModeReinvoke.current = true;
    }

    const el = ref.current;
    if (!el || !resolvedId) return;

    // Don't run on the strict-mode cleanup/re-mount if nothing changed
    if (isStrictModeReinvoke.current && mountCount.current === 2) {
      return;
    }

    const anim = animateShared(el, resolvedId, optsRef.current);
    if (anim) {
      notifyAnimation(anim);
      group.notify();
    }

    return () => {
      if (ref.current) {
        recordShared(ref.current, resolvedId, optsRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedId]);

  // ── Auto-layout watching: snap before render, FLIP after ─────────────
  const prevSnap = useRef<LayoutSnapshot | null>(null);
  const hasMounted = useRef(false);

  // Capture snapshot after each paint (for use in the NEXT render's FLIP)
  useEffect(() => {
    if (!watch || !ref.current) return;

    // Skip the initial snapshot on first mount — there's no "before" to FLIP from.
    // This prevents a FLIP from (0,0) on strict-mode double-invoke.
    if (!hasMounted.current) {
      hasMounted.current = true;
      prevSnap.current = snapshot(ref.current);
      return;
    }

    prevSnap.current = snapshot(ref.current);
  });

  // After DOM mutations: FLIP from prev snapshot to new position
  useLayoutEffect(() => {
    if (!watch || !ref.current || !prevSnap.current || !hasMounted.current) return;

    const anim = flip(ref.current, prevSnap.current, optsRef.current);
    if (anim) {
      notifyAnimation(anim);
      group.notify();
    }
  });

  // ── Group notifications: re-FLIP when siblings change layout ─────────
  useEffect(() => {
    if (!watch || !ref.current) return;

    return group.subscribe(() => {
      const el = ref.current;
      if (!el || !prevSnap.current) return;
      const anim = flip(el, prevSnap.current, optsRef.current);
      if (anim) {
        notifyAnimation(anim);
        prevSnap.current = snapshot(el);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch]);

  // ── ResizeObserver fallback for external layout changes ──────────────
  useEffect(() => {
    if (!watch || !ref.current) return;
    return watchLayout(ref.current, optsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch]);

  // ── Cleanup scale correction on unmount ──────────────────────────────
  useEffect(() => {
    return () => {
      for (const cancel of childCancelFns.current.values()) {
        cancel();
      }
      childCancelFns.current.clear();
    };
  }, []);

  // Provide parent context for <Layout> component to wrap children with
  const parentCtx: LayoutParentContextValue = { registerChild, notifyAnimation };

  return { ref, _parentContext: parentCtx };
}

// ============================================================================
// <Layout> component
// ============================================================================

export type LayoutProps = UseLayoutOptions & {
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
export function Layout({ children, ...options }: LayoutProps): ReactElement | null {
  const { ref, _parentContext: parentCtx } = useLayout(options);

  const child = Children.only(children);
  if (!isValidElement(child)) return child as unknown as ReactElement;

  const cloned = cloneElement(
    child as ReactElement<{ ref?: React.Ref<HTMLElement> }>,
    { ref },
  );

  // Provide parent context so children can register for scale correction
  if (parentCtx) {
    return (
      <LayoutParentContext.Provider value={parentCtx}>
        {cloned}
      </LayoutParentContext.Provider>
    );
  }

  return cloned;
}
