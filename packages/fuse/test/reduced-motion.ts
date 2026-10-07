import { cdp } from "vitest/browser";

type ReducedMotionCdp = {
  send: (
    method: "Emulation.setEmulatedMedia",
    params: { features: { name: "prefers-reduced-motion"; value: "reduce" | "no-preference" }[] }
  ) => Promise<void>;
};

export async function emulateReducedMotion(value: "reduce" | "no-preference"): Promise<void> {
  // SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
  const session: ReducedMotionCdp = cdp() as ReducedMotionCdp;
  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value }],
  });
}
