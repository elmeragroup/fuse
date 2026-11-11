import { commands } from "vitest/browser";

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Vitest registers custom commands by interface declaration merging; a type alias cannot augment.
  interface BrowserCommands {
    keyDown: (key: string) => Promise<void>;
    keyUp: (key: string) => Promise<void>;
  }
}

/**
 * Presses `key` on the focused element, runs `held` while it stays down, then releases it. `held`
 * gets `repeat`, which sends the key's auto-repeat `keydown` with no `keyup` before it, as a key
 * held on a real keyboard does. The release runs even when `held` throws, so a failed assertion
 * cannot leave the key down for the next test.
 *
 * @param key - The key, by its Playwright name, such as `ArrowRight`.
 * @param held - Runs while the key is down.
 */
export async function whileKeyHeld(
  key: string,
  held: (repeat: () => Promise<void>) => Promise<void>
): Promise<void> {
  await commands.keyDown(key);
  try {
    await held(() => commands.keyDown(key));
  } finally {
    await commands.keyUp(key);
  }
}
