/**
 * The fade a bar that a data update adds runs: CSS's `chart-fade-in`, from opacity 0 to the bar's
 * own opacity. A check that only reads the bar's attributes passes with no animation at all, so
 * these read the running animation itself.
 */
import { expect } from "vitest";

/**
 * Find a bar's fade and check that it runs and starts from opacity 0.
 *
 * @param bar - A bar the latest data update added.
 * @returns The running fade.
 */
export function runningFade(bar: Element): Animation {
  const fades = bar
    .getAnimations()
    .filter((animation) => animation instanceof CSSAnimation && animation.animationName === "chart-fade-in");
  expect(fades).toHaveLength(1);
  const [fade] = fades;
  if (fade === undefined) throw new Error("no fade");
  expect(fade.playState).toBe("running");
  // The fade's first frame draws the bar clear. Seeking to it and back leaves the fade running.
  const time = fade.currentTime;
  fade.currentTime = 0;
  expect(Number(getComputedStyle(bar).opacity)).toBe(0);
  fade.currentTime = time;
  return fade;
}

/**
 * Wait for a bar's fade to end and check that the bar ends fully opaque.
 *
 * @param bar - The bar.
 * @param fade - Its running fade.
 */
export async function finishedFade(bar: Element, fade: Animation): Promise<void> {
  await fade.finished;
  expect(fade.playState).toBe("finished");
  expect(Number(getComputedStyle(bar).opacity)).toBe(1);
}
