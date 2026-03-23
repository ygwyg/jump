import {
  type ReactNode,
  type ReactElement,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  cloneElement,
  isValidElement,
  Children,
} from "react";
import type { AnimationDefinition, JumpOptions, JumpControls } from "../types/index.js";
import { jump } from "../core/index.js";
import { mergeRefs } from "./utils.js";

export type PresenceProps = {
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
export function Presence({
  show,
  enter = "fade in",
  exit = "fade out",
  enterOptions,
  exitOptions,
  initial = true,
  children,
}: PresenceProps): ReactElement | null {
  const [mounted, setMounted] = useState(show);
  const ref = useRef<Element | null>(null);
  const exitControlsRef = useRef<JumpControls | null>(null);
  const prevShowRef = useRef(show);
  const isFirstRender = useRef(true);

  // Single effect handles all show/mounted transitions.
  // useLayoutEffect guarantees it runs before paint, avoiding flash.
  useLayoutEffect(() => {
    const prevShow = prevShowRef.current;
    prevShowRef.current = show;

    if (show && !mounted) {
      // show went true but we're not mounted yet — mount
      // Cancel any in-flight exit
      if (exitControlsRef.current) {
        for (const anim of exitControlsRef.current.animations) {
          try { anim.commitStyles(); } catch {}
        }
        exitControlsRef.current.cancel();
        exitControlsRef.current = null;
      }
      setMounted(true);
      return;
    }

    if (show && mounted && ref.current) {
      // We're mounted and show is true — run enter animation
      if (isFirstRender.current) {
        // First render: play enter only if initial=true
        isFirstRender.current = false;
        if (initial) {
          jump(ref.current, enter, { duration: 300, ...enterOptions });
        }
        return;
      }
      // Subsequent renders: play enter when show transitioned false→true
      if (!prevShow) {
        jump(ref.current, enter, { duration: 300, ...enterOptions });
      }
      return;
    }

    if (!show && mounted && ref.current) {
      // show went false — run exit, then unmount
      isFirstRender.current = false;
      const el = ref.current;
      const controls = jump(el, exit, { duration: 200, ...exitOptions });
      exitControlsRef.current = controls;

      controls.finished.then(() => {
        if (exitControlsRef.current === controls) {
          exitControlsRef.current = null;
          setMounted(false);
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, mounted]);

  // Clean up on unmount
  useEffect(() => {
    return () => { exitControlsRef.current?.cancel(); };
  }, []);

  if (!mounted) return null;

  const child = Children.only(children);
  if (!isValidElement(child)) return child as unknown as ReactElement;

  const childRef = (child as unknown as { ref?: React.Ref<Element> }).ref;
  return cloneElement(child as ReactElement<{ ref?: React.Ref<Element> }>, {
    ref: mergeRefs(ref, childRef),
  });
}
