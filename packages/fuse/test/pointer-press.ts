import { commands } from "vitest/browser";

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Vitest registers custom commands by interface declaration merging; a type alias cannot augment.
  interface BrowserCommands {
    pointerDown: () => Promise<void>;
    pointerUp: () => Promise<void>;
  }
}

/**
 * Holds the primary mouse button down where the pointer is, runs `read`, then releases.
 * Move the pointer first with `userEvent.hover`. The release runs even when `read`
 * throws, so a failed assertion cannot leave the button held for the next test.
 *
 * @param read - Reads the pressed state, for example a computed style.
 * @returns What `read` returned.
 */
export async function whilePointerPressed<T>(read: () => T): Promise<T> {
  await commands.pointerDown();
  try {
    return read();
  } finally {
    await commands.pointerUp();
  }
}
