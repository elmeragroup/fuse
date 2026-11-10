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

/** A system color keyword as an element resolves it, under its own `forced-color-adjust`. */
export function systemColor(host: HTMLElement, keyword: string): string {
  const probe = document.createElement("span");
  probe.style.border = "1px solid";
  probe.style.borderColor = keyword;
  host.append(probe);
  const color = getComputedStyle(probe).borderTopColor;
  probe.remove();
  return color;
}
