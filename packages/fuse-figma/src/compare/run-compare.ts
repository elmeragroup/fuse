/**
 * Compare a snapshot with the real Fuse components, cell by cell. For each preview the run
 * renders every instance's cell on one browser page in the preview's theme and density, lays the
 * Figma PNG and the browser crop over the theme's background on one canvas with their boxes
 * aligned, and diffs them. It writes three pictures per cell, `report.json` and `report.html`.
 */

import { Result } from "effect";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildComponentSets } from "../components/build-kit.ts";
import type { Cell } from "../components/component-spec.ts";
import { KIT } from "../components/kit-registry.ts";
import { browserFootprint, coversRenderBounds, figmaFootprint, sharedCanvas } from "./align.ts";
import { CompareBrowser, DEVICE_SCALE } from "./browser-render.ts";
import type { BrowserUnavailable, CellRequest, FontNotLoaded, RenderedCell } from "./browser-render.ts";
import { loadRenderers, renderCellHtml } from "./cell-renderers.ts";
import type { CellRenderer } from "./cell-renderers.ts";
import { forcedPseudoClasses, parseCell, restingTwin } from "./cells.ts";
import { locateFuseBuild, readPageAssets } from "./page-assets.ts";
import type { FuseBuildMissing } from "./page-assets.ts";
import type { PageLayout } from "./preview-page.ts";
import { parsePreviewTheme } from "./preview-theme.ts";
import type { PreviewTheme } from "./preview-theme.ts";
import { compose, diffRasters, encodePng, parsePng } from "./raster.ts";
import type { Raster, Rgb } from "./raster.ts";
import { renderReportHtml } from "./report-html.ts";
import type { CanvasRect, InstanceSnapshot, KitSnapshot, PreviewSnapshot } from "./snapshot.ts";
import { unchangedByDesign } from "./unchanged-by-design.ts";
import { judgeCell, worstFirst } from "./verdict.ts";
import type { BoxSize, CellFlag, CellVerdict } from "./verdict.ts";

/** How to run a comparison. */
export type CompareOptions = {
  /** The directory the report and its pictures go to. Its `cells/` directory is replaced. */
  readonly outDir: string;
  /** pixelmatch's threshold, 0 to 1. */
  readonly threshold: number;
  readonly layout: PageLayout;
};

/**
 * A cell's pictures, as paths relative to the report: Figma's, the browser's and the diff, each
 * on the shared canvas over the theme's background. Figma's and the diff are null when Figma drew
 * nothing.
 */
export type CellImages = {
  readonly figma: string | null;
  readonly browser: string;
  readonly diff: string | null;
  /** The shared canvas's size in device pixels, which every picture of the cell has. */
  readonly width: number;
  readonly height: number;
};

/** One compared cell. */
export type ReportRow = {
  readonly preview: string;
  readonly previewName: string;
  /** The variant key. */
  readonly variant: string;
  /** The variant's properties, for the report's filters. */
  readonly axes: Readonly<Record<string, string>>;
  readonly figmaBox: BoxSize;
  readonly browserBox: BoxSize;
  /** The mismatched pixel counts, or null when Figma drew nothing. */
  readonly pixels: { readonly raw: number; readonly tolerant: number } | null;
  readonly verdict: CellVerdict;
  /**
   * True when the kit draws the cell's forced state exactly as at rest and the browser showed no
   * change either, such as a pressed Toggle on hover. Such a cell gets no `state-missing` flag.
   */
  readonly unchangedByDesign: boolean;
  readonly images: CellImages;
};

/** An instance the run could not compare, and why. */
export type SkippedInstance = { readonly preview: string; readonly variant: string; readonly reason: string };

/** A preview as the run rendered it. */
export type ReportPreview = {
  readonly key: string;
  readonly name: string;
  readonly theme: PreviewTheme | null;
  /** The theme's `background` as `rgb(r g b)`, or null when the preview was skipped. */
  readonly background: string | null;
  /**
   * The fonts the cells' text used, after the page checked that they loaded: empty when the
   * preview shows no text, and null when the preview was skipped.
   */
  readonly font: string | null;
};

/** Everything a run found. */
export type CompareReport = {
  readonly snapshot: { readonly file: string; readonly exportedAt: string; readonly scale: number };
  readonly generatedAt: string;
  readonly threshold: number;
  /** True when Fuse's sources changed after its build, so the browser side may be out of date. */
  readonly fuseBuildStale: boolean;
  readonly fontPackage: string;
  readonly previews: readonly ReportPreview[];
  /** Every compared cell, worst first. */
  readonly rows: readonly ReportRow[];
  readonly skipped: readonly SkippedInstance[];
};

/** The snapshot was exported at a scale the browser does not render at. */
class UnsupportedScale extends Error {
  readonly _tag = "UnsupportedScale" as const;
}

/** Why a run stopped before it compared anything. */
export type CompareFailure = FuseBuildMissing | BrowserUnavailable | FontNotLoaded | UnsupportedScale;

/** The renderers the run loaded from the Fuse build, by the key of the definition each renders. */
type Renderers = ReadonlyMap<string, CellRenderer>;

/** A snapshot instance, the cell its variant key names, and the page cell that renders it. */
export type PlannedCell = {
  readonly instance: InstanceSnapshot;
  readonly cell: Cell;
  readonly request: CellRequest;
};

/** A preview's page: the cells it renders, and the instances it cannot. */
export type CellPlan = {
  readonly planned: readonly PlannedCell[];
  readonly unsupported: readonly { readonly variant: string; readonly reason: string }[];
};

/**
 * Plan a preview's page: one request per instance the harness can render.
 *
 * @param instances - The preview's instances.
 * @param renderers - The renderers, by definition key.
 * @returns The planned cells, and the instances whose variant the harness cannot render.
 */
export function planCells(instances: readonly InstanceSnapshot[], renderers: Renderers): CellPlan {
  const renderable = KIT.flatMap(({ definition }) => {
    const renderer = renderers.get(definition.key);
    return renderer === undefined ? [] : [{ ...definition, renderer }];
  });
  const planned: PlannedCell[] = [];
  const unsupported: { variant: string; reason: string }[] = [];
  instances.forEach((instance, index) => {
    const parsed = parseCell(instance.variant, renderable);
    if (Result.isFailure(parsed)) {
      unsupported.push({ variant: instance.variant, reason: parsed.failure.message });
      return;
    }
    const { definition, cell } = parsed.success;
    const forced = forcedPseudoClasses(cell);
    planned.push({
      instance,
      cell,
      request: {
        id: `c${String(index)}`,
        html: renderCellHtml(definition.renderer, cell),
        measured: `[data-slot="${definition.slot}"]`,
        forced,
        restingHtml: forced.length === 0 ? undefined : renderCellHtml(definition.renderer, restingTwin(cell)),
      },
    });
  });
  return { planned, unsupported };
}

/**
 * The flags of a cell's state. `unchangedByDesign` is true when the browser showed no change for
 * a cell the kit draws unchanged too, which gets no `state-missing` flag.
 */
function stateFlags(rendered: RenderedCell, unchangedByDesign: boolean): CellFlag[] {
  switch (rendered.state) {
    case "interaction":
      return ["state-by-interaction"];
    case "missing":
      return unchangedByDesign ? [] : ["state-missing"];
    case "none":
    case "forced":
      return [];
  }
}

function rgbText({ r, g, b }: Rgb): string {
  return `rgb(${String(r)} ${String(g)} ${String(b)})`;
}

/** A cell after the diff, or the browser side alone when Figma drew nothing. */
type ComparedCell =
  | {
      readonly _tag: "Compared";
      readonly figma: Raster;
      readonly browser: Raster;
      readonly diff: Raster;
      readonly raw: number;
      readonly tolerant: number;
      readonly verdict: CellVerdict;
    }
  | { readonly _tag: "NoFigmaImage"; readonly browser: Raster; readonly verdict: CellVerdict };

/** The Figma side of a cell: its geometry and decoded export, or null when Figma drew nothing. */
type FigmaSide = {
  readonly instance: InstanceSnapshot;
  readonly image: { readonly renderBounds: CanvasRect; readonly png: Raster } | null;
};

/** Lay both pictures over the background with their boxes aligned, and diff them. */
function compareCell(
  { instance, image }: FigmaSide,
  rendered: RenderedCell,
  flags: readonly CellFlag[],
  background: Rgb,
  options: CompareOptions
): ComparedCell {
  const browserPrint = browserFootprint(options.layout.padding, DEVICE_SCALE, rendered.raster);
  const figmaBox = { width: instance.box.width, height: instance.box.height };
  if (image === null) {
    const canvas = sharedCanvas([browserPrint]);
    return {
      _tag: "NoFigmaImage",
      browser: compose(canvas, background, [
        { raster: rendered.raster, at: canvas.origins[0] ?? { x: 0, y: 0 } },
      ]),
      verdict: judgeCell({
        figmaBox,
        browserBox: rendered.box,
        mismatch: undefined,
        scale: DEVICE_SCALE,
        flags,
      }),
    };
  }
  const { png, renderBounds } = image;
  const figmaPrint = figmaFootprint(instance.box, renderBounds, DEVICE_SCALE, png);
  const canvas = sharedCanvas([figmaPrint, browserPrint]);
  const [figmaAt = { x: 0, y: 0 }, browserAt = { x: 0, y: 0 }] = canvas.origins;
  const figma = compose(canvas, background, [{ raster: png, at: figmaAt }]);
  const browser = compose(canvas, background, [{ raster: rendered.raster, at: browserAt }]);
  const { raw, tolerant, diff } = diffRasters(figma, browser, options.threshold);
  const pngFlags: CellFlag[] = coversRenderBounds(renderBounds, DEVICE_SCALE, png) ? [] : ["png-size"];
  return {
    _tag: "Compared",
    figma,
    browser,
    diff,
    raw,
    tolerant,
    verdict: judgeCell({
      figmaBox,
      browserBox: rendered.box,
      mismatch: { raw, tolerant },
      scale: DEVICE_SCALE,
      flags: [...pngFlags, ...flags],
    }),
  };
}

/**
 * Compare every instance of a snapshot with the browser.
 *
 * @param snapshot - The parsed snapshot.
 * @param options - Where to write, the diff threshold and the page layout.
 * @returns The report, already written to `options.outDir`, or why the run could not start.
 */
export async function compareSnapshot(
  snapshot: KitSnapshot,
  options: CompareOptions
): Promise<Result.Result<CompareReport, CompareFailure>> {
  if (snapshot.scale !== DEVICE_SCALE) {
    return Result.fail(
      new UnsupportedScale(
        `The snapshot was exported at ${String(snapshot.scale)}x, and the browser renders at ${String(DEVICE_SCALE)}x.`
      )
    );
  }
  const build = locateFuseBuild();
  if (Result.isFailure(build)) {
    return Result.fail(build.failure);
  }
  // The Fuse build exists by now, so the renderers' imports of it load.
  const renderers = await loadRenderers();
  const assets = await readPageAssets(build.success, renderers);
  const unchanged = unchangedByDesign((await buildComponentSets()).map((set) => set.componentSet));
  const launched = await CompareBrowser.launch(assets);
  if (Result.isFailure(launched)) {
    return Result.fail(launched.failure);
  }
  const browser = launched.success;
  const cellsDir = join(options.outDir, "cells");
  rmSync(cellsDir, { recursive: true, force: true });
  mkdirSync(cellsDir, { recursive: true });
  const rows: ReportRow[] = [];
  const skipped: SkippedInstance[] = [];
  const previews: ReportPreview[] = [];
  try {
    for (const [previewIndex, preview] of snapshot.previews.entries()) {
      const outcome = await comparePreview(browser, preview, previewIndex, renderers, unchanged, options);
      if (Result.isFailure(outcome)) {
        return Result.fail(outcome.failure);
      }
      rows.push(...outcome.success.rows);
      skipped.push(...outcome.success.skipped);
      previews.push(outcome.success.preview);
    }
  } finally {
    await browser.close();
  }
  const report: CompareReport = {
    snapshot: { file: snapshot.file, exportedAt: snapshot.exportedAt, scale: snapshot.scale },
    generatedAt: new Date().toISOString(),
    threshold: options.threshold,
    fuseBuildStale: build.success.stale,
    fontPackage: assets.fontPackage,
    previews,
    rows: worstFirst(rows),
    skipped,
  };
  writeFileSync(join(options.outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(options.outDir, "report.html"), renderReportHtml(report));
  return Result.succeed(report);
}

async function comparePreview(
  browser: CompareBrowser,
  preview: PreviewSnapshot,
  previewIndex: number,
  renderers: Renderers,
  unchanged: ReadonlySet<string>,
  options: CompareOptions
): Promise<
  Result.Result<
    { readonly rows: ReportRow[]; readonly skipped: SkippedInstance[]; readonly preview: ReportPreview },
    FontNotLoaded
  >
> {
  const skip = (variant: string, reason: string): SkippedInstance => ({
    preview: preview.key,
    variant,
    reason,
  });
  const theme = parsePreviewTheme(preview.modes);
  if (Result.isFailure(theme)) {
    return Result.succeed({
      rows: [],
      skipped: preview.instances.map((instance) => skip(instance.variant, theme.failure.message)),
      preview: { key: preview.key, name: preview.name, theme: null, background: null, font: null },
    });
  }
  const { planned, unsupported } = planCells(preview.instances, renderers);
  const rendered = await browser.renderPreview(
    theme.success,
    planned.map((cell) => cell.request),
    options.layout
  );
  if (Result.isFailure(rendered)) {
    return Result.fail(rendered.failure);
  }
  const { background, cells, font } = rendered.success;
  const rows: ReportRow[] = [];
  const skipped = unsupported.map((entry) => skip(entry.variant, entry.reason));
  for (const { instance, cell: parsedCell, request } of planned) {
    const cell = cells.get(request.id);
    if (cell === undefined) {
      throw new Error(`the page returned no picture for ${request.id}`);
    }
    const png = instance.image === null ? null : parsePng(Buffer.from(instance.image.png, "base64"));
    if (png !== null && Result.isFailure(png)) {
      skipped.push(skip(instance.variant, png.failure.message));
      continue;
    }
    const figmaSide: FigmaSide = {
      instance,
      image:
        instance.image === null || png === null
          ? null
          : { renderBounds: instance.image.renderBounds, png: png.success },
    };
    const stem = `p${String(previewIndex).padStart(2, "0")}-${request.id}`;
    const unchangedByDesign = unchanged.has(instance.variant) && cell.state === "missing";
    const compared = compareCell(figmaSide, cell, stateFlags(cell, unchangedByDesign), background, options);
    const write = (suffix: string, raster: Raster) => {
      const path = `cells/${stem}-${suffix}.png`;
      writeFileSync(join(options.outDir, path), encodePng(raster));
      return path;
    };
    const browserPath = write("browser", compared.browser);
    const { width, height } = compared.browser;
    const pictures =
      compared._tag === "Compared"
        ? {
            figma: write("figma", compared.figma),
            browser: browserPath,
            diff: write("diff", compared.diff),
            width,
            height,
          }
        : { figma: null, browser: browserPath, diff: null, width, height };
    rows.push({
      preview: preview.key,
      previewName: preview.name,
      variant: instance.variant,
      axes: parsedCell,
      figmaBox: { width: instance.box.width, height: instance.box.height },
      browserBox: cell.box,
      pixels: compared._tag === "Compared" ? { raw: compared.raw, tolerant: compared.tolerant } : null,
      verdict: compared.verdict,
      unchangedByDesign,
      images: pictures,
    });
  }
  return Result.succeed({
    rows,
    skipped,
    preview: {
      key: preview.key,
      name: preview.name,
      theme: theme.success,
      background: rgbText(background),
      font,
    },
  });
}
