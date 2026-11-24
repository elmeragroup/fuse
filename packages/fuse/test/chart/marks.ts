/**
 * The DOM readers the chart browser suites share for marks and the tooltip popup. Bars and the
 * popup are aria-hidden plot output, so their slots are the only locators.
 */
import { userEvent } from "vitest/browser";

import { recordFrames } from "../animation-frames";

/**
 * The bars a chart draws, in page order, of one series or of all.
 *
 * @param host - The rendered chart's host.
 * @param series - The series ordinal, or every series when omitted.
 * @returns The bar elements.
 */
export function bars(host: HTMLElement, series?: number): HTMLElement[] {
  const scope =
    series === undefined ? "" : `[data-slot="chart-bar-series"][data-series="${String(series)}"] `;
  // Bars are aria-hidden plot output, so their slots are the only locator.
  return [...host.querySelectorAll<HTMLElement>(`${scope}[data-slot="chart-bar"]`)];
}

/**
 * The path a chart's line draws its solid part with, which the loop writes in every frame of a tween.
 *
 * @param host - The rendered chart's host.
 * @returns The path's `d`, or an empty string with no line.
 */
export function linePath(host: HTMLElement): string {
  // The line is aria-hidden plot output, so its slot locates it.
  return host.querySelector('[data-slot="chart-line"][data-part="solid"]')?.getAttribute("d") ?? "";
}

/**
 * The plot surface's client box.
 *
 * @param host - The rendered chart's host.
 * @returns The box, or an empty box with no plot.
 */
export function surfaceBox(host: HTMLElement): DOMRect {
  return host.querySelector('[role="listbox"]')?.getBoundingClientRect() ?? new DOMRect();
}

/**
 * The open tooltip popup. It portals out of the host, and a closed popup stays mounted, hidden.
 *
 * @returns The popup, or null while none is open.
 */
export function popup(): HTMLElement | null {
  // The popup is aria-hidden and portals out of the host, so its slot is the locator.
  return document.querySelector<HTMLElement>('[data-slot="chart-tooltip"][data-open]');
}

/**
 * Whether a popup paints: it has a layout box, its CSS visibility is visible, and neither it nor an
 * ancestor has opacity 0. It does not check that the popup lies inside the viewport. A closed popup
 * stays mounted once it has opened, so closing must take it out of view, not out of the document.
 *
 * @param element - The popup.
 * @returns Whether it paints.
 */
export function visible(element: HTMLElement): boolean {
  return element.checkVisibility({ opacityProperty: true, visibilityProperty: true });
}

/**
 * The open popup's slot label.
 *
 * @returns The label's text, or null while no popup is open.
 */
export function label(): string | null {
  // The popup is aria-hidden, so its label's slot is the only locator.
  return popup()?.querySelector('[data-slot="chart-tooltip-label"]')?.textContent ?? null;
}

/**
 * The element at a point in client pixels and the point inside it, as `userEvent.hover` and
 * `userEvent.click` take them. The options skip Playwright's wait for that element to be the hit
 * target, because a popup that follows the slot may move between the hit check and the event.
 *
 * @param x - The client x.
 * @param y - The client y.
 * @returns The element and the event options.
 */
export function pointerTarget(
  x: number,
  y: number
): [Element, { readonly position: { readonly x: number; readonly y: number }; readonly force: true }] {
  const target = document.elementFromPoint(x, y);
  if (!(target instanceof Element)) throw new Error(`nothing at ${String(x)}, ${String(y)}`);
  const box = target.getBoundingClientRect();
  return [target, { position: { x: x - box.left, y: y - box.top }, force: true }];
}

/**
 * Move the pointer to a point in client pixels, over the element at that point, as a hand does.
 *
 * @param x - The client x.
 * @param y - The client y.
 */
export async function pointerAt(x: number, y: number): Promise<void> {
  await userEvent.hover(...pointerTarget(x, y));
}

/**
 * Whether the tooltip popup shows: open, not fading out or closed. It portals out of the host, and
 * once it has opened it stays mounted, hidden while closed.
 *
 * @returns Whether it shows.
 */
export function popupOpen(): boolean {
  // The popup portals out of the host and carries its own slot.
  const popup = document.querySelector('[data-slot="chart-tooltip"]');
  return popup !== null && popup.hasAttribute("data-open") && !popup.hasAttribute("data-ending-style");
}

/**
 * The names of the parts that run an animation or a transition now, on the part or inside it.
 *
 * @param parts - Each part by name, or null while it is not mounted.
 * @returns The names of the parts that animate, in the order given.
 */
export function animating(parts: { readonly [name: string]: Element | null | undefined }): string[] {
  return Object.entries(parts)
    .filter(([, part]) =>
      part?.getAnimations({ subtree: true }).some((animation) => animation.playState === "running")
    )
    .map(([name]) => name);
}

/**
 * The names of the parts that animated on any frame from the next one until `frames` frames after
 * `done()` first holds, while `action` ran. The frames run in the page whatever the action's round
 * trip to the runner costs, so a short glide that ends before the action returns is still seen.
 *
 * @param read - The names of the parts animating on a frame, such as `animating`'s.
 * @param action - What the test does, such as a key press.
 * @param done - Whether the action has landed, such as the popup showing its next slot.
 * @param frames - How many frames to keep recording after `done()` holds.
 * @returns Each name seen on any frame, sorted.
 */
export async function animatedWhile(
  read: () => readonly string[],
  action: () => Promise<void>,
  done: () => boolean,
  frames = 20
): Promise<string[]> {
  let left = frames;
  const seen = recordFrames(read, () => done() && (left -= 1) <= 0);
  await action();
  return [...new Set((await seen).flat())].sort();
}

/**
 * Whether a popup runs its own `opacity` transition now, the fade Fuse's overlay opens and closes
 * with. Its content's transitions and its `scale` and `translate` don't count.
 *
 * @param popup - The popup, or null while none is mounted.
 * @returns `["fade"]` while the fade runs, or no names.
 */
export function popupFade(popup: Element | null): string[] {
  const fades = popup
    ?.getAnimations()
    .some(
      (animation) =>
        animation instanceof CSSTransition &&
        animation.transitionProperty === "opacity" &&
        animation.playState === "running"
    );
  return fades === true ? ["fade"] : [];
}

/** What a key's open of a popup shows over its frames. */
export type KeyOpen = {
  /** The animations and transitions the popup itself ran on any frame, of any kind, by name. */
  readonly motion: readonly string[];
  /** The popup's computed opacity on the first frame it shows, or NaN if it never showed. */
  readonly firstOpacity: number;
};

/**
 * Records the popup a key opens, on every frame from the next one until 20 frames after it is open:
 * the animations it runs itself, CSS transitions, CSS animations and script animations alike, and
 * its opacity on its first visible frame. A popup that a placement hold keeps at opacity 0 counts as
 * visible from the frame the hold releases it.
 *
 * @param action - The key press that opens the popup.
 * @returns The motion seen and the first visible frame's opacity.
 */
export async function keyOpen(action: () => Promise<void>): Promise<KeyOpen> {
  let left = 20;
  const frames = recordFrames(
    () => {
      const open = popup();
      return {
        motion:
          open
            ?.getAnimations()
            .filter((animation) => animation.playState === "running")
            .map((animation) =>
              animation instanceof CSSTransition
                ? `transition ${animation.transitionProperty}`
                : animation instanceof CSSAnimation
                  ? `animation ${animation.animationName}`
                  : "script animation"
            ) ?? [],
        opacity: open != null && visible(open) ? Number(getComputedStyle(open).opacity) : null,
      };
    },
    () => popupOpen() && (left -= 1) <= 0
  );
  await action();
  const recorded = await frames;
  return {
    motion: [...new Set(recorded.flatMap((frame) => frame.motion))].sort(),
    firstOpacity: recorded.find((frame) => frame.opacity !== null)?.opacity ?? Number.NaN,
  };
}
