import {
  type ReactNode,
  type ReactElement,
  cloneElement,
  isValidElement,
  Children,
} from "react";
import type { AnimationDefinition, JumpOptions } from "../types/index.js";
import { useJump, type JumpTrigger } from "./useJump.js";
import { mergeRefs } from "./utils.js";

export type AnimateProps = JumpOptions & {
  animation: AnimationDefinition;
  trigger?: JumpTrigger;
  threshold?: number;
  replay?: boolean;
  children: ReactNode;
};

export function Animate({
  animation,
  trigger,
  threshold,
  replay,
  children,
  ...options
}: AnimateProps): ReactElement | null {
  const { ref } = useJump(animation, { trigger, threshold, replay, ...options });
  const child = Children.only(children);
  if (!isValidElement(child)) return child as unknown as ReactElement;

  // Merge refs so the child's existing ref isn't clobbered
  const childRef = (child as unknown as { ref?: React.Ref<Element> }).ref;
  return cloneElement(child as ReactElement<{ ref?: React.Ref<Element> }>, {
    ref: mergeRefs(ref, childRef),
  });
}
