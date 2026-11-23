/**
 * An end-to-end check of the comparison itself, `figma:compare --self-check`, which CI runs as the
 * package's `test:compare` task.
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
 * draws. The body-row crop must show the bottom rule across the row's full width. The head crop must
 * contain paint inside the head's box and stay transparent outside it, and so must a framed Table
 * cell or row crop, whose Frame and neighbors the page hides. The header row's three Table head
 * instances are one framed row crop, which the check confines as a whole. Each instance that sets a
 * BOOLEAN property off its default, such as the Dropdown menu item with its `Icon` on, must also pass
 * the checks in `boolean-overrides.ts`, which fail where the property never reaches the page, its part
 * takes room but draws nothing, or the part it shows or hides is not the one that comes and goes
 * between the instance and the variant at its defaults.
 */

import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { join } from "node:path";

import * as Srgb from "@elmeragroup/color/srgb";

import { previewInstances } from "../components/build-kit.ts";
import { variantKey } from "../components/component-spec.ts";
import type { Cell } from "../components/component-spec.ts";
import { FRAME_TABLE_CELL_MANIFEST, FRAME_TABLE_ROW_MANIFEST } from "../components/frame-table-kit.ts";
import { KIT } from "../components/kit-registry.ts";
import { previewInstanceKey } from "../components/kit-spec.ts";
import { SELECT_ITEM_MANIFEST } from "../components/select-kit.ts";
import { TABLE_HEAD_MANIFEST, TABLE_ROW_MANIFEST } from "../components/table-kit.ts";
import { booleanOverrideFailures, prepareBooleanOverrides } from "./boolean-overrides.ts";
import { DEVICE_SCALE } from "./browser-render.ts";
import type { CellRequest, RenderedCell } from "./browser-render.ts";
import { makeDirectory, writeText } from "./compare-files.ts";
import type { PageLayout } from "./preview-page.ts";
import { parsePreviewTheme } from "./preview-theme.ts";
import { compose, crop, encodePng } from "./raster.ts";
import type { Raster, Rgb } from "./raster.ts";
import { parseSnapshot } from "./read-snapshot.ts";
import { compareSnapshot, openCompareSession, planCells } from "./run-compare.ts";
import type { CompareOptions, CompareReport } from "./run-compare.ts";
import { SNAPSHOT_FORMAT, SNAPSHOT_VERSION } from "./snapshot.ts";
import type { InstanceSnapshot, KitSnapshot, PreviewSnapshot } from "./snapshot.ts";
import type { TokenColorOf } from "./unchanged-by-design.ts";

/** The fake previews: a light neutral theme at dense, and a dark company theme at comfortable. */
const PREVIEWS = [
  {
    key: "preview/self-check/neutral-fkas-private-light/dense",
    modes: {
      "Fuse tokens": "Light",
      "Fuse identity": "Neutral",
      "Fuse segment": "Private",
      "Fuse brand": "Fjordkraft",
      "Fuse density": "Dense",
    },
  },
  {
    key: "preview/self-check/neutral-elma-company-dark/comfortable",
    modes: {
      "Fuse tokens": "Dark",
      "Fuse identity": "Neutral",
      "Fuse segment": "Company",
      "Fuse brand": "Elmera",
      "Fuse density": "Comfortable",
    },
  },
] as const;

/** How far a static cell's fake render bounds reach past the box, in canvas pixels. */
const RENDER_MARGIN = 4;

/**
 * How far a cell's fake render bounds reach past its box. A static cell's reach 4 pixels, which
 * covers the 3px rings the kit draws and a line Tabs trigger's active underline, a layer 2px tall
 * whose bottom sits 4px below the trigger, which Figma's render bounds hold, as they hold every layer
 * the node does not clip. A client cell's reach the browser crop's whole padding, since a popup's
 * shadow spreads further, and Figma's render bounds hold a node's whole shadow.
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

/** Whether a device pixel of a crop is painted. The page crops on a transparent background. */
function isPainted(raster: Raster, x: number, y: number): boolean {
  return (raster.data[(y * raster.width + x) * 4 + 3] ?? 0) > 0;
}

/**
 * The device pixels a crop's measured box reaches, from its first column and row to past its last.
 * The page places the box on whole CSS pixels, so its start edges fall on device pixels, and a
 * fractional size ends partway into the last column or row.
 */
function boxPixels(rendered: RenderedCell, padding: number) {
  const start = padding * DEVICE_SCALE;
  const width = rendered.box.width * DEVICE_SCALE;
  const height = rendered.box.height * DEVICE_SCALE;
  return {
    left: start,
    top: start,
    /** Past the last column the box covers whole. */
    right: start + Math.floor(width),
    /** Past the last column the box touches. */
    rightTouched: start + Math.ceil(width),
    bottom: start + Math.ceil(height),
  };
}

/**
 * How far a channel of the rule's pixel may stray from the border color laid over the theme's
 * background, in 0..255 steps. The raster rounds each channel, and a translucent border's pixel
 * rounds its alpha as well before it is laid over the background.
 */
const RULE_TOLERANCE = 2;

/** A theme color as an sRGB color, or undefined where the theme resolves no literal for the token. */
function themeColor(colorOf: TokenColorOf, token: string): Srgb.Srgb | undefined {
  const color = colorOf(token);
  if (color?.kind !== "literal") {
    return undefined;
  }
  const { r, g, b, a } = color.color;
  const made = Srgb.make({ r, g, b, alpha: a });
  return made._tag === "ok" ? made.value : undefined;
}

/**
 * Whether a Table cell's crop shows what the kit's set draws around the box, written by hand from
 * Fuse's Table source. A body row is `border-b` and is not the body's last row, so a 1px rule in the
 * preflight's `border` color runs under the whole row, on the `DEVICE_SCALE` device rows below its
 * box, which the kit's `row=body` variant draws. The `table-head` set draws a head and its text and
 * nothing past its box, while Fuse's header row is `border-b` too, so any paint outside the head's
 * box is the row's.
 *
 * @param colorOf - The theme's color of a token, the rule's color and the background it lies on.
 * @param backdrop - The preview's background, which the comparison lays every crop over.
 * @returns Undefined when it does or the cell is no such Table cell, or a line that says what the
 *   crop showed.
 */
function tableMismatch(
  definition: string,
  cell: Cell,
  rendered: RenderedCell,
  padding: number,
  colorOf: TokenColorOf,
  backdrop: Rgb,
  where: string
): string | undefined {
  const { raster } = rendered;
  const box = boxPixels(rendered, padding);
  if (definition === TABLE_ROW_MANIFEST.key && cell.row === "body") {
    const border = themeColor(colorOf, "border");
    const background = themeColor(colorOf, "background");
    if (border === undefined || background === undefined) {
      return `${where}: the theme resolves no color for border or background`;
    }
    const ruled = Srgb.compositeOver(border, background);
    const expected = [ruled.r, ruled.g, ruled.b].map((channel) => Math.round(channel * 255));
    const size = { width: box.right - box.left, height: DEVICE_SCALE };
    const strip = compose(size, backdrop, [
      { raster: crop(raster, { x: box.left, y: box.bottom }, size), at: { x: 0, y: 0 } },
    ]);
    const gaps: { readonly x: number; readonly y: number; readonly shown: readonly number[] }[] = [];
    for (let index = 0; index < strip.data.length; index += 4) {
      const shown = [...strip.data.subarray(index, index + 3)];
      if (shown.some((channel, at) => Math.abs(channel - (expected[at] ?? 0)) > RULE_TOLERANCE)) {
        const pixel = index / 4;
        gaps.push({
          x: box.left + (pixel % size.width),
          y: box.bottom + Math.floor(pixel / size.width),
          shown,
        });
      }
    }
    const [first] = gaps;
    return first === undefined
      ? undefined
      : `${where}: shows no border rule at ${String(gaps.length)} of ${String(size.width * size.height)} device pixels below the row, from ${String(first.x)},${String(first.y)}, rgb(${first.shown.join(" ")}) where the rule over the background is rgb(${expected.join(" ")})`;
  }
  if (definition === TABLE_HEAD_MANIFEST.key) {
    return boxConfinement(rendered, padding, "head", where);
  }
  if (CONFINED_FRAME_TABLE_SETS.has(definition)) {
    return boxConfinement(rendered, padding, "part", where);
  }
  return undefined;
}

/**
 * The framed Table sets whose crop must show paint inside the part's box and none outside it. Each
 * set draws its cell or row and nothing past the box: a framed cell's borders lie inside its
 * box, and its row draws none. Around the part the renderer places the Frame's fill and border and
 * empty cells, whose paint the page hides. The body is left out, since the kit's body casts a shadow
 * past its box.
 */
const CONFINED_FRAME_TABLE_SETS: ReadonlySet<string> = new Set([
  FRAME_TABLE_CELL_MANIFEST.key,
  FRAME_TABLE_ROW_MANIFEST.key,
]);

/**
 * Whether a crop shows paint inside its measured box and none outside it.
 *
 * @returns Undefined when it does, or a line that names the first pixel outside the box or says the
 *   box is empty.
 */
function boxConfinement(
  rendered: RenderedCell,
  padding: number,
  part: string,
  where: string
): string | undefined {
  const { raster } = rendered;
  const box = boxPixels(rendered, padding);
  let paintedInside = false;
  for (let y = 0; y < raster.height; y += 1) {
    for (let x = 0; x < raster.width; x += 1) {
      const inside = x >= box.left && x < box.rightTouched && y >= box.top && y < box.bottom;
      if (!isPainted(raster, x, y)) {
        continue;
      }
      if (!inside) {
        return `${where}: paints device pixel ${String(x)},${String(y)} outside the ${part}'s box`;
      }
      paintedInside = true;
    }
  }
  return paintedInside ? undefined : `${where}: paints nothing inside the ${part}'s box`;
}

/**
 * The variant key of the first cell the kit's preview frames place in a state, in registry
 * order. A set with no `state` axis has no such cell and is passed over.
 *
 * @throws When no set has such a cell, which leaves the self-check nothing to change.
 */
function firstInState(state: string): string {
  for (const { manifest, previewCells } of KIT) {
    const cell = previewCells.find((candidate) => candidate.state === state);
    if (cell !== undefined) {
      return variantKey(manifest, cell);
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

/**
 * The two cells the self-check changes, by preview and variant. Each is the instance of the variant
 * at its BOOLEAN defaults, as a preview may place the variant again with a property set.
 */
type Perturbed = { readonly preview: string; readonly variant: string };

/** Whether an instance of a preview is the perturbed cell's. */
function isPerturbed(perturbed: Perturbed, preview: string, instance: InstanceSnapshot): boolean {
  return (
    preview === perturbed.preview && instance.variant === perturbed.variant && instance.booleans === undefined
  );
}

/**
 * Run the self-check. The comparison renders in the self-check's own session, so a run
 * builds the kit, reads the page's assets and starts Chromium once.
 *
 * @param options - Where to write the fake snapshot and the report, and the diff settings.
 * @returns Whether the harness found exactly the changed cells. The Effect fails with why it could
 *   not run, and dies when the kit's preview frames place a cell the comparison cannot render.
 */
export const runSelfCheck = Effect.fn("runSelfCheck")(function* (options: CompareOptions) {
  const pixelMismatches: string[] = [];
  const toggleMismatches: string[] = [];
  const painted: Perturbed = { preview: PREVIEWS[0].key, variant: firstInState("hover") };
  const grown: Perturbed = { preview: PREVIEWS[1].key, variant: firstInState("focus") };
  const previews: PreviewSnapshot[] = [];
  const report = yield* Effect.scoped(
    Effect.gen(function* () {
      const session = yield* openCompareSession();
      const { browser, renderable, componentSets, themeColors } = session;
      const setsByKey = new Map(componentSets.map((set) => [set.key, set]));
      // Every instance a preview frame places, those that set a BOOLEAN property off its default too.
      const placed = KIT.flatMap(({ manifest, previewCells }) =>
        previewInstances(
          setsByKey.get(manifest.key),
          previewCells.map((cell) => variantKey(manifest, cell))
        )
      );
      for (const preview of PREVIEWS) {
        const modes = Object.entries(preview.modes).map(([collection, mode]) => ({ collection, mode }));
        const theme = parsePreviewTheme(modes);
        if (Result.isFailure(theme)) {
          throw theme.failure;
        }
        const placeholders = placed.map((instance): InstanceSnapshot => {
          const placeholder: InstanceSnapshot = {
            key: previewInstanceKey(preview.key, instance),
            variant: instance.variant,
            box: { x: 0, y: 0, width: 0, height: 0 },
            image: null,
          };
          return instance.booleans === undefined
            ? placeholder
            : { ...placeholder, booleans: instance.booleans };
        });
        const { colorOf, unchangedVariants } = themeColors(theme.success);
        const { planned, unsupported } = planCells(
          placeholders,
          renderable,
          unchangedVariants,
          options.layout
        );
        if (unsupported.length > 0) {
          throw new Error(
            `the comparison cannot render these cells of the kit: ${unsupported.map((entry) => entry.reason).join("; ")}`
          );
        }
        const overrides = prepareBooleanOverrides(placeholders, planned, preview.key);
        const rendered = yield* browser.renderPreview(theme.success, overrides.requests, options.layout);
        for (const { instance, cell, definition, request } of planned) {
          const fill = definition.key === SELECT_ITEM_MANIFEST.key ? selectItemFill(cell) : undefined;
          const shown = rendered.cells.get(request.id);
          if (shown === undefined) {
            continue;
          }
          const where = `${preview.key} ${instance.variant}`;
          const mismatches = [
            fill === undefined
              ? undefined
              : fillMismatch(shown.raster, options.layout.padding, fill, colorOf, `fill: ${where}`),
            tableMismatch(
              definition.key,
              cell,
              shown,
              options.layout.padding,
              colorOf,
              rendered.background,
              `table: ${where}`
            ),
          ];
          pixelMismatches.push(...mismatches.filter((line) => line !== undefined));
        }
        toggleMismatches.push(...booleanOverrideFailures(overrides, rendered, options));
        const instances = planned.map(({ instance, request }, index): InstanceSnapshot => {
          const cell = rendered.cells.get(request.id);
          if (cell === undefined) {
            throw new Error(`the page returned no picture for ${request.id}`);
          }
          const box = {
            x: 100.5 + (index % 6) * 300,
            y: 40.25 + Math.floor(index / 6) * 120,
            width: cell.box.width + (isPerturbed(grown, preview.key, instance) ? 1 : 0),
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
          const png = isPerturbed(painted, preview.key, instance) ? paintSquare(cut) : cut;
          return {
            ...instance,
            box,
            image: { renderBounds, png: Buffer.from(encodePng(png)).toString("base64") },
          };
        });
        previews.push({ key: preview.key, name: preview.key, modes, instances });
      }
      const snapshot: KitSnapshot = {
        format: SNAPSHOT_FORMAT,
        version: SNAPSHOT_VERSION,
        exportedAt: DateTime.formatIso(yield* DateTime.now),
        file: "figma:compare self-check",
        scale: DEVICE_SCALE,
        previews,
      };
      yield* makeDirectory(options.outDir);
      const text = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(snapshot);
      yield* writeText(join(options.outDir, "self-check-snapshot.json"), text);
      const reread = parseSnapshot(text);
      if (Result.isFailure(reread)) {
        throw reread.failure;
      }
      return yield* compareSnapshot(reread.success, options, session);
    })
  );
  return judgeSelfCheck(report, [grown, painted], pixelMismatches, toggleMismatches);
});

function judgeSelfCheck(
  report: CompareReport,
  expectedTop: readonly Perturbed[],
  pixelMismatches: readonly string[],
  toggleMismatches: readonly string[]
): SelfCheckResult {
  const lines: string[] = [...pixelMismatches, ...toggleMismatches.map((line) => `toggle: ${line}`)];
  const top = report.rows.slice(0, expectedTop.length);
  const topMatches = expectedTop.every(
    (expected, index) =>
      top[index]?.preview === expected.preview &&
      top[index].variant === expected.variant &&
      top[index].booleans === undefined
  );
  for (const [index, row] of top.entries()) {
    lines.push(
      `#${String(index + 1)} ${row.preview} ${row.variant}: tolerant ${row.verdict.tolerantPercent.toFixed(3)}%, raw ${row.verdict.rawPercent.toFixed(3)}%, Δ ${String(row.verdict.widthDelta)}×${String(row.verdict.heightDelta)}, flags [${row.verdict.flags.join(", ")}]`
    );
  }
  if (!topMatches) {
    lines.push(
      `expected at the top: ${expectedTop.map((expected) => `${expected.preview} ${expected.variant}`).join(", ")}`
    );
  }
  const rest = report.rows.slice(expectedTop.length);
  const worstTolerant = Math.max(0, ...rest.map((row) => row.verdict.tolerantPercent));
  const worstRaw = Math.max(0, ...rest.map((row) => row.verdict.rawPercent));
  // Every cell past the changed two must match exactly, so the console names each one that does
  // not, with its flags and mismatch, and a CI log says which cells to open in the report.
  const failing = rest.filter(
    (row) => row.verdict.flags.length > 0 || row.verdict.tolerantPercent > 0 || row.verdict.rawPercent > 0
  );
  lines.push(
    `${String(rest.length)} other cells: worst tolerant ${worstTolerant.toFixed(3)}%, worst raw ${worstRaw.toFixed(3)}%, ${String(failing.length)} differ, ${String(report.skipped.length)} skipped`
  );
  for (const row of failing) {
    lines.push(
      `  differs: ${row.preview} ${row.variant}: tolerant ${row.verdict.tolerantPercent.toFixed(3)}%, raw ${row.verdict.rawPercent.toFixed(3)}%, Δ ${String(row.verdict.widthDelta)}×${String(row.verdict.heightDelta)}, flags [${row.verdict.flags.join(", ")}]`
    );
  }
  for (const entry of report.skipped) {
    lines.push(`  skipped: ${entry.preview} ${entry.variant}: ${entry.reason}`);
  }
  const passed =
    topMatches &&
    failing.length === 0 &&
    report.skipped.length === 0 &&
    pixelMismatches.length === 0 &&
    toggleMismatches.length === 0;
  lines.push(
    passed
      ? "Self-check passed: the two changed cells lead the report and every other cell matches exactly."
      : "Self-check failed."
  );
  return { passed, lines, report };
}
