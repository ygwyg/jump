import type { Ref, RefCallback, MutableRefObject } from "react";

/**
 * Merges multiple React refs into a single callback ref.
 * Prevents cloneElement from clobbering the child's existing ref.
 */
export function mergeRefs<T>(
  ...refs: (Ref<T> | undefined | null)[]
): RefCallback<T> {
  return (value: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref && typeof ref === "object") {
        (ref as MutableRefObject<T | null>).current = value;
      }
    }
  };
}
