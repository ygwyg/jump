import type {
  AnimationIntent,
  JumpKeyframe,
  JumpOptions,
} from "../types/index.js";

// ============================================================================
// Intent Resolution
// ============================================================================

export type ResolvedIntent = {
  keyframes: JumpKeyframe[];
  isEnter: boolean;
  isExit: boolean;
  isEmphasis: boolean;
};

const INTENT_RESOLVERS: Record<
  AnimationIntent,
  (options: JumpOptions) => JumpKeyframe[]
> = {
  // --- Fade ---
  "fade in":  () => [{ opacity: 0 }, { opacity: 1 }],
  "fade out": () => [{ opacity: 1 }, { opacity: 0 }],

  // --- Slide (enter-like: element arrives at rest position) ---
  "slide up":    (o) => [{ y:  (o.distance ?? 20) }, { y: 0 }],
  "slide down":  (o) => [{ y: -(o.distance ?? 20) }, { y: 0 }],
  "slide left":  (o) => [{ x:  (o.distance ?? 20) }, { x: 0 }],
  "slide right": (o) => [{ x: -(o.distance ?? 20) }, { x: 0 }],

  // --- Enter ---
  enter:               () => [{ opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1 }],
  "enter from top":    (o) => [{ opacity: 0, y: -(o.distance ?? 20) }, { opacity: 1, y: 0 }],
  "enter from bottom": (o) => [{ opacity: 0, y:  (o.distance ?? 20) }, { opacity: 1, y: 0 }],
  "enter from left":   (o) => [{ opacity: 0, x: -(o.distance ?? 20) }, { opacity: 1, x: 0 }],
  "enter from right":  (o) => [{ opacity: 0, x:  (o.distance ?? 20) }, { opacity: 1, x: 0 }],

  // --- Exit ---
  exit:          () => [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.95 }],
  "exit top":    (o) => [{ opacity: 1, y: 0 }, { opacity: 0, y: -(o.distance ?? 20) }],
  "exit bottom": (o) => [{ opacity: 1, y: 0 }, { opacity: 0, y:  (o.distance ?? 20) }],
  "exit left":   (o) => [{ opacity: 1, x: 0 }, { opacity: 0, x: -(o.distance ?? 20) }],
  "exit right":  (o) => [{ opacity: 1, x: 0 }, { opacity: 0, x:  (o.distance ?? 20) }],

  // --- Scale ---
  "scale up":   (o) => [{ scale: 1 },               { scale: o.scaleFactor ?? 1.2 }],
  "scale down": (o) => [{ scale: 1 },               { scale: o.scaleFactor ?? 0.8 }],
  grow:         (o) => [{ scale: 0, opacity: 0 },   { scale: o.scaleFactor ?? 1, opacity: 1 }],
  shrink:       (o) => [{ scale: 1, opacity: 1 },   { scale: o.scaleFactor ?? 0, opacity: 0 }],

  // --- Flip (perspective is injected in buildTransform in engine.ts) ---
  "flip x": () => [{ rotateX: 0 }, { rotateX: 180 }],
  "flip y": () => [{ rotateY: 0 }, { rotateY: 180 }],
  rotate:   () => [{ rotate: 0 },  { rotate: 360 }],

  // --- Emphasis ---
  emphasize: () => [
    { scale: 1 },
    { scale: 1.06, offset: 0.5 },
    { scale: 1 },
  ],
  pulse: () => [
    { opacity: 1 },
    { opacity: 0.4, offset: 0.5 },
    { opacity: 1 },
  ],
  shake: () => [
    { x: 0 },
    { x: -8, offset: 0.15 },
    { x:  8, offset: 0.30 },
    { x: -6, offset: 0.45 },
    { x:  6, offset: 0.60 },
    { x: -3, offset: 0.75 },
    { x: 0 },
  ],
  bounce: () => [
    { y:   0 },
    { y: -18, offset: 0.30 },
    { y:   0, offset: 0.50 },
    { y:  -8, offset: 0.70 },
    { y:   0 },
  ],
  wiggle: () => [
    { rotate:  0 },
    { rotate: -6, offset: 0.20 },
    { rotate:  6, offset: 0.40 },
    { rotate: -4, offset: 0.60 },
    { rotate:  4, offset: 0.80 },
    { rotate:  0 },
  ],
  pop: () => [
    { scale: 1,    opacity: 1 },
    { scale: 1.18, opacity: 1, offset: 0.40 },
    { scale: 0.94, opacity: 1, offset: 0.70 },
    { scale: 1,    opacity: 1 },
  ],
};

// Slide intents animate elements to their rest position — treat as "enter"
// so they get ease-out-cubic by default instead of ease-in-out-cubic.
const ENTER_INTENTS = new Set<string>([
  "fade in",
  "enter",
  "enter from top",
  "enter from bottom",
  "enter from left",
  "enter from right",
  "slide up",
  "slide down",
  "slide left",
  "slide right",
  "grow",
]);

const EXIT_INTENTS = new Set<string>([
  "fade out",
  "exit",
  "exit top",
  "exit bottom",
  "exit left",
  "exit right",
  "scale down",
  "shrink",
]);

const EMPHASIS_INTENTS = new Set<string>([
  "emphasize",
  "pulse",
  "shake",
  "bounce",
  "wiggle",
  "pop",
]);

// Pre-sorted for greedy compound matching (longest first)
const SORTED_INTENTS = (
  Object.keys(INTENT_RESOLVERS) as AnimationIntent[]
).sort((a, b) => b.length - a.length);

// The set of all valid intent strings for fast O(1) lookup in isIntentString
const KNOWN_INTENTS = new Set<string>(Object.keys(INTENT_RESOLVERS));

// ============================================================================
// Public API
// ============================================================================

/**
 * Checks whether a string is a known intent or compound of known intents.
 * Rejects CSS property values ("red", "none", "auto") that would previously
 * have matched the old /^[a-z ]+$/ regex.
 */
export function isIntentString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  // Fast path: exact match
  if (KNOWN_INTENTS.has(value)) return true;
  // Compound: at least one known intent must be found
  return findCompoundIntents(value).length > 0;
}

/**
 * Resolves an intent string (possibly compound) into keyframes.
 *
 * Throws for completely unrecognized strings.
 * In development, warns about partially-recognized compound intents
 * that contain unknown tokens.
 */
export function resolveIntent(
  intentStr: string,
  options: JumpOptions,
): ResolvedIntent {
  // Exact match
  const exactResolver = INTENT_RESOLVERS[intentStr as AnimationIntent];
  if (exactResolver) {
    return {
      keyframes: exactResolver(options),
      isEnter: ENTER_INTENTS.has(intentStr),
      isExit: EXIT_INTENTS.has(intentStr),
      isEmphasis: EMPHASIS_INTENTS.has(intentStr),
    };
  }

  const { matched, skipped } = findCompoundIntentsVerbose(intentStr);

  if (matched.length === 0) {
    throw new Error(
      `[jump] Unknown animation intent: "${intentStr}". ` +
        `Valid intents: ${[...KNOWN_INTENTS].join(", ")}`,
    );
  }

  // Dev warning for partial matches (typos in compound intents)
  if (skipped.length > 0 && typeof globalThis !== "undefined" && (globalThis as Record<string, unknown>)["__DEV__"] !== false) {
    console.warn(
      `[jump] Unrecognized tokens in compound intent "${intentStr}": ${skipped.map((s) => `"${s}"`).join(", ")}. ` +
        `These were ignored. Did you mean one of: ${[...KNOWN_INTENTS].join(", ")}?`,
    );
  }

  const allKeyframes = matched.map((intent) => INTENT_RESOLVERS[intent]!(options));
  const merged = mergeKeyframes(allKeyframes, intentStr);

  return {
    keyframes: merged,
    isEnter: matched.some((i) => ENTER_INTENTS.has(i)),
    isExit: matched.some((i) => EXIT_INTENTS.has(i)),
    isEmphasis: matched.some((i) => EMPHASIS_INTENTS.has(i)),
  };
}

// ============================================================================
// Internal
// ============================================================================

function findCompoundIntents(input: string): AnimationIntent[] {
  return findCompoundIntentsVerbose(input).matched;
}

function findCompoundIntentsVerbose(
  input: string,
): { matched: AnimationIntent[]; skipped: string[] } {
  const matched: AnimationIntent[] = [];
  const skipped: string[] = [];
  let remaining = input.trim();

  while (remaining.length > 0) {
    let hit = false;
    for (const intent of SORTED_INTENTS) {
      if (remaining.startsWith(intent)) {
        // Ensure it's a whole-word match (not a prefix of a longer unknown word)
        const after = remaining[intent.length];
        if (after === undefined || after === " ") {
          matched.push(intent);
          remaining = remaining.slice(intent.length).trim();
          hit = true;
          break;
        }
      }
    }
    if (!hit) {
      const nextSpace = remaining.indexOf(" ");
      const token = nextSpace === -1 ? remaining : remaining.slice(0, nextSpace);
      skipped.push(token);
      remaining = nextSpace === -1 ? "" : remaining.slice(nextSpace + 1).trim();
    }
  }

  return { matched, skipped };
}

/**
 * Merges keyframe arrays from multiple intents into a single animation.
 *
 * Rules:
 * - Two 2-keyframe intents: merge from+to by property union
 * - Multi-keyframe intent (emphasis) + 2-keyframe intents: overlay the
 *   2-keyframe start/end properties onto the multi-keyframe array
 * - Two multi-keyframe intents: cannot merge — throw with a clear message
 */
function mergeKeyframes(
  allKeyframes: JumpKeyframe[][],
  intentStr: string,
): JumpKeyframe[] {
  const twoFrame = allKeyframes.filter((kfs) => kfs.length === 2);
  const multiFrame = allKeyframes.filter((kfs) => kfs.length > 2);

  if (multiFrame.length > 1) {
    throw new Error(
      `[jump] Cannot combine two emphasis animations in one intent: "${intentStr}". ` +
        `Run them sequentially with jump.sequence() instead.`,
    );
  }

  if (multiFrame.length === 1) {
    // Overlay 2-frame start/end values onto the multi-frame animation
    const base = multiFrame[0]!.map((kf) => ({ ...kf }));
    const overlayFrom: JumpKeyframe = {};
    const overlayTo: JumpKeyframe = {};
    for (const kfs of twoFrame) {
      Object.assign(overlayFrom, kfs[0]);
      Object.assign(overlayTo, kfs[1]);
    }
    // Apply overlay: first keyframe gets from-values, last gets to-values
    Object.assign(base[0]!, overlayFrom);
    Object.assign(base[base.length - 1]!, overlayTo);
    return base;
  }

  // All 2-frame: simple property merge
  const from: JumpKeyframe = {};
  const to: JumpKeyframe = {};
  for (const kfs of twoFrame) {
    Object.assign(from, kfs[0]);
    Object.assign(to, kfs[1]);
  }
  return [from, to];
}
