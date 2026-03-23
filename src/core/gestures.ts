// ============================================================================
// Gesture Primitives — jump.hover() and jump.press()
// ============================================================================
// Correct pointer event management with:
// - Touch event filtering (no stuck hover on mobile)
// - Keyboard accessibility for press (Enter key)
// - Proper cleanup on unmount / stop()
// - Support for targets that use focus-visible
// ============================================================================

import type { JumpTarget } from "../types/index.js";
import { resolveTargets } from "./engine.js";

/** Returned by jump.hover() and jump.press() — call to remove all listeners */
export type GestureControls = {
  /** Remove all event listeners added by this gesture */
  stop: () => void;
};

export type HoverOptions = {
  /**
   * Called when the pointer enters the element.
   * Return a cleanup function to reverse the animation when the pointer leaves.
   * If you don't return one, the leave callback handles reversal.
   */
  onEnter: (element: Element) => (() => void) | void;
  /**
   * Called when the pointer leaves.
   * Optional if onEnter returns a cleanup function.
   */
  onLeave?: (element: Element) => void;
};

export type PressOptions = {
  /**
   * Called when the element is pressed (pointerdown or Enter key).
   * Return a cleanup to reverse when released.
   */
  onPress: (element: Element) => (() => void) | void;
  /**
   * Called when press is released (pointerup/pointercancel or Enter keyup).
   * Optional if onPress returns a cleanup.
   */
  onRelease?: (element: Element) => void;
};

/**
 * Wires hover animations to an element with correct touch filtering.
 *
 * On touch devices, `mouseenter`/`mouseleave` fire unreliably. This
 * uses `pointerenter`/`pointerleave` but ignores `pointerType === "touch"`
 * so the hover state never gets stuck on mobile.
 *
 * ```ts
 * jump.hover(button, {
 *   onEnter: (el) => {
 *     const ctrl = jump.to(el, { scale: 1.05 }, springs.gentle())
 *     return () => jump.to(el, { scale: 1 }, springs.gentle())
 *   }
 * })
 * ```
 */
export function createHover(
  target: JumpTarget,
  options: HoverOptions,
): GestureControls {
  const elements = resolveTargets(target);
  const cleanups: Array<() => void> = [];

  for (const el of elements) {
    const enterCleanupRef = { fn: null as (() => void) | null };

    const onEnter = (e: Event) => {
      // Ignore touch — avoids stuck hover on mobile
      if ((e as PointerEvent).pointerType === "touch") return;
      const cleanup = options.onEnter(el);
      if (typeof cleanup === "function") {
        enterCleanupRef.fn = cleanup;
      }
    };

    const onLeave = (e: Event) => {
      if ((e as PointerEvent).pointerType === "touch") return;
      if (enterCleanupRef.fn) {
        enterCleanupRef.fn();
        enterCleanupRef.fn = null;
      } else {
        options.onLeave?.(el);
      }
    };

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    // Also handle when pointer is captured away (e.g., scroll starts)
    el.addEventListener("pointercancel", onLeave);

    cleanups.push(() => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointercancel", onLeave);
      // Clean up any lingering hover state
      if (enterCleanupRef.fn) {
        enterCleanupRef.fn();
        enterCleanupRef.fn = null;
      }
    });
  }

  return {
    stop() {
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
    },
  };
}

/**
 * Wires press animations to an element with keyboard accessibility.
 *
 * Handles:
 * - Pointer down/up/cancel for mouse and touch
 * - Enter key down/up for keyboard users
 * - Correct cleanup when press is cancelled (pointer leaves before up)
 *
 * ```ts
 * jump.press(button, {
 *   onPress: (el) => {
 *     const ctrl = jump.to(el, { scale: 0.95 }, springs.stiff())
 *     return () => jump.to(el, { scale: 1 }, springs.stiff())
 *   }
 * })
 * ```
 */
export function createPress(
  target: JumpTarget,
  options: PressOptions,
): GestureControls {
  const elements = resolveTargets(target);
  const cleanups: Array<() => void> = [];

  for (const el of elements) {
    const pressCleanupRef = { fn: null as (() => void) | null };
    let isPressed = false;

    const press = () => {
      if (isPressed) return;
      isPressed = true;
      const cleanup = options.onPress(el);
      if (typeof cleanup === "function") {
        pressCleanupRef.fn = cleanup;
      }
    };

    const release = () => {
      if (!isPressed) return;
      isPressed = false;
      if (pressCleanupRef.fn) {
        pressCleanupRef.fn();
        pressCleanupRef.fn = null;
      } else {
        options.onRelease?.(el);
      }
    };

    const onPointerDown = () => press();
    const onPointerUp = () => release();
    const onPointerCancel = () => release();

    // Keyboard: Enter key triggers press for non-button elements
    const onKeyDown = (e: Event) => {
      if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") {
        press();
      }
    };
    const onKeyUp = (e: Event) => {
      if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") {
        release();
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerCancel);
    // Release if pointer leaves while still down (e.g., drag away from button)
    el.addEventListener("pointerleave", onPointerUp);
    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("keyup", onKeyUp);

    cleanups.push(() => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerCancel);
      el.removeEventListener("pointerleave", onPointerUp);
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("keyup", onKeyUp);
      if (pressCleanupRef.fn) {
        pressCleanupRef.fn();
        pressCleanupRef.fn = null;
      }
    });
  }

  return {
    stop() {
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
    },
  };
}
