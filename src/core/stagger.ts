// ============================================================================
// stagger() — Advanced stagger timing utility
// ============================================================================
// Returns a function (index, total) => delay that can be passed as
// JumpOptions.stagger instead of a plain number.
//
// Usage:
//   jump(".card", "enter from bottom", { stagger: stagger(50) })
//   jump(".card", "enter from bottom", { stagger: stagger(50, { from: "center" }) })
//   jump(".card", "enter from bottom", { stagger: stagger(80, { ease: "ease-in-out" }) })
// ============================================================================

/** Easing function that maps a 0–1 progress to a 0–1 output */
type EaseFn = (t: number) => number;

export type StaggerOptions = {
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
export type StaggerFn = (index: number, total: number) => number;

const EASE_FNS: Record<NonNullable<StaggerOptions["ease"]>, EaseFn> = {
  linear:       (t) => t,
  "ease-in":    (t) => t * t * t,
  "ease-out":   (t) => 1 - Math.pow(1 - t, 3),
  "ease-in-out":(t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

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
export function stagger(
  baseDelay: number,
  options: StaggerOptions = {},
): StaggerFn {
  const { from = "start", ease = "linear", grid, gridFrom = "center" } = options;
  const easeFn = EASE_FNS[ease];

  return (index: number, total: number): number => {
    if (total <= 1) return 0;

    // ── Grid stagger ────────────────────────────────────────────────
    if (grid) {
      const [cols, rows] = grid;
      const col = index % cols;
      const row = Math.floor(index / cols);

      // Resolve origin cell
      let originCol: number;
      let originRow: number;

      if (gridFrom === "center") {
        originCol = (cols - 1) / 2;
        originRow = (rows - 1) / 2;
      } else if (gridFrom === "start") {
        originCol = 0;
        originRow = 0;
      } else if (gridFrom === "end") {
        originCol = cols - 1;
        originRow = rows - 1;
      } else {
        [originCol, originRow] = gridFrom;
      }

      // Euclidean distance from origin — normalized by max possible distance
      const dx = col - originCol;
      const dy = row - originRow;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = Math.sqrt(
        Math.pow(Math.max(originCol, cols - 1 - originCol), 2) +
        Math.pow(Math.max(originRow, rows - 1 - originRow), 2),
      );
      const t = maxDist === 0 ? 0 : dist / maxDist;
      return easeFn(t) * baseDelay * Math.sqrt(rows * cols);
    }

    // ── Linear stagger ───────────────────────────────────────────────

    // Resolve origin index
    let origin: number;
    if (from === "start") {
      origin = 0;
    } else if (from === "end") {
      origin = total - 1;
    } else if (from === "center") {
      origin = (total - 1) / 2;
    } else {
      // Specific index, clamped to valid range
      origin = Math.max(0, Math.min(total - 1, from));
    }

    // Distance from origin, normalized to 0–1
    const dist = Math.abs(index - origin);
    const maxDist = Math.max(origin, total - 1 - origin);
    const t = maxDist === 0 ? 0 : dist / maxDist;

    return easeFn(t) * baseDelay * (total - 1);
  };
}
