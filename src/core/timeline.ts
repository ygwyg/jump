import type {
  JumpTarget,
  AnimationDefinition,
  JumpOptions,
  JumpControls,
  SequenceStep,
  SequenceOptions,
} from "../types/index.js";
import { createControls } from "./engine.js";

// ============================================================================
// Timeline — sequence & parallel
// ============================================================================

/**
 * Plays steps one after another. Returns controls that affect all animations
 * in the sequence, including correctly pausing/cancelling future steps.
 */
export function runSequence(
  steps: SequenceStep[],
  options: SequenceOptions | undefined,
  jumpFn: (
    target: JumpTarget,
    animation: AnimationDefinition,
    options?: JumpOptions,
  ) => JumpControls,
): JumpControls {
  const allAnimations: Animation[] = [];
  const overlap = options?.overlap ?? 0;

  // State for pause/cancel/play of the chain itself
  let cancelled = false;
  let paused = false;
  let resumeFn: (() => void) | null = null;

  // Build promise chain that can be paused and cancelled
  let chain = Promise.resolve();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;

    chain = chain.then(() => {
      // Respect cancellation
      if (cancelled) return;

      // Respect pause: wait until resumed
      if (paused) {
        return new Promise<void>((resolve) => {
          resumeFn = resolve;
        }).then(() => {
          if (cancelled) return;
          return startStep();
        });
      }

      return startStep();

      function startStep(): Promise<void> {
        return new Promise<void>((resolve) => {
          const [target, animation, stepOptions] = step;
          const controls = jumpFn(target, animation, stepOptions);
          allAnimations.push(...controls.animations);

          if (overlap !== 0 && i < steps.length - 1) {
            // Get actual computed duration from the started animation
            const actualDuration =
              (controls.animations[0]?.effect?.getComputedTiming()
                .duration as number) ??
              stepOptions?.duration ??
              300;
            const delay = Math.max(0, actualDuration - overlap);
            // Use a zero-effect animation as a pauseable timer instead of setTimeout
            const timerEl = controls.animations[0]?.effect
              ? (controls.animations[0].effect as KeyframeEffect).target
              : null;

            if (timerEl) {
              const timer = timerEl.animate([], {
                duration: delay,
                fill: "none",
              });
              timer.finished.then(() => resolve()).catch(() => resolve());
              allAnimations.push(timer);
            } else {
              setTimeout(resolve, delay);
            }
          } else {
            controls.finished.then(resolve).catch(resolve);
          }
        });
      }
    });
  }

  const finished = chain.then(() => {
    if (!cancelled) options?.onComplete?.();
  });

  const controls: JumpControls = {
    play() {
      paused = false;
      allAnimations.forEach((a) => a.play());
      if (resumeFn) { resumeFn(); resumeFn = null; }
      return controls;
    },
    pause() {
      paused = true;
      allAnimations.forEach((a) => a.pause());
      return controls;
    },
    reverse() {
      allAnimations.forEach((a) => a.reverse());
      return controls;
    },
    cancel() {
      cancelled = true;
      allAnimations.forEach((a) => a.cancel());
      if (resumeFn) { resumeFn(); resumeFn = null; } // unblock the chain so it exits
      return controls;
    },
    finish() {
      allAnimations.forEach((a) => a.finish());
      return controls;
    },
    seek(progress: number) {
      allAnimations.forEach((a) => {
        const timing = a.effect?.getComputedTiming();
        const total = (timing?.endTime as number | null) ?? (timing?.duration as number) ?? 300;
        a.currentTime = progress * total;
      });
      return controls;
    },
    speed(rate: number) {
      allAnimations.forEach((a) => { a.playbackRate = rate; });
      return controls;
    },
    finished,
    animations: allAnimations,
  };

  return controls;
}

/**
 * Plays all steps simultaneously. All animations share the same controls.
 */
export function runParallel(
  steps: SequenceStep[],
  options: Pick<SequenceOptions, "onComplete"> | undefined,
  jumpFn: (
    target: JumpTarget,
    animation: AnimationDefinition,
    options?: JumpOptions,
  ) => JumpControls,
): JumpControls {
  const allAnimations: Animation[] = [];

  for (const [target, animation, stepOptions] of steps) {
    const ctrl = jumpFn(target, animation, stepOptions);
    allAnimations.push(...ctrl.animations);
  }

  const ctrl = createControls(allAnimations);
  const finished = ctrl.finished.then(() => { options?.onComplete?.(); });
  return { ...ctrl, finished };
}
