// ============================================================================
// jump.scrollProgress() — Reactive Scroll Progress Value
// ============================================================================
// Returns a 0→1 progress value representing how far an element (or the page)
// has scrolled through the viewport.
//
// API:
//   const p = jump.scrollProgress(el)
//   p.get()           // current 0–1 value
//   p.onChange(fn)     // subscribe to updates
//   p.stop()           // unsubscribe
//
//   // Page-level:
//   const p = jump.scrollProgress()
//   p.onChange(value => progressBar.style.width = value * 100 + '%')
// ============================================================================

export type ScrollProgressOptions = {
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

export type ScrollProgressValue = {
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
export function createScrollProgress(
  element?: Element,
  options: ScrollProgressOptions = {},
): ScrollProgressValue {
  const { axis = "y", container = window } = options;
  const listeners = new Set<(value: number) => void>();
  let currentValue = 0;
  let rafId = 0;
  let stopped = false;

  function compute(): number {
    if (!element) {
      // Page-level progress
      const scrollEl = container === window
        ? document.documentElement
        : container as Element;
      if (axis === "y") {
        const scrollTop = container === window
          ? window.scrollY
          : (container as Element).scrollTop;
        const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
        return maxScroll > 0 ? scrollTop / maxScroll : 0;
      } else {
        const scrollLeft = container === window
          ? window.scrollX
          : (container as Element).scrollLeft;
        const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
        return maxScroll > 0 ? scrollLeft / maxScroll : 0;
      }
    }

    // Element-level progress: 0 when element enters viewport, 1 when it leaves
    const rect = element.getBoundingClientRect();
    const viewportSize = axis === "y" ? window.innerHeight : window.innerWidth;
    const start = axis === "y" ? rect.top : rect.left;
    const size = axis === "y" ? rect.height : rect.width;

    // Element enters when its top reaches the viewport bottom (start = viewportSize)
    // Element exits when its bottom passes the viewport top (start + size = 0)
    const total = viewportSize + size;
    const progress = 1 - (start + size) / total;

    return Math.max(0, Math.min(1, progress));
  }

  function update(): void {
    if (stopped) return;
    const newValue = compute();
    if (Math.abs(newValue - currentValue) > 0.0001) {
      currentValue = newValue;
      for (const cb of listeners) {
        cb(currentValue);
      }
    }
  }

  // Use passive scroll listener for performance
  const scrollTarget = container === window ? window : container;
  const onScroll = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(update);
  };

  scrollTarget.addEventListener("scroll", onScroll as EventListener, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  // Compute initial value
  update();

  return {
    get() {
      return currentValue;
    },
    onChange(callback: (value: number) => void) {
      listeners.add(callback);
      // Immediately call with current value
      callback(currentValue);
      return () => { listeners.delete(callback); };
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(rafId);
      scrollTarget.removeEventListener("scroll", onScroll as EventListener);
      window.removeEventListener("resize", onScroll);
      listeners.clear();
    },
  };
}
