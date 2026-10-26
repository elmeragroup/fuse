/**
 * An end-to-end check of the comparison itself, run by hand with `figma:compare --self-check`.
 * It renders every cell the kit's preview frames place in the browser, turns the crops into a
 * fake snapshot shaped like a Figma export, changes two cells, and compares the snapshot with a
 * second render.
 *
 * The fake export cuts each crop to the box plus a margin, as render bounds would be, and places
 * the boxes at fractional canvas positions, so the alignment math has work to do. A client cell
 * keeps the browser crop's whole padding, so a popup's shadow stays in its PNG, as Figma's render
 * bounds hold a node's effects. The kit's
 * first hover cell gets a magenta square painted into its PNG, and its first focus cell grows by
 * a pixel. A working harness reports both at the top, the grown box first, and every other cell
 * at no mismatch with equal box sizes.
 *
 * The kit's client cells, popups and open composites included, prove that a client cell mounts,
 * measures and forces its state the same way twice. A Select item at rest must also show no fill and
 * a highlighted one the theme's `accent`, which fails where a stray focus or highlight from the mount
 * draws.
 */

import { Effect, FileSystem, Result } from "effect";
import { join } from "node:path";

import { buildComponentSets } from "../components/build-kit.ts";
import { variantKey } from "../components/component-spec.ts";
import type { Cell } from "../components/component-spec.ts";
import { KIT } from "../components/kit-registry.ts";
import { SELECT_ITEM } from "../components/select-kit.ts";
import { CompareBrowser, DEVICE_SCALE } from "./browser-render.ts";
import type { CellRequest } from "./browser-render.ts";
import { loadRenderers } from "./cell-renderers.ts";
import { fileFailure, writeText } from "./compare-files.ts";
import { locateFuseBuild, readPageAssets } from "./page-assets.ts";
import type { PageLayout } from "./preview-page.ts";
import { parsePreviewTheme } from "./preview-theme.ts";
import { crop, encodePng } from "./raster.ts";
import type { Raster } from "./raster.ts";
import { parseSnapshot } from "./read-snapshot.ts";
import { compareSnapshot, planCells, renderables } from "./run-compare.ts";
import type { CompareOptions, CompareReport } from "./run-compare.ts";
import { SNAPSHOT_FORMAT, SNAPSHOT_VERSION } from "./snapshot.ts";
import type { InstanceSnapshot, KitSnapshot, PreviewSnapshot } from "./snapshot.ts";
import { tokenColorsIn, unchangedByDesign } from "./unchanged-by-design.ts";
import type { TokenColorOf } from "./unchanged-by-design.ts";

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

/** How far a static cell's fake render bounds reach past the box, in canvas pixels. */
const RENDER_MARGIN = 3;

/**
 * How far a cell's fake render bounds reach past its box. A static cell's reach 3 pixels, which
 * covers the 3px rings the kit draws. A client cell's reach the browser crop's whole padding, since
 * a popup's shadow spreads further, and Figma's render bounds hold a node's whole shadow.
 */
function renderMargin(request: CellRequest, layout: PageLayout): number {
  return request.content._tag === "Client" ? layout.padding : RENDER_MARGIN;
}

/**
 * The fill a cell's measured element shows just inside its start edge, written by hand from the
 * compiled CSS: none, where the element paints no background and the page hides the popup around it,
 * or a `Fuse tokens` color the theme resolves.
 */
type ExpectedFill = { readonly _tag: "None" } | { readonly _tag: "Token"; readonly token: string };

/**
 * The fill a Select item cell must show, by state. Fuse's built Select item paints
 * `background-color: var(--accent)` under `focus:bg-accent` and no background otherwise. A disabled
 * row is not checked.
 */
function selectItemFill(cell: Cell): ExpectedFill | undefined {
  switch (cell.state) {
    case "rest":
      return { _tag: "None" };
    case "highlighted":
      return { _tag: "Token", token: "accent" };
    default:
      return undefined;
  }
}

/** How far inside its start edge, in device pixels, a cell's fill is read, clear of a rounded corner's curve at mid height. */
const FILL_INSET = 4;

/**
 * Whether a cell shows the fill it must, read at mid height just inside its start edge.
 *
 * @returns Undefined when it does, or a line that says what the cell showed.
 */
function fillMismatch(
  raster: Raster,
  padding: number,
  fill: ExpectedFill,
  colorOf: TokenColorOf,
  where: string
): string | undefined {
  const x = padding * DEVICE_SCALE + FILL_INSET;
  const y = Math.floor(raster.height / 2);
  const [r = 0, g = 0, b = 0, a = 0] = crop(raster, { x, y }, { width: 1, height: 1 }).data;
  const shown = `rgba(${String(r)} ${String(g)} ${String(b)} ${String(a)})`;
  if (fill._tag === "None") {
    return a === 0 ? undefined : `${where}: shows ${shown} where it paints no fill`;
  }
  const color = colorOf(fill.token);
  if (color?.kind !== "literal") {
    return `${where}: the theme resolves no color for ${fill.token}`;
  }
  const expected = [color.color.r, color.color.g, color.color.b].map((channel) => Math.round(channel * 255));
  const matches =
    [r, g, b].every((channel, index) => Math.abs(channel - (expected[index] ?? 0)) <= 1) && a === 255;
  return matches
    ? undefined
    : `${where}: shows ${shown} where it paints ${fill.token}, rgb(${expected.join(" ")})`;
}

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
 * @returns Whether the harness found exactly the changed cells. The Effect fails with why it could
 *   not run, and dies when the kit's preview frames place a cell the comparison cannot render.
 */
export const runSelfCheck = Effect.fn("runSelfCheck")(function* (options: CompareOptions) {
  const build = yield* locateFuseBuild();
  const fillMismatches: string[] = [];
  const variants = KIT.flatMap(({ definition, previewCells }) =>
    previewCells.map((cell) => variantKey(definition, cell))
  );
  const painted: Perturbed = { preview: PREVIEWS[0].key, variant: firstInState("hover") };
  const grown: Perturbed = { preview: PREVIEWS[1].key, variant: firstInState("focus") };
  const renderers = yield* loadRenderers();
  const renderable = renderables(renderers);
  const componentSets = (yield* buildComponentSets()).map((set) => set.componentSet);
  const assets = yield* readPageAssets(build, renderers);
  const previews: PreviewSnapshot[] = [];
  yield* Effect.scoped(
    Effect.gen(function* () {
      const browser = yield* CompareBrowser.launch(assets);
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
        const unchanged = unchangedByDesign(componentSets, tokenColorsIn(theme.success));
        const { planned, unsupported } = planCells(placeholders, renderable, unchanged, options.layout);
        if (unsupported.length > 0) {
          throw new Error(
            `the comparison cannot render these cells of the kit: ${unsupported.map((entry) => entry.reason).join("; ")}`
          );
        }
        const rendered = yield* browser.renderPreview(
          theme.success,
          planned.map((cell) => cell.request),
          options.layout
        );
        const colorOf = tokenColorsIn(theme.success);
        for (const { instance, cell, definition, request } of planned) {
          const fill = definition.key === SELECT_ITEM.key ? selectItemFill(cell) : undefined;
          const raster = rendered.cells.get(request.id)?.raster;
          const mismatch =
            fill === undefined || raster === undefined
              ? undefined
              : fillMismatch(
                  raster,
                  options.layout.padding,
                  fill,
                  colorOf,
                  `${preview.key} ${instance.variant}`
                );
          if (mismatch !== undefined) {
            fillMismatches.push(mismatch);
          }
        }
        const instances = planned.map(({ instance, request }, index): InstanceSnapshot => {
          const cell = rendered.cells.get(request.id);
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
          const margin = renderMargin(request, options.layout);
          const renderBounds = {
            x: box.x - margin,
            y: box.y - margin,
            width: cell.box.width + 2 * margin,
            height: cell.box.height + 2 * margin,
          };
          const inset = (options.layout.padding - margin) * DEVICE_SCALE;
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
    })
  );
  const snapshot: KitSnapshot = {
    format: SNAPSHOT_FORMAT,
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    file: "figma:compare self-check",
    scale: DEVICE_SCALE,
    previews,
  };
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .makeDirectory(options.outDir, { recursive: true })
    .pipe(Effect.mapError(fileFailure("create", options.outDir)));
  const text = JSON.stringify(snapshot);
  yield* writeText(join(options.outDir, "self-check-snapshot.json"), text);
  const reread = parseSnapshot(text);
  if (Result.isFailure(reread)) {
    throw reread.failure;
  }
  const report = yield* compareSnapshot(reread.success, options);
  return judgeSelfCheck(report, [grown, painted], fillMismatches);
});

function judgeSelfCheck(
  report: CompareReport,
  expectedTop: readonly Perturbed[],
  fillMismatches: readonly string[]
): SelfCheckResult {
  const lines: string[] = [...fillMismatches.map((line) => `fill: ${line}`)];
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
    report.skipped.length === 0 &&
    fillMismatches.length === 0;
  lines.push(
    passed
      ? "Self-check passed: the two changed cells lead the report and every other cell matches exactly."
      : "Self-check failed."
  );
  return { passed, lines, report };
}
