import { commands } from "vitest/browser";

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Vitest registers custom commands by interface declaration merging; a type alias cannot augment.
  interface BrowserCommands {
    pointerDown: () => Promise<void>;
    pointerUp: () => Promise<void>;
    pointerWheel: (deltaY: number) => Promise<void>;
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
 * Turns the mouse wheel by `deltaY` pixels where the pointer is. `userEvent.wheel` moves the
 * pointer to its target's center first; this leaves it where `userEvent.hover` put it, so the
 * wheel lands on whatever now sits under it.
 *
 * @param deltaY - How far to scroll, positive for down.
 */
export async function wheelAtPointer(deltaY: number): Promise<void> {
  await commands.pointerWheel(deltaY);
}
