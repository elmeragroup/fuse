/**
 * An end-to-end check of the comparison itself, run by hand with `figma:compare --self-check`.
 * It renders every cell the kit's preview frames place in the browser, turns the crops into a
 * fake snapshot shaped like a Figma export, changes two cells, and compares the snapshot with a
 * second render.
 *
 * The fake export cuts each crop to the box plus a margin, as render bounds would be, and places
 * the boxes at fractional canvas positions, so the alignment math has work to do. The kit's
 * first hover cell gets a magenta square painted into its PNG, and its first focus cell grows by
 * a pixel. A working harness reports both at the top, the grown box first, and every other cell
 * at no mismatch with equal box sizes.
 */

import { Result } from "effect";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { variantKey } from "../components/component-spec.ts";
import { KIT } from "../components/kit-registry.ts";
import { CompareBrowser, DEVICE_SCALE } from "./browser-render.ts";
import { loadRenderers } from "./cell-renderers.ts";
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

/**
 * The variant key of the first cell the kit's preview frames place in a state, in registry
 * order. A set with no `state` axis has no such cell and is passed over.
 *
 * @throws When no set has such a cell, which leaves the self-check nothing to change.
 */
function firstInState(state: string): string {
  for (const { definition, previewCells } of KIT) {
    const cell = previewCells.find((candidate) => candidate.state === state);
    if (cell !== undefined) {
      return variantKey(definition, cell);
    }
  }
  throw new Error(`the kit's preview frames place no ${state} cell for the self-check to change`);
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
 * @throws When the kit's preview frames place a cell the comparison cannot render.
 */
export async function runSelfCheck(
  options: CompareOptions
): Promise<Result.Result<SelfCheckResult, CompareFailure>> {
  const build = locateFuseBuild();
  if (Result.isFailure(build)) {
    return Result.fail(build.failure);
  }
  const variants = KIT.flatMap(({ definition, previewCells }) =>
    previewCells.map((cell) => variantKey(definition, cell))
  );
  const painted: Perturbed = { preview: PREVIEWS[0].key, variant: firstInState("hover") };
  const grown: Perturbed = { preview: PREVIEWS[1].key, variant: firstInState("focus") };
  const renderers = await loadRenderers();
  const launched = await CompareBrowser.launch(await readPageAssets(build.success, renderers));
  if (Result.isFailure(launched)) {
    return Result.fail(launched.failure);
  }
  const previews: PreviewSnapshot[] = [];
  try {
    for (const preview of PREVIEWS) {
      const modes = Object.entries(preview.modes).map(([collection, mode]) => ({ collection, mode }));
      const theme = parsePreviewTheme(modes);
      if (Result.isFailure(theme)) {
        throw theme.failure;
      }
      const placeholders: InstanceSnapshot[] = variants.map((variant) => ({
        key: `${preview.key}/${variant}`,
        variant,
        box: { x: 0, y: 0, width: 0, height: 0 },
        image: null,
      }));
      const { planned, unsupported } = planCells(placeholders, renderers);
      if (unsupported.length > 0) {
        throw new Error(
          `the comparison cannot render these cells of the kit: ${unsupported.map((entry) => entry.reason).join("; ")}`
        );
      }
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
        // The PNG takes every device pixel the render bounds touch. Select trigger's 3px invalid ring
        // ends 0.09 device pixels into a column past a 110.546875px box, which a rounded width drops.
        const cut = crop(
          cell.raster,
          { x: inset, y: inset },
          {
            width: Math.ceil(renderBounds.width * DEVICE_SCALE),
            height: Math.ceil(renderBounds.height * DEVICE_SCALE),
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
