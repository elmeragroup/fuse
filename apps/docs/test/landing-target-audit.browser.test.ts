import { describe, expect, it } from "vitest";

import { auditTargets, TARGET_FLOOR_PX } from "./landing-page";
import { launchSuiteBrowser } from "./suite-browser";

const browser = launchSuiteBrowser();

/** Integer and fractional offsets, rounding down and up, where Chromium's whole-pixel hit testing differs. */
const OFFSETS = [100, 100.36, 100.5, 100.75] as const;

/** Square corners, and rounded ones, which Chromium hit-tests against the box snapped to whole pixels. */
const RADII = [0, 6] as const;

type Fixture = {
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly offset: number;
  /** Adds a 24px control flush against the target's right edge, drawn over the target. */
  readonly neighbour?: boolean;
};

/** Audits one fixture button placed at `offset` on both axes. */
async function audit({
  width,
  height,
  radius,
  offset,
  neighbour = false,
}: Fixture): Promise<{ readonly targets: number; readonly misses: readonly string[] }> {
  const page = await browser().newPage({ viewport: { width: 400, height: 300 } });
  const button = (label: string, left: number, size: number): string =>
    `<button aria-label="${label}" style="all: unset; position: absolute; left: ${String(left)}px; top: ${String(offset)}px; width: ${String(size)}px; height: ${String(height)}px; border-radius: ${String(radius)}px"></button>`;
  await page.setContent(
    `<body style="margin: 0"><div id="target">${button("Target", offset, width)}</div>${
      neighbour ? button("Neighbour", offset + width, TARGET_FLOOR_PX) : ""
    }</body>`
  );
  const result = await auditTargets(page.locator("#target"));
  await page.close();
  return result;
}

describe("auditTargets", () => {
  describe.each(RADII.flatMap((radius) => OFFSETS.map((offset) => ({ radius, offset }))))(
    "with radius $radius px at offset $offset px",
    ({ radius, offset }) => {
      it("passes a control exactly at the 24px floor", async () => {
        expect(await audit({ width: 24, height: 24, radius, offset })).toEqual({
          targets: 1,
          misses: [],
        });
      });

      it("passes a control at the floor with a neighbour flush against its far edge", async () => {
        expect(await audit({ width: 24, height: 24, radius, offset, neighbour: true })).toEqual({
          targets: 1,
          misses: [],
        });
      });

      it.each([
        { width: 23, height: 24 },
        { width: 24, height: 23 },
      ])("fails a $width×$height control a pixel short of the floor", async (size) => {
        const { targets, misses } = await audit({ ...size, radius, offset });
        expect(targets).toBe(1);
        expect(misses).not.toEqual([]);
      });
    }
  );
});
