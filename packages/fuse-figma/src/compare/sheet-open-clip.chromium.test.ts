/**
 * Unit under test: the compare page's crop of the open Sheet, its `sheetOpen` renderer planned and
 * rendered as `figma:compare` does, through `CompareBrowser.renderPreview` in Chromium.
 * Oracle: the built Figma frame of `Sheet (open)`, as large as the 640×448 viewport the set
 * declares, which clips its content and so draws nothing past that viewport, as the browser window
 * clips the panel's shadow. The crop keeps `PAGE_LAYOUT.padding` around the measured box, so the
 * CSS pixel row just below the viewport and the column just right of it must be transparent, while
 * the scrim paints the viewport's own last row and column.
 * The pixels are read in a fixed 2400px page at a fixed device scale, so they do not move with load
 * or timing.
 */
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { variantKey } from "../components/component-spec.ts";
import { KIT } from "../components/kit-registry.ts";
import { SHEET_VIEWPORT } from "../components/sheet-text.ts";
import { CompareBrowser, DEVICE_SCALE } from "./browser-render.ts";
import { loadRenderers } from "./cell-renderers.ts";
import { locateFuseBuild, readPageAssets } from "./page-assets.ts";
import { PAGE_LAYOUT } from "./preview-page.ts";
import type { Raster } from "./raster.ts";
import { planCells, renderables } from "./run-compare.ts";

const THEME = {
  scheme: "light",
  identity: "neutral",
  brand: "fkas",
  segment: "private",
  density: "dense",
} as const;

/** Render the open Sheet's one cell as `figma:compare` plans and renders it. */
function renderOpenSheet() {
  const manifest = KIT.find((entry) => entry.manifest.key === "sheet-open");
  const cell = manifest?.previewCells[0];
  if (manifest === undefined || cell === undefined) {
    throw new Error("the kit places no sheet-open cell");
  }
  const variant = variantKey(manifest.manifest, cell);
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const renderers = yield* loadRenderers(new Set(["sheet-open"]));
        const assets = yield* readPageAssets(yield* locateFuseBuild(), renderers);
        const instance = { key: variant, variant, box: { x: 0, y: 0, width: 0, height: 0 }, image: null };
        const { planned } = planCells([instance], renderables(renderers), new Set(), PAGE_LAYOUT);
        const browser = yield* CompareBrowser.launch(assets);
        const rendered = yield* browser.renderPreview(
          THEME,
          planned.map((entry) => entry.request),
          PAGE_LAYOUT
        );
        return [...rendered.cells.values()];
      })
    ).pipe(Effect.provide(NodeServices.layer))
  );
}

/** The highest alpha among the device pixels of a crop's CSS pixel row or column `at`. */
function maxAlpha({ width, height, data }: Raster, axis: "row" | "column", at: number): number {
  const first = at * DEVICE_SCALE;
  let max = 0;
  for (let along = 0; along < (axis === "row" ? width : height); along++) {
    for (let device = first; device < first + DEVICE_SCALE; device++) {
      const [x, y] = axis === "row" ? [along, device] : [device, along];
      max = Math.max(max, data[(y * width + x) * 4 + 3] ?? 0);
    }
  }
  return max;
}

describe("the open Sheet's compare crop", () => {
  it("shows nothing past the viewport, as the built frame clips the panel's shadow", async () => {
    const [rendered, ...rest] = await renderOpenSheet();
    expect([rendered?.box, rest.length]).toEqual([SHEET_VIEWPORT, 0]);
    if (rendered === undefined) {
      return;
    }
    const { padding } = PAGE_LAYOUT;
    const bottom = padding + SHEET_VIEWPORT.height;
    const right = padding + SHEET_VIEWPORT.width;
    // The scrim paints the viewport's last row and column, so the crop reads them where they are.
    expect({
      lastRow: maxAlpha(rendered.raster, "row", bottom - 1) > 0,
      lastColumn: maxAlpha(rendered.raster, "column", right - 1) > 0,
      below: maxAlpha(rendered.raster, "row", bottom),
      right: maxAlpha(rendered.raster, "column", right),
    }).toEqual({ lastRow: true, lastColumn: true, below: 0, right: 0 });
  }, 120_000);
});
