// ============================================================================
// jump — AI-First Animation Library
// ============================================================================

export { jump } from "./core/index.js";
export { createSpring, springs, supportsLinear } from "./core/spring.js";
export type { SpringParams, SpringResult, SpringPreset } from "./core/spring.js";
export { cancelAndCommit, prefersReducedMotion } from "./core/engine.js";
export { snapshot, flip, watchLayout, recordShared, animateShared, correctChildScale, getSharedSnapshot, clearShared } from "./core/layout.js";
export { stagger } from "./core/stagger.js";
export type { StaggerOptions, StaggerFn } from "./core/stagger.js";
export { drawIn, drawOut, drawSVG, prepareSVG } from "./core/svg.js";
export { animateValues } from "./core/animate.js";
export { createScrollProgress } from "./core/scrollProgress.js";

export type {
  // Layout
  LayoutOptions,
  LayoutSnapshot,
  LayoutStyle,
  // Animation
  AnimationIntent,
  AnimationDefinition,
  AnimatableProperties,
  JumpKeyframe,
  // Options
  JumpOptions,
  Easing,
  EasingPreset,
  FillMode,
  AnimationDirection,
  // Targets & controls
  JumpTarget,
  JumpControls,
  JumpFunction,
  // Sequence
  SequenceStep,
  SequenceOptions,
  // Intent categories
  FadeIntent,
  SlideIntent,
  EnterIntent,
  ExitIntent,
  ScaleIntent,
  FlipIntent,
  EmphasisIntent,
  // Transforms
  TransformProperties,
  CSSAnimationProperties,
} from "./types/index.js";
