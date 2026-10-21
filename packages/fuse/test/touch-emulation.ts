import { expect } from "vitest";
import { cdp } from "vitest/browser";

type TouchEmulationCdp = {
  send: (
    method: "Emulation.setTouchEmulationEnabled",
    params: { enabled: boolean; maxTouchPoints?: number }
  ) => Promise<void>;
};

/**
 * Chromium's touch emulation, which also switches `(pointer: coarse)` on and off. It is page-wide,
 * so a suite that calls it runs in the `browser-touch` project.
 *
 * @param pointer - The pointer to emulate.
 */
export async function emulatePointer(pointer: "fine" | "coarse"): Promise<void> {
  // SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
  const session = cdp() as TouchEmulationCdp;
  await session.send(
    "Emulation.setTouchEmulationEnabled",
    pointer === "coarse" ? { enabled: true, maxTouchPoints: 1 } : { enabled: false }
  );
  expect(matchMedia("(pointer: coarse)").matches, `${pointer} pointer emulated`).toBe(pointer === "coarse");
}
