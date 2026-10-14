import { cdp } from "vitest/browser";

type ForcedColorsCdp = {
  send: (
    method: "Emulation.setEmulatedMedia",
    params: { features: { name: "forced-colors"; value: "active" | "none" }[] }
  ) => Promise<void>;
};

export async function emulateForcedColors(value: "active" | "none"): Promise<void> {
  // SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
  const session: ForcedColorsCdp = cdp() as ForcedColorsCdp;
  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "forced-colors", value }],
  });
}
