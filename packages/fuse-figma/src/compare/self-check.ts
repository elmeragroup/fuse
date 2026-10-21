/**
 * An end-to-end check of the comparison itself, run by hand with `figma:compare --self-check`.
 * It renders a matrix of cells in the browser, turns the crops into a fake snapshot shaped like a
 * Figma export, changes two cells, and compares the snapshot with a second render.
 *
 * The fake export cuts each crop to the box plus a margin, as render bounds would be, and places
 * the boxes at fractional canvas positions, so the alignment math has work to do. One cell gets a
 * magenta square painted into its PNG, and another cell's box grows by a pixel. A working harness
 * reports both at the top, the grown box first, and every other cell at no mismatch with equal
 * box sizes.
 */

import { Result } from "effect";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CompareBrowser, DEVICE_SCALE } from "./browser-render.ts";
import { BUTTON_VARIANTS, CELL_STATES, cellKey, ICON_PLACEMENTS, ICON_SIZES, LABEL_SIZES } from "./cells.ts";
import type { Cell, IconSize, LabelSize } from "./cells.ts";
import { locateFuseBuild, readPageAssets } from "./page-assets.ts";
import { parsePreviewTheme } from "./preview-theme.ts";
import { crop, encodePng } from "./raster.ts";
import type { Raster } from "./raster.ts";
import { parseSnapshot } from "./read-snapshot.ts";
import { compareSnapshot, planCells } from "./run-compare.ts";
import type { CompareFailure, CompareOptions, CompareReport } from "./run-compare.ts";
import { SNAPSHOT_FORMAT, SNAPSHOT_VERSION } from "./snapshot.ts";
import type { InstanceSnapshot, KitSnapshot, PreviewSnapshot } from "./snapshot.ts";

/** The fake previews: a light internal theme at dense, and a dark company theme at comfortable. */
const PREVIEWS = [
  {
    key: "preview/self-check/internal-fkas-private-light/dense",
    modes: {
      "Fuse tokens": "Light",
      "Fuse variant": "Internal",
      "Fuse segment": "Private",
      "Fuse brand": "Fjordkraft",
      "Fuse density": "Dense",
    },
  },
  {
    key: "preview/self-check/internal-elma-company-dark/comfortable",
    modes: {
      "Fuse tokens": "Dark",
      "Fuse variant": "Internal",
      "Fuse segment": "Company",
      "Fuse brand": "Elmera",
      "Fuse density": "Comfortable",
    },
  },
] as const;

/** How far the fake render bounds reach past the box, in canvas pixels. */
const RENDER_MARGIN = 3;

/** The sizes every state and icon is checked at, the recipe's defaults. */
const BASE_LABEL: LabelSize = "default";
const BASE_ICON: IconSize = "icon";

/** The cell whose PNG gets a magenta square, in the first preview. */
const PAINTED: Cell = {
  component: "button",
  variant: "outline",
  size: BASE_LABEL,
  state: "hover",
  icon: "start",
};

/** The cell whose box grows by a pixel, in the second preview. */
const GROWN: Cell = { component: "icon-button", variant: "ghost", size: BASE_ICON, state: "focus" };

/** The cells each fake preview holds: every state and icon at the base sizes, every size at rest. */
function selfCheckCells(): Cell[] {
  const label: Cell[] = BUTTON_VARIANTS.flatMap((variant) =>
    CELL_STATES.flatMap((state) =>
      ICON_PLACEMENTS.map((icon): Cell => ({ component: "button", variant, size: BASE_LABEL, state, icon }))
    )
  );
  const labelSizes: Cell[] = LABEL_SIZES.filter((size) => size !== BASE_LABEL).flatMap((size) =>
    BUTTON_VARIANTS.map((variant): Cell => ({
      component: "button",
      variant,
      size,
      state: "rest",
      icon: "none",
    }))
  );
  const icon: Cell[] = BUTTON_VARIANTS.flatMap((variant) =>
    CELL_STATES.map((state): Cell => ({ component: "icon-button", variant, size: BASE_ICON, state }))
  );
  const iconSizes: Cell[] = ICON_SIZES.filter((size) => size !== BASE_ICON).flatMap((size) =>
    BUTTON_VARIANTS.map((variant): Cell => ({ component: "icon-button", variant, size, state: "rest" }))
  );
  return [...label, ...labelSizes, ...icon, ...iconSizes];
}

function paintSquare(raster: Raster): Raster {
  const data = Uint8Array.from(raster.data);
  const side = 12;
  const left = Math.floor((raster.width - side) / 2);
  const top = Math.floor((raster.height - side) / 2);
  for (let y = top; y < top + side; y += 1) {
    for (let x = left; x < left + side; x += 1) {
      data.set([255, 0, 255, 255], (y * raster.width + x) * 4);
    }
  }
  return { ...raster, data };
}

/** What the self-check found. */
export type SelfCheckResult = {
  readonly passed: boolean;
  /** One line per finding, for the console. */
  readonly lines: readonly string[];
  readonly report: CompareReport;
};

/** The two cells the self-check changes, by preview and variant. */
type Perturbed = { readonly preview: string; readonly variant: string };

/**
 * Run the self-check.
 *
 * @param options - Where to write the fake snapshot and the report, and the diff settings.
 * @returns Whether the harness found exactly the changed cells, or why it could not run.
 */
export async function runSelfCheck(
  options: CompareOptions
): Promise<Result.Result<SelfCheckResult, CompareFailure>> {
  const build = locateFuseBuild();
  if (Result.isFailure(build)) {
    return Result.fail(build.failure);
  }
  const { renderCellHtml } = await import("./fuse-markup.ts");
  const launched = await CompareBrowser.launch(readPageAssets(build.success));
  if (Result.isFailure(launched)) {
    return Result.fail(launched.failure);
  }
  const cells = selfCheckCells();
  const painted: Perturbed = { preview: PREVIEWS[0].key, variant: cellKey(PAINTED) };
  const grown: Perturbed = { preview: PREVIEWS[1].key, variant: cellKey(GROWN) };
  const previews: PreviewSnapshot[] = [];
  try {
    for (const preview of PREVIEWS) {
      const modes = Object.entries(preview.modes).map(([collection, mode]) => ({ collection, mode }));
      const theme = parsePreviewTheme(modes);
      if (Result.isFailure(theme)) {
        throw theme.failure;
      }
      const placeholders: InstanceSnapshot[] = cells.map((cell) => ({
        key: `${preview.key}/${cellKey(cell)}`,
        variant: cellKey(cell),
        box: { x: 0, y: 0, width: 0, height: 0 },
        image: null,
      }));
      const { planned } = planCells(placeholders, renderCellHtml);
      const rendered = await launched.success.renderPreview(
        theme.success,
        planned.map((cell) => cell.request),
        options.layout
      );
      if (Result.isFailure(rendered)) {
        return Result.fail(rendered.failure);
      }
      const instances = planned.map(({ instance, request }, index): InstanceSnapshot => {
        const cell = rendered.success.cells.get(request.id);
        if (cell === undefined) {
          throw new Error(`the page returned no picture for ${request.id}`);
        }
        const box = {
          x: 100.5 + (index % 6) * 300,
          y: 40.25 + Math.floor(index / 6) * 120,
          width:
            cell.box.width + (preview.key === grown.preview && instance.variant === grown.variant ? 1 : 0),
          height: cell.box.height,
        };
        const renderBounds = {
          x: box.x - RENDER_MARGIN,
          y: box.y - RENDER_MARGIN,
          width: cell.box.width + 2 * RENDER_MARGIN,
          height: cell.box.height + 2 * RENDER_MARGIN,
        };
        const inset = (options.layout.padding - RENDER_MARGIN) * DEVICE_SCALE;
        const cut = crop(
          cell.raster,
          { x: inset, y: inset },
          {
            width: Math.round(renderBounds.width * DEVICE_SCALE),
            height: Math.round(renderBounds.height * DEVICE_SCALE),
          }
        );
        const png =
          preview.key === painted.preview && instance.variant === painted.variant ? paintSquare(cut) : cut;
        return {
          ...instance,
          box,
          image: { renderBounds, png: Buffer.from(encodePng(png)).toString("base64") },
        };
      });
      previews.push({ key: preview.key, name: preview.key, modes, instances });
    }
  } finally {
    await launched.success.close();
  }
  const snapshot: KitSnapshot = {
    format: SNAPSHOT_FORMAT,
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    file: "figma:compare self-check",
    scale: DEVICE_SCALE,
    previews,
  };
  mkdirSync(options.outDir, { recursive: true });
  const text = JSON.stringify(snapshot);
  writeFileSync(join(options.outDir, "self-check-snapshot.json"), text);
  const reread = parseSnapshot(text);
  if (Result.isFailure(reread)) {
    throw reread.failure;
  }
  const compared = await compareSnapshot(reread.success, options);
  return Result.map(compared, (report) => judgeSelfCheck(report, [grown, painted]));
}

function judgeSelfCheck(report: CompareReport, expectedTop: readonly Perturbed[]): SelfCheckResult {
  const lines: string[] = [];
  const top = report.rows.slice(0, expectedTop.length);
  const topMatches = expectedTop.every(
    (expected, index) => top[index]?.preview === expected.preview && top[index].variant === expected.variant
  );
  for (const [index, row] of top.entries()) {
    lines.push(
      `#${String(index + 1)} ${row.preview} ${row.variant}: tolerant ${row.verdict.tolerantPercent.toFixed(3)}%, raw ${row.verdict.rawPercent.toFixed(3)}%, Δ ${String(row.verdict.widthDelta)}×${String(row.verdict.heightDelta)}, flags [${row.verdict.flags.join(", ")}]`
    );
  }
  const rest = report.rows.slice(expectedTop.length);
  const worstTolerant = Math.max(0, ...rest.map((row) => row.verdict.tolerantPercent));
  const worstRaw = Math.max(0, ...rest.map((row) => row.verdict.rawPercent));
  const flagged = rest.filter((row) => row.verdict.flags.length > 0);
  lines.push(
    `${String(rest.length)} other cells: worst tolerant ${worstTolerant.toFixed(3)}%, worst raw ${worstRaw.toFixed(3)}%, ${String(flagged.length)} flagged, ${String(report.skipped.length)} skipped`
  );
  for (const row of flagged.slice(0, 10)) {
    lines.push(`  flagged: ${row.preview} ${row.variant} [${row.verdict.flags.join(", ")}]`);
  }
  const passed =
    topMatches &&
    worstTolerant === 0 &&
    worstRaw === 0 &&
    flagged.length === 0 &&
    report.skipped.length === 0;
  lines.push(
    passed
      ? "Self-check passed: the two changed cells lead the report and every other cell matches exactly."
      : "Self-check failed."
  );
  return { passed, lines, report };
}
