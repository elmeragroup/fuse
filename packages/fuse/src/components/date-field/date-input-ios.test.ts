import { describe, expect, it } from "vitest";

/**
 * Unit under test: `isIOS` in `date-input-ios.ts`. Oracle: the `navigator.platform` and
 * `maxTouchPoints` each Apple device's Safari reports, written out. iPhones, iPads before iPadOS 13
 * and iPods name themselves. iPadOS 13 and later report "MacIntel" with five touch points, and a
 * Mac reports "MacIntel" with none.
 */
import { isIOS } from "./date-input-ios";

describe("isIOS", () => {
  it.each([
    { device: "an iPhone", platform: "iPhone", maxTouchPoints: 5 },
    { device: "an iPad before iPadOS 13", platform: "iPad", maxTouchPoints: 5 },
    { device: "an iPod touch", platform: "iPod", maxTouchPoints: 5 },
    { device: "an iPad on iPadOS 13 or later", platform: "MacIntel", maxTouchPoints: 5 },
  ])("reports $device as iOS", ({ platform, maxTouchPoints }) => {
    expect(isIOS({ platform, maxTouchPoints })).toBe(true);
  });

  it.each([
    { device: "a Mac", platform: "MacIntel", maxTouchPoints: 0 },
    { device: "Windows with touch", platform: "Win32", maxTouchPoints: 10 },
    { device: "Android", platform: "Linux armv81", maxTouchPoints: 5 },
  ])("does not report $device as iOS", ({ platform, maxTouchPoints }) => {
    expect(isIOS({ platform, maxTouchPoints })).toBe(false);
  });
});
