/**
 * Unit under test: the framed Table sets, `frame-table-cell`, `frame-table-row` and
 * `frame-table-body`, as the kit builds them and an in-memory Figma file that the token sync wrote
 * resolves them under every combination of the file's modes. A row draws each head and cell as an
 * instance of its variant with the instance's overrides applied, so a head at the row's edge pads
 * with the root padding its `table-head` instance overrides.
 * The pins come from `sweptFile` in `test/mode-sweep.ts`, which stops unless they are one per
 * combination of the theme catalog's modes, so a mode the sync leaves out fails the suite.
 * Oracle: Chromium laying out and painting the real Fuse Table as a Frame's item on Fuse's built
 * CSS, each sample as the set's compare renderer renders it, with the page stamped as `test:compare`
 * stamps the same modes and a hovered row forced to `:hover` through DevTools, as the capture forces
 * it.
 *
 * - Geometry: each head's and cell's padding across, its height, its border width on each side and
 *   its radius at each corner, as Chromium computes them, and the box that holds a cell's fill,
 *   inset by those borders and rounded by the corner inside each, CSS Backgrounds 3 §5.2: the outer
 *   radius less the border width, at least 0. Every corner this suite meets has a border of the same
 *   width on both of its sides, so the corner inside is a circle.
 * - Paint: the pixel at the middle of the left border, the one just inside it, and the one at the
 *   middle of the bottom border. The spec's pixel composites, over the Frame's fill behind the cell
 *   as Chromium paints it, a row's own fill, the layer that holds the cell's fill and then the cell's
 *   inside stroke, as Figma paints a frame's fill under its layers and its stroke over them (probe
 *   FR4). A head, cell or row of the body's last row leaves out its bottom border: the body's
 *   highlight, a `::before` of the `<tbody>`, paints its line over it, which only the body draws. A
 *   `frame-table-row` alone draws that border without the line, 229 where Chromium paints 215 in the
 *   neutral light theme.
 * - The body: its corner and shadows, its highlight's shadows, corner and insets, and the pixel of the
 *   last row's bottom border under the highlight's line, which paints after the rows.
 * - Text: each cell's text color.
 */
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { builtKit, variantRoot } from "../../test/built-kit.ts";
import type { BuiltSets } from "../../test/built-kit.ts";
import {
  CHANNEL_TOLERANCE,
  computedShadows,
  near,
  over,
  round,
  roundedShadows,
  shownPixel,
} from "../../test/composited-pixels.ts";
import type { Pixel, Shadow } from "../../test/composited-pixels.ts";
import { openFusePage } from "../../test/fuse-page.ts";
import type { InMemoryFigma } from "../../test/in-memory-figma.ts";
import { colorIn, computedColor, named, pixelsIn, sameColor, sweptFile } from "../../test/mode-sweep.ts";
import type { SweptMode } from "../../test/mode-sweep.ts";
import type { CellRendering } from "../compare/cell-renderers.ts";
import { frameTableBody, frameTableCell, frameTableRow } from "../compare/frame-table-cell.ts";
import { themeStamps } from "../compare/preview-theme.ts";
import type { Rgba } from "../variable-set.ts";
import type { Cell } from "./component-spec.ts";
import { cornerLengths } from "./corner-spec.ts";
import type {
  BoxSpec,
  ColorSpec,
  FrameLayerSpec,
  InstanceLayerSpec,
  InstanceOverride,
  NumberSpec,
  PaddingField,
  ShadowSpec,
} from "./kit-spec.ts";
import { PADDING_BOX_FILL } from "./padding-box-fill.ts";

/** The height of each sample's slot on the page, in CSS pixels, taller than any sample. */
const SLOT_HEIGHT = 140;

/**
 * The page's width, in CSS pixels, wider than any sample, which lays out at its own width whatever
 * the page's. The page draws and screenshots this much under each pin, so it stays narrow.
 */
const PAGE_WIDTH = 280;

/**
 * One sample: the variant it draws, the renderer and cell that draw it in Chromium, the `data-slot`
 * of the element it measures, and, for a row, whether the page forces it to `:hover`.
 */
type Sample = {
  readonly variant: string;
  readonly rendering: CellRendering;
  readonly cell: Cell;
  readonly part: string;
  readonly hover: boolean;
};

const CELLS: readonly Sample[] = (["first", "body", "last"] as const).flatMap((row) =>
  (["first", "middle", "last"] as const).map((column) => ({
    variant: `frame-table-cell/row=${row},column=${column}`,
    rendering: frameTableCell,
    cell: { row, column },
    part: "frame-table-cell",
    hover: false,
  }))
);

const ROWS: readonly Sample[] = (["header", "first", "body", "last"] as const).flatMap((row) =>
  (["false", "true"] as const).flatMap((selected) =>
    (["rest", "hover"] as const).map((state) => ({
      variant: `frame-table-row/row=${row},selected=${selected},state=${state}`,
      rendering: frameTableRow,
      cell: { row, selected, state },
      part: "frame-table-row",
      hover: state === "hover",
    }))
  )
);

const SAMPLES: readonly Sample[] = [...CELLS, ...ROWS];

/** The page's body: each sample in a slot of its own, one under the other, and the framed body last. */
const BODY = [
  ...SAMPLES.map(
    (sample, index) =>
      `<div data-sample="${String(index)}" style="position:absolute;left:8px;top:${String(index * SLOT_HEIGHT + 8)}px;width:max-content">${renderToStaticMarkup(sample.rendering.element(sample.cell, new Set()))}</div>`
  ),
  `<div data-sample="body" style="position:absolute;left:8px;top:${String(SAMPLES.length * SLOT_HEIGHT + 8)}px;width:max-content">${renderToStaticMarkup(frameTableBody.element({ state: "rest" }, new Set()))}</div>`,
].join("");

/** A box's four sides, in CSS pixels. */
type Sides = { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };

/** What Chromium lays out and paints for one head or cell. */
type MeasuredCell = {
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly height: number;
  readonly borders: Sides;
  /** The radius at each corner: top left, top right, bottom right, bottom left. */
  readonly radii: readonly number[];
  readonly color: string;
  readonly border: Pixel;
  readonly inside: Pixel;
  readonly bottom: Pixel;
  /** The Frame's fill behind the cell, where nothing else paints: just inside the Frame's left border. */
  readonly behind: Pixel;
};

/** Where to sample one head or cell, read once its layout settles under a pin. */
type Located = Omit<MeasuredCell, "border" | "inside" | "bottom" | "behind"> & {
  readonly x: number;
  readonly y: number;
  readonly insideX: number;
  readonly bottomX: number;
  readonly bottomY: number;
  readonly behindX: number;
};

/** Stamp one pin and locate each sample's heads or cells: the measured one, or each cell of a row. */
function stampAndLocate(page: Page, mode: SweptMode): Promise<readonly (readonly Located[])[]> {
  return page.evaluate(
    async ({ stamps, parts }) => {
      for (const [name, value] of Object.entries(stamps.root)) {
        document.documentElement.setAttribute(name, value);
      }
      for (const [name, value] of Object.entries(stamps.body)) {
        document.body.setAttribute(name, value);
      }
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return parts.map((part, index) => {
        const slot = document.querySelector(`[data-sample="${String(index)}"]`);
        const measured = slot?.querySelector(`[data-slot="${part}"]`);
        const frame = slot?.querySelector('[data-slot="frame"]');
        if (measured === null || measured === undefined || frame === null || frame === undefined) {
          throw new Error(`sample ${String(index)} holds no ${part} in a Frame`);
        }
        const frameBox = frame.getBoundingClientRect();
        const frameBorder = Number.parseFloat(getComputedStyle(frame).borderLeftWidth);
        const cells = measured.tagName === "TR" ? [...measured.children] : [measured];
        return cells.map((cell) => {
          const box = cell.getBoundingClientRect();
          const style = getComputedStyle(cell);
          const px = (value: string) => Number.parseFloat(value);
          const borders = {
            top: px(style.borderTopWidth),
            right: px(style.borderRightWidth),
            bottom: px(style.borderBottomWidth),
            left: px(style.borderLeftWidth),
          };
          const y = Math.floor(box.top + box.height / 2);
          return {
            paddingLeft: px(style.paddingLeft),
            paddingRight: px(style.paddingRight),
            height: box.height,
            borders,
            radii: [
              style.borderTopLeftRadius,
              style.borderTopRightRadius,
              style.borderBottomRightRadius,
              style.borderBottomLeftRadius,
            ].map(px),
            color: style.color,
            x: Math.floor(box.left),
            y,
            insideX: Math.floor(box.left + borders.left + 1),
            bottomX: Math.floor(box.left + box.width / 2),
            bottomY: Math.ceil(box.bottom) - 1,
            behindX: Math.floor(frameBox.left + frameBorder + 1),
          };
        });
      });
    },
    { stamps: themeStamps(mode.theme), parts: SAMPLES.map((sample) => sample.part) }
  );
}

let browser: Browser | undefined;
let kit: BuiltSets;
let figma: InMemoryFigma;
let modes: readonly SweptMode[];
/** Chromium's heads and cells per pin, then per sample. */
let measured: readonly (readonly (readonly MeasuredCell[])[])[];
/** Chromium's framed body per pin. */
let bodies: readonly MeasuredBody[];

/** What Chromium lays out and paints for the framed body sample. */
type MeasuredBody = {
  readonly radius: number;
  readonly shadow: string;
  readonly highlightShadow: string;
  readonly highlightRadius: number;
  readonly highlightInsets: Sides;
  /** The pixel at the middle of the last row's first cell's bottom border, under the highlight's line. */
  readonly lastBottom: Pixel;
  /** The Frame's fill beside it, just inside the Frame's left border. */
  readonly behind: Pixel;
};

/** Read the framed body sample under the pin the page is stamped with, where to sample it included. */
function locateBody(page: Page) {
  return page.evaluate(() => {
    const body = document.querySelector('[data-sample="body"] [data-slot="table-body"]');
    const frame = document.querySelector('[data-sample="body"] [data-slot="frame"]');
    const cell = body?.lastElementChild?.firstElementChild;
    if (body === null || frame === null || cell === null || cell === undefined) {
      throw new Error("the body sample holds no framed body with a last row");
    }
    const own = getComputedStyle(body);
    const before = getComputedStyle(body, "::before");
    const px = (value: string) => Number.parseFloat(value);
    const box = cell.getBoundingClientRect();
    const frameBox = frame.getBoundingClientRect();
    return {
      radius: px(own.borderTopLeftRadius),
      shadow: own.boxShadow,
      highlightShadow: before.boxShadow,
      highlightRadius: px(before.borderTopLeftRadius),
      // The highlight is `absolute inset-px` in a body that draws no border.
      highlightInsets: {
        top: px(before.top),
        right: px(before.right),
        bottom: px(before.bottom),
        left: px(before.left),
      },
      x: Math.floor(box.left + box.width / 2),
      y: Math.ceil(box.bottom) - 1,
      behindX: Math.floor(frameBox.left + px(getComputedStyle(frame).borderLeftWidth) + 1),
    };
  });
}

beforeAll(async () => {
  const [built, file] = await Promise.all([builtKit(), sweptFile()]);
  kit = built;
  ({ figma, modes } = file);
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: PAGE_WIDTH, height: (SAMPLES.length + 1) * SLOT_HEIGHT + 16 },
    deviceScaleFactor: 1,
  });
  await openFusePage(page, { body: BODY });
  // The capture forces a hovered row's `:hover` through DevTools, which holds it on the node.
  const session = await page.context().newCDPSession(page);
  await session.send("DOM.enable");
  await session.send("CSS.enable");
  const { root } = await session.send("DOM.getDocument", { depth: -1 });
  for (const [index, sample] of SAMPLES.entries()) {
    if (sample.hover) {
      const { nodeId } = await session.send("DOM.querySelector", {
        nodeId: root.nodeId,
        selector: `[data-sample="${String(index)}"] [data-slot="${sample.part}"]`,
      });
      await session.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["hover"] });
    }
  }
  const out: (readonly (readonly MeasuredCell[])[])[] = [];
  const bodiesOut: MeasuredBody[] = [];
  for (const mode of modes) {
    const located = await stampAndLocate(page, mode);
    const { x, y, behindX, ...body } = await locateBody(page);
    const widest = await page.evaluate(() =>
      Math.max(
        ...[...document.querySelectorAll("[data-sample]")].map((slot) => slot.getBoundingClientRect().right)
      )
    );
    if (widest > PAGE_WIDTH) {
      throw new Error(`${named(mode)}: a sample reaches ${String(widest)}px, past the page's width`);
    }
    const shot = PNG.sync.read(await page.screenshot({ animations: "disabled" }));
    const at = (x: number, y: number): Pixel => {
      const index = (y * shot.width + x) * 4;
      return { r: shot.data[index] ?? -1, g: shot.data[index + 1] ?? -1, b: shot.data[index + 2] ?? -1 };
    };
    out.push(
      located.map((cells) =>
        cells.map(({ x, y, insideX, bottomX, bottomY, behindX, ...cell }) => ({
          ...cell,
          border: at(x, y),
          inside: at(insideX, y),
          bottom: at(bottomX, bottomY),
          behind: at(behindX, y),
        }))
      )
    );
    bodiesOut.push({ ...body, lastBottom: at(x, y), behind: at(behindX, y) });
  }
  measured = out;
  bodies = bodiesOut;
});

afterAll(async () => {
  await browser?.close();
});

/** A FLOAT field as the file resolves it under a pin. */
const length = (spec: NumberSpec, mode: SweptMode): number => pixelsIn(figma, spec, mode);

/** A COLOR field as the file resolves it under a pin. */
const color = (spec: ColorSpec, mode: SweptMode): Rgba => colorIn(figma, spec, mode);

/** A head or cell as one sample's spec draws it: its root, and the overrides its instance carries. */
type Drawn = { readonly root: BoxSpec; readonly overrides: readonly InstanceOverride[] };

/**
 * The heads or cells a sample's variant draws, in the row's order: the variant's own root, or each
 * instance of a row with the overrides it carries.
 *
 * @throws When a row holds a layer that is not an instance, a defect in the set.
 */
function drawnCells(sample: Sample): readonly Drawn[] {
  const root = variantRoot(kit.spec, sample.variant);
  if (sample.part !== "frame-table-row") {
    return [{ root, overrides: [] }];
  }
  return root.children.map((layer) => {
    if (layer.kind !== "instance") {
      throw new Error(`${sample.variant} holds a ${layer.kind} layer ${layer.key}`);
    }
    return {
      root: variantRoot(kit.spec, layer.variant),
      overrides: layer.overrides ?? [],
    };
  });
}

/** The fill override at a layer path, or the layer's own fill where the instance carries none. */
function filled(drawn: Drawn, path: readonly string[], own: BoxSpec["fill"]): BoxSpec["fill"] {
  const override = drawn.overrides.find(
    (each) => each.field === "fill" && JSON.stringify(each.path) === JSON.stringify(path)
  );
  return override?.field === "fill" ? override.color : own;
}

/** A side's padding of an instance's root: the instance's override, or the variant's own padding. */
function padded(drawn: Drawn, field: PaddingField): NumberSpec {
  const override = drawn.overrides.find(
    (each): each is Extract<InstanceOverride, { readonly field: PaddingField }> =>
      each.field === field && each.path.length === 0
  );
  return override?.value ?? drawn.root[field];
}

/** The layer that holds a cell's fill inside its border, or undefined for a cell that holds none. */
function fillHolder(root: BoxSpec): FrameLayerSpec | undefined {
  const layer = root.children.find((child) => child.kind === "frame" && child.key === PADDING_BOX_FILL);
  return layer?.kind === "frame" ? layer : undefined;
}

/** The insets of the layer that holds the fill from the cell's edges. */
function holderInsets(layer: FrameLayerSpec): Sides | undefined {
  const placement = layer.placement;
  return placement?.kind === "edges" &&
    placement.horizontal.kind === "stretch" &&
    placement.vertical.kind === "stretch"
    ? {
        top: placement.vertical.start,
        right: placement.horizontal.end,
        bottom: placement.vertical.end,
        left: placement.horizontal.start,
      }
    : undefined;
}

/** A cell's stroke width on a side, 0 for none. */
function strokeSide(root: BoxSpec, side: keyof Sides, mode: SweptMode): number {
  const { stroke } = root;
  return stroke === undefined ? 0 : "sides" in stroke ? stroke.sides[side] : length(stroke.weight, mode);
}

/**
 * The spec's pixel `depth` pixels in from a cell's left edge at mid-height, or up from its bottom at
 * mid-width: what lies behind, the cell's own fill, its fill layer where the point lies inside it, and
 * its stroke where the point lies in the stroke's band, each with the instance's overrides.
 */
function specPixel(
  drawn: Drawn,
  mode: SweptMode,
  side: "left" | "bottom",
  depth: number,
  behind: Pixel
): Pixel {
  const { root } = drawn;
  let pixel = behind;
  const own = filled(drawn, [], root.fill);
  if (own !== undefined && own.kind !== "image") {
    pixel = over(pixel, color(own, mode));
  }
  const holder = fillHolder(root);
  const inset = holder === undefined ? undefined : holderInsets(holder)?.[side];
  const fill = holder === undefined ? undefined : filled(drawn, [PADDING_BOX_FILL], holder.fill);
  if (inset !== undefined && depth >= inset && fill !== undefined && fill.kind !== "image") {
    pixel = over(pixel, color(fill, mode));
  }
  if (root.stroke !== undefined && depth < strokeSide(root, side, mode)) {
    pixel = over(pixel, color(root.stroke.color, mode));
  }
  return pixel;
}

/** A cell's text color under a pin, with the instance's override, as 0..1 channels. */
function textColor(drawn: Drawn, mode: SweptMode): Rgba {
  const text = drawn.root.children.find((child) => child.kind === "text");
  if (text?.kind !== "text") {
    throw new Error("the cell holds no text");
  }
  const override = drawn.overrides.find(
    (each) => each.field === "textColor" && JSON.stringify(each.path) === JSON.stringify([text.key])
  );
  return color(override?.field === "textColor" ? override.color : text.color, mode);
}

/** Each sample's heads or cells under each pin: what the spec draws beside what Chromium shows. */
function pairs(
  sample: Sample,
  index: number
): readonly {
  readonly mode: SweptMode;
  readonly column: number;
  readonly drawn: Drawn;
  readonly chromium: MeasuredCell;
}[] {
  const drawn = drawnCells(sample);
  return modes.flatMap((mode, modeIndex) => {
    const cells = measured[modeIndex]?.[index] ?? [];
    if (cells.length !== drawn.length) {
      throw new Error(
        `${sample.variant} draws ${String(drawn.length)} cells, Chromium ${String(cells.length)}`
      );
    }
    return drawn.flatMap((each, column) => {
      const chromium = cells[column];
      return chromium === undefined ? [] : [{ mode, column, drawn: each, chromium }];
    });
  });
}

/** Whether a sample draws the body's last row, whose bottom border the body's highlight paints over. */
const lastBodyRow = (sample: Sample): boolean => sample.cell.row === "last";

/** A label for one cell of one sample under one pin. */
const at = (mode: SweptMode, column: number): string => `${named(mode)} cell ${String(column + 1)}`;

describe.each(SAMPLES.map((sample, index) => ({ ...sample, index })))("$variant", (sample) => {
  it("pads, sizes, borders and rounds each cell as Chromium does under every pin", () => {
    const apart = pairs(sample, sample.index).flatMap(({ mode, column, drawn, chromium }) => {
      const { root } = drawn;
      const spec = {
        paddingLeft: length(padded(drawn, "paddingLeft"), mode),
        paddingRight: length(padded(drawn, "paddingRight"), mode),
        height: root.sizing.vertical.kind === "fixed" ? length(root.sizing.vertical.length, mode) : undefined,
        borders: {
          top: strokeSide(root, "top", mode),
          right: strokeSide(root, "right", mode),
          bottom: strokeSide(root, "bottom", mode),
          left: strokeSide(root, "left", mode),
        },
        radii: cornerLengths(root.cornerRadius).map((corner) => round(length(corner, mode))),
      };
      const radii = spec.radii.length === 1 ? Array.from({ length: 4 }, () => spec.radii[0]) : spec.radii;
      const browserSide = {
        paddingLeft: chromium.paddingLeft,
        paddingRight: chromium.paddingRight,
        height: chromium.height,
        borders: chromium.borders,
        radii: chromium.radii.map(round),
      };
      return JSON.stringify({ ...spec, radii }) === JSON.stringify(browserSide)
        ? []
        : [`${at(mode, column)}: spec ${JSON.stringify(spec)}, Chromium ${JSON.stringify(browserSide)}`];
    });
    expect(apart).toEqual([]);
  });

  it("holds each cell's fill inside its border, rounded by the corner inside it, under every pin", () => {
    const apart = pairs(sample, sample.index).flatMap(({ mode, column, drawn: { root }, chromium }) => {
      const holder = fillHolder(root);
      if (holder === undefined) {
        // A head paints no background, so its border box is all it draws.
        return root.fill === undefined ? [] : [`${at(mode, column)}: the cell fills without a fill layer`];
      }
      const inner = chromium.radii.map((radius) => round(Math.max(0, radius - 1)));
      const corners = cornerLengths(holder.cornerRadius).map((corner) => round(length(corner, mode)));
      const spec = {
        insets: holderInsets(holder),
        corners: corners.length === 1 ? Array.from({ length: 4 }, () => corners[0]) : corners,
      };
      // Every rounded corner here has a 1px border on both its sides.
      const browserSide = { insets: chromium.borders, corners: inner };
      return JSON.stringify(spec) === JSON.stringify(browserSide)
        ? []
        : [`${at(mode, column)}: spec ${JSON.stringify(spec)}, Chromium ${JSON.stringify(browserSide)}`];
    });
    expect(apart).toEqual([]);
  });

  it("paints each cell's borders and the pixel inside its left border as Chromium does under every pin", () => {
    // A row's own root paints under its cells: its fill, and a stroke this suite expects none of.
    const row = sample.part === "frame-table-row" ? variantRoot(kit.spec, sample.variant) : undefined;
    const apart = pairs(sample, sample.index).flatMap(({ mode, column, drawn, chromium }) => {
      if (row?.stroke !== undefined) {
        return [`${at(mode, column)}: the row strokes its own root`];
      }
      const rowFill = row?.fill === undefined || row.fill.kind === "image" ? undefined : row.fill;
      const behind = rowFill === undefined ? chromium.behind : over(chromium.behind, color(rowFill, mode));
      const border = specPixel(drawn, mode, "left", 0, behind);
      const inside = specPixel(drawn, mode, "left", chromium.borders.left + 1, behind);
      const bottom = specPixel(drawn, mode, "bottom", 0, behind);
      const bottomMatches = lastBodyRow(sample) || near(bottom, chromium.bottom);
      return near(border, chromium.border) && near(inside, chromium.inside) && bottomMatches
        ? []
        : [
            `${at(mode, column)}: spec border ${shownPixel(border)} inside ${shownPixel(inside)} bottom ${shownPixel(bottom)}, Chromium border ${shownPixel(chromium.border)} inside ${shownPixel(chromium.inside)} bottom ${shownPixel(chromium.bottom)}`,
          ];
    });
    expect(apart).toEqual([]);
  });

  it("colors each cell's text as Chromium does under every pin", () => {
    const apart = pairs(sample, sample.index).flatMap(({ mode, column, drawn, chromium }) => {
      const spec = textColor(drawn, mode);
      const browserSide = computedColor(chromium.color);
      return sameColor(spec, browserSide, CHANNEL_TOLERANCE / 255)
        ? []
        : [`${at(mode, column)}: spec ${JSON.stringify(spec)}, Chromium ${chromium.color}`];
    });
    expect(apart).toEqual([]);
  });
});

/** A spec's shadows in CSS order, first on top, as Figma lists them last on top, resolved under a pin. */
function specShadows(shadows: readonly ShadowSpec[], mode: SweptMode): readonly Shadow[] {
  return shadows.toReversed().map((shadow) => ({
    color: color(shadow.color, mode),
    x: shadow.offsetX,
    y: shadow.offsetY,
    blur: length(shadow.radius, mode),
    spread: length(shadow.spread, mode),
  }));
}

/** An instance layer of a box, by its key. */
function instanceIn(box: BoxSpec, key: string): InstanceLayerSpec {
  const layer = box.children.find((child) => child.key === key);
  if (layer?.kind !== "instance") {
    throw new Error(`the box holds no instance ${key}`);
  }
  return layer;
}

/** The framed body's highlight, its `::before`. */
function bodyHighlight(body: BoxSpec): FrameLayerSpec {
  const layer = body.children.find((child) => child.kind === "frame" && child.key === "::before");
  if (layer?.kind !== "frame") {
    throw new Error("the framed body holds no highlight");
  }
  return layer;
}

describe("frame-table-body/state=rest", () => {
  it("rounds, casts its shadow and draws its highlight as Chromium does under every pin", () => {
    const body = variantRoot(kit.spec, "frame-table-body/state=rest");
    const highlight = bodyHighlight(body);
    const apart = modes.flatMap((mode, index) => {
      const chromium = bodies[index];
      const radius = (spec: BoxSpec["cornerRadius"]) => [
        ...new Set(cornerLengths(spec).map((corner) => round(length(corner, mode)))),
      ];
      const spec = {
        radius: radius(body.cornerRadius),
        shadow: roundedShadows(specShadows(body.shadows, mode)),
        highlightShadow: roundedShadows(specShadows(highlight.shadows, mode)),
        highlightRadius: radius(highlight.cornerRadius),
        highlightInsets: holderInsets(highlight),
      };
      const browserSide = {
        radius: [round(chromium?.radius ?? -1)],
        shadow: roundedShadows(computedShadows(chromium?.shadow ?? "")),
        highlightShadow: roundedShadows(computedShadows(chromium?.highlightShadow ?? "")),
        highlightRadius: [round(chromium?.highlightRadius ?? -1)],
        highlightInsets: chromium?.highlightInsets,
      };
      return JSON.stringify(spec) === JSON.stringify(browserSide)
        ? []
        : [`${named(mode)}: spec ${JSON.stringify(spec)}, Chromium ${JSON.stringify(browserSide)}`];
    });
    expect(apart).toEqual([]);
  });

  it("paints the highlight's line over the last row's bottom border as Chromium does under every pin", () => {
    const body = variantRoot(kit.spec, "frame-table-body/state=rest");
    const lastRow = variantRoot(kit.spec, instanceIn(body, "row-last").variant);
    const cell = instanceIn(lastRow, "cell-1");
    const drawn = { root: variantRoot(kit.spec, cell.variant), overrides: cell.overrides ?? [] };
    // The highlight's line, one sharp shadow 1px below a box 1px inside the body, and the last row's
    // bottom border share a pixel row. Figma paints a later layer over an earlier one, and the first
    // on top where the frame says so, so the spec's order of the two decides which lies over the other,
    // and Chromium's pixel, which paints the `::before` after the rows, is the oracle.
    const highlight = bodyHighlight(body);
    const layers = body.children.filter((child) => child === highlight || child.key === "row-last");
    const painted = body.firstOnTop === true ? layers.toReversed() : layers;
    const apart = modes.flatMap((mode, index) => {
      const chromium = bodies[index];
      if (chromium === undefined) {
        return [`${named(mode)}: unmeasured`];
      }
      const shown = painted.reduce(
        (pixel, layer) =>
          layer === highlight
            ? highlight.shadows.reduce((under, shadow) => over(under, color(shadow.color, mode)), pixel)
            : specPixel(drawn, mode, "bottom", 0, pixel),
        chromium.behind
      );
      return near(shown, chromium.lastBottom)
        ? []
        : [`${named(mode)}: spec ${shownPixel(shown)}, Chromium ${shownPixel(chromium.lastBottom)}`];
    });
    expect(apart).toEqual([]);
  });
});
