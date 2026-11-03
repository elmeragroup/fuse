import { onTestFinished } from "vitest";
import { cdp, server } from "vitest/browser";

/** The device metrics Chromium emulates through its CDP session. */
type DeviceMetrics = {
  readonly width: number;
  readonly height: number;
  readonly deviceScaleFactor: number;
  readonly mobile: boolean;
};

/** The CDP call that sizes the page in Chromium. */
type MetricsCdp = {
  readonly send: (method: "Emulation.setDeviceMetricsOverride", params: DeviceMetrics) => Promise<void>;
};

/** Override the page's device metrics through Vitest's CDP session, which only Chromium serves. */
async function setMetrics(metrics: DeviceMetrics): Promise<void> {
  // SAFETY: Vitest types its CDP session as {}; Playwright's session implements send.
  const session = cdp() as MetricsCdp;
  await session.send("Emulation.setDeviceMetricsOverride", metrics);
}

/**
 * Size the page to the test frame through Vitest's CDP session, at a pixel ratio of 1, Playwright's
 * context default. A test that overrides the page's device metrics ends with this, through
 * `emulatePixelRatio`, not with `Emulation.clearDeviceMetricsOverride`: clearing can leave the page
 * at the browser window's size, where no later Playwright resize reaches it. The setup in
 * `page-frame-setup.ts` sizes a page the same way when Playwright cannot. Outside Chromium it does
 * nothing.
 */
export async function sizePageToFrame(): Promise<void> {
  const frame = window.frameElement;
  // Vitest hands out a session in every engine, and outside Chromium its calls reject.
  if (server.browser !== "chromium" || frame === null) return;
  await setMetrics({
    width: frame.clientWidth,
    height: frame.clientHeight,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

/** Whether the running test already sizes the page back to its frame once it finishes. */
let restoring = false;

/**
 * Emulate a device pixel ratio in Chromium for the rest of the running test, which then sizes the
 * page back to its frame at a ratio of 1 as it finishes. Call it inside a test.
 *
 * @param dpr - The device pixel ratio.
 * @param size - The page's size in CSS pixels while it emulates the ratio.
 */
export async function emulatePixelRatio(
  dpr: number,
  size: { readonly width: number; readonly height: number } = { width: 1024, height: 768 }
): Promise<void> {
  if (!restoring) {
    restoring = true;
    onTestFinished(async () => {
      restoring = false;
      await sizePageToFrame();
    });
  }
  await setMetrics({ ...size, deviceScaleFactor: dpr, mobile: false });
}
