import { cdp } from "vitest/browser";

/** The CDP call that sizes the page in Chromium. */
type MetricsCdp = {
  readonly send: (
    method: "Emulation.setDeviceMetricsOverride",
    params: { width: number; height: number; deviceScaleFactor: number; mobile: boolean }
  ) => Promise<void>;
};

/**
 * Size the page to the test frame through Vitest's CDP session, at a pixel ratio of 1, Playwright's
 * context default. A file that overrides the page's device metrics through that session ends with
 * this, not with `Emulation.clearDeviceMetricsOverride`: clearing can leave the page at the browser
 * window's size, where no later Playwright resize reaches it. The setup in `page-frame-setup.ts`
 * sizes a page the same way when Playwright cannot.
 *
 * @returns Whether the engine has a CDP session, which only Chromium does.
 */
export async function sizePageToFrame(): Promise<boolean> {
  // SAFETY: Vitest types its CDP session as {}; Playwright's session implements send. Engines other than Chromium have none.
  const session = cdp() as MetricsCdp | undefined;
  const frame = window.frameElement;
  if (session === undefined || frame === null) return false;
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: frame.clientWidth,
    height: frame.clientHeight,
    deviceScaleFactor: 1,
    mobile: false,
  });
  return true;
}
