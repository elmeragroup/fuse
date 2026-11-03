import { commands } from "vitest/browser";

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Vitest registers custom commands by interface declaration merging; a type alias cannot augment.
  interface BrowserCommands {
    pointerDown: () => Promise<void>;
    pointerUp: () => Promise<void>;
    pointerGlide: (x: number, y: number, steps: number) => Promise<void>;
    pointerWheel: (deltaX: number, deltaY: number) => Promise<void>;
    tap: (x: number, y: number) => Promise<void>;
  }
}

/**
 * Holds the primary mouse button down where the pointer is, runs `read`, then releases.
 * Move the pointer first with `userEvent.hover`. A `read` that moves the pointer again with
 * `userEvent.hover` drags. The release runs even when `read` throws, so a failed assertion
 * cannot leave the button held for the next test.
 *
 * @param read - Reads the pressed state, for example a computed style.
 * @returns What `read` returned.
 */
export async function whilePointerPressed<T>(read: () => T | Promise<T>): Promise<T> {
  await commands.pointerDown();
  try {
    return await read();
  } finally {
    await commands.pointerUp();
  }
}

/**
 * Glides the mouse to the element's centre in a number of small moves, the way a hand travels,
 * so hover intent logic such as a menu's safe triangle sees every step.
 *
 * @param element - Where the pointer ends.
 * @param steps - How many moves the glide takes.
 */
export async function glidePointerTo(element: Element, steps = 12): Promise<void> {
  const box = element.getBoundingClientRect();
  await commands.pointerGlide(box.left + box.width / 2, box.top + box.height / 2, steps);
}

/**
 * Turns the mouse wheel where the pointer is. Glide the pointer over the target first.
 *
 * @param deltaY - The vertical scroll in pixels, positive to scroll down.
 */
export async function turnWheel(deltaY: number): Promise<void> {
  await commands.pointerWheel(0, deltaY);
}
