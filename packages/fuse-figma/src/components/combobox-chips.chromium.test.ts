/**
 * Unit under test: the Combobox chip and Combobox chips sets, as the kit builds them: the chip's row
 * of its label and its remove button's Icon button instance, and the chips field box, a row of chip
 * instances and the input that fills what they leave.
 * Oracle: Chromium's layout of the real Fuse `Combobox.Chips`, rendered as `figma:capture` renders
 * each cell, under the theme each pin of the synced file stamps (`test/mode-sweep.ts`). The test
 * resolves each built length in the file under the same pin, places the layers on one line as Figma's
 * auto layout does, each instance at its own axis sizing, and compares the box of the field, of each
 * chip, of each remove button and of the input with Chromium's. Figma sets a hugging label at its text's advance. The test sets each label
 * in Chromium from what the build gave it (`textAdvances`): the characters an instance's `Label`
 * property overrides or the chip's own, in the family Figma loads (`kitFamily`), at the built weight,
 * size and letter spacing under the pin, since the kit's fonts are Chromium's. `figma:capture --check`
 * reads one theme, so this test goes red where a density or a brand moves a box the build fixed,
 * binds the wrong length, sets a label's text or type apart from CSS, or draws a chip or the input
 * apart from CSS.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, variantRoot } from "../../test/built-kit.ts";
import type { BuiltSets } from "../../test/built-kit.ts";
import { named, pixelsIn, sweepSet, sweptFile, textAdvances } from "../../test/mode-sweep.ts";
import type { ComputedElement, SweptCell, SweptFile, SweptMode, TextRun } from "../../test/mode-sweep.ts";
import { kitFamily } from "../kit-fonts.ts";
import type {
  BoxSpec,
  ChildLayerSpec,
  LineHeightSpec,
  NumberSpec,
  SizeSpec,
  TextLayerSpec,
} from "./kit-spec.ts";
import { FONT_WEIGHT_STYLES, strokeRoom } from "./kit-spec.ts";

/** How far apart, in CSS pixels, a Figma edge and Chromium's may sit: a few 64ths of a pixel. */
const TOLERANCE_PX = 0.05;

/** How many mismatches a failure lists before it gives the total. */
const SHOWN_FAILURES = 6;

/** A box by its edges, relative to the cell's root. */
type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

let kit: BuiltSets;
let file: SweptFile;
let chip: readonly SweptCell[];
let chips: readonly SweptCell[];
/** Each label run's advance in Chromium, by {@link runKey}. */
let advances: ReadonlyMap<string, number>;

beforeAll(async () => {
  [kit, file] = await Promise.all([builtKit(), sweptFile()]);
  [chip, chips] = await Promise.all([
    sweepSet("combobox-chip", () => true, file.modes, []),
    sweepSet("combobox-chips", () => true, file.modes, []),
  ]);
  const runs = [
    ...chip.map((cell) => labelRun(cell.key, undefined, cell.mode)),
    ...chips.flatMap((cell) =>
      variantRoot(kit.spec, cell.key).children.flatMap((layer) =>
        layer.kind === "instance" ? [labelRun(layer.variant, layer.properties?.text, cell.mode)] : []
      )
    ),
  ];
  const unique = [...new Map(runs.map((run) => [runKey(run), run])).values()];
  const widths = await textAdvances("combobox-chip", unique);
  advances = new Map(unique.map((run, index) => [runKey(run), widths[index] ?? Number.NaN]));
});

/** The keys of a built set's variants. */
function variantKeys(set: string): readonly string[] {
  return kit.spec.componentSets.find(({ key }) => key === set)?.variants.map(({ key }) => key) ?? [];
}

/** A built length in pixels under a pin. */
function px(length: NumberSpec, mode: SweptMode): number {
  return pixelsIn(file.figma, length, mode);
}

/** A text's line height in pixels under a pin, which a text that hugs its one line is as tall as. */
function lineHeightPx(lineHeight: LineHeightSpec, mode: SweptMode): number {
  if (lineHeight.kind === "percent") {
    throw new Error("the test reads a line height in pixels, and the build drew a percent");
  }
  return px(lineHeight, mode);
}

/** The chip variant's label layer. */
function labelOf(variant: string): TextLayerSpec {
  const label = variantRoot(kit.spec, variant).children.find((layer) => layer.kind === "text");
  if (label?.kind !== "text") {
    throw new Error(`${variant} draws no label`);
  }
  return label;
}

/** The weight a label sets under a pin: its bound variable's, or the weight its Figma style names. */
function weightOf(label: TextLayerSpec, mode: SweptMode): number {
  if (label.weight !== undefined) {
    return px({ kind: "variable", variable: label.weight.variable }, mode);
  }
  const weight = [...FONT_WEIGHT_STYLES].find(([, style]) => style === label.fontStyle)?.[0];
  if (weight === undefined) {
    throw new Error(`the test reads no weight for the style ${label.fontStyle}`);
  }
  return weight;
}

/**
 * The run of text a chip variant's label sets under a pin: the characters an instance's TEXT values
 * give its property, or the label's own, in the family Figma loads at the built weight, size and
 * letter spacing.
 */
function labelRun(
  variant: string,
  text: Readonly<Record<string, string>> | undefined,
  mode: SweptMode
): TextRun {
  const label = labelOf(variant);
  const size = px(label.fontSize, mode);
  return {
    characters:
      (label.textProperty === undefined ? undefined : text?.[label.textProperty]) ?? label.characters,
    family: kitFamily(label.fontFamily),
    weight: weightOf(label, mode),
    size,
    letterSpacing: ((label.letterSpacing?.value ?? 0) * size) / 100,
  };
}

/** A run's key among the advances the page set. */
const runKey = (run: TextRun): string => JSON.stringify(run);

/** The advance Chromium gave a run. */
function advanceOf(run: TextRun): number {
  const width = advances.get(runKey(run));
  if (width === undefined) {
    throw new Error(`the page set no run of ${run.characters}`);
  }
  return width;
}

/** An element's box relative to the cell's root, the first element the sweep read. */
function boxOf(cell: SweptCell, element: ComputedElement): Box {
  const root = cell.elements[0]?.box;
  const own = element.box;
  if (root === undefined) {
    throw new Error(`${cell.key} measured no root`);
  }
  return { x: own.x - root.x, y: own.y - root.y, width: own.width, height: own.height };
}

/** The elements of a cell at a place, in document order. */
function at(cell: SweptCell, place: string): readonly ComputedElement[] {
  return cell.elements.filter((element) => element.place === place);
}

/** A layer's width and height. */
type Size = { readonly width: number; readonly height: number };

/**
 * A row's layer as Figma sizes it along the row: at a fixed width, at its own width where it hugs, or
 * filling what the row leaves above a minimum width.
 */
type RowLayer = {
  readonly key: string;
  readonly width:
    | { readonly kind: "fixed"; readonly width: number }
    | { readonly kind: "hug"; readonly width: number }
    | { readonly kind: "fill"; readonly minWidth: number };
  readonly height: number;
};

/** Where a row sets a layer, relative to its content box. */
type RowPlace = Box & { readonly key: string };

/** A layer as the test places it: its box, and the boxes of the layers it holds, by key. */
type Placed = Box & { readonly layers: ReadonlyMap<string, Placed> };

/**
 * The fixed length of an axis, or undefined where it hugs or fills.
 */
function fixed(size: SizeSpec, mode: SweptMode): number | undefined {
  return size.kind === "fixed" ? px(size.length, mode) : undefined;
}

/** The room a box's stroke and padding take on each side. */
type Insets = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

function insetsOf(box: BoxSpec, mode: SweptMode): Insets {
  return {
    top: px(strokeRoom(box.stroke, "top"), mode) + px(box.paddingTop, mode),
    right: px(strokeRoom(box.stroke, "right"), mode) + px(box.paddingRight, mode),
    bottom: px(strokeRoom(box.stroke, "bottom"), mode) + px(box.paddingBottom, mode),
    left: px(strokeRoom(box.stroke, "left"), mode) + px(box.paddingLeft, mode),
  };
}

/**
 * Where a row's one line starts past its start padding, under the row's `primaryAlign`: at the start
 * for MIN, in the middle of the room the line leaves for CENTER, and at the end for MAX. A row that
 * spreads its layers is no row this test lays out.
 */
function lineStart(box: BoxSpec, free: number): number {
  switch (box.primaryAlign) {
    case "MIN":
      return 0;
    case "CENTER":
      return free / 2;
    case "MAX":
      return free;
    default:
      throw new Error(`the test lays out no row whose primaryAlign is ${box.primaryAlign}`);
  }
}

/**
 * A row's layer as Figma sizes it: its own size where it hugs, a fixed length where it sets one, and
 * a frame that fills along the row above its minimum width. An instance takes its own axis sizing
 * over the variant it shows. The test refuses a layer it does not model: one that fills across the
 * row, an instance that fills or sets its own minimum or maximum width.
 */
function rowLayerOf(layer: ChildLayerSpec, own: Size, mode: SweptMode): RowLayer {
  if (layer.kind === "instance" && (layer.minWidth !== undefined || layer.maxWidth !== undefined)) {
    throw new Error(`the test models no minimum or maximum width an instance sets, as ${layer.key} does`);
  }
  if (layer.kind !== "frame" && layer.kind !== "instance") {
    return { key: layer.key, width: { kind: "hug", width: own.width }, height: own.height };
  }
  const { horizontal, vertical } = layer.sizing;
  if (
    vertical.kind === "fill" ||
    vertical.kind === "placed" ||
    horizontal.kind === "placed" ||
    (horizontal.kind === "fill" && layer.kind === "instance")
  ) {
    throw new Error(`the test lays out no ${layer.kind} ${layer.key} that fills as it does`);
  }
  const height = vertical.kind === "fixed" ? px(vertical.length, mode) : own.height;
  switch (horizontal.kind) {
    case "fixed":
      return { key: layer.key, width: { kind: "fixed", width: px(horizontal.length, mode) }, height };
    case "hug":
      return { key: layer.key, width: { kind: "hug", width: own.width }, height };
    case "fill": {
      const minimum = layer.kind === "frame" ? layer.limits.minWidth : undefined;
      if (minimum === undefined) {
        throw new Error(`the test lays out no filling ${layer.key} without a minimum width`);
      }
      return { key: layer.key, width: { kind: "fill", minWidth: px(minimum, mode) }, height };
    }
  }
}

/**
 * Lay out a horizontal row as Figma's auto layout does: on one line by its `primaryAlign`, each layer
 * at its own width and a filling one at what the others and the gaps leave, at least its minimum,
 * centred across. The row is its fixed width, and as tall as its insets and its line, at least its
 * minimum height, the line centred in any height left over.
 */
function layOutRow(
  box: BoxSpec,
  mode: SweptMode,
  measure: (layer: ChildLayerSpec) => Size,
  inner: (layer: ChildLayerSpec) => ReadonlyMap<string, Placed>
): Placed {
  if (box.direction !== "HORIZONTAL" || box.counterAlign !== "CENTER") {
    throw new Error(
      `the test lays out a centred row, and the build drew ${box.direction} ${box.counterAlign}`
    );
  }
  const inset = insetsOf(box, mode);
  const gap = px(box.itemSpacing, mode);
  const layers = box.children.map((layer) => rowLayerOf(layer, measure(layer), mode));
  const own = (layer: RowLayer): number => (layer.width.kind === "fill" ? 0 : layer.width.width);
  const hugWidth = layers.reduce((sum, layer) => sum + own(layer), 0) + gap * (layers.length - 1);
  const width = fixed(box.sizing.horizontal, mode) ?? inset.left + inset.right + hugWidth;
  const room = width - inset.left - inset.right;
  const places = oneLine(box, layers, room, gap);
  const content = Math.max(...places.map(({ y, height }) => y + height));
  const minHeight = box.limits.minHeight === undefined ? 0 : px(box.limits.minHeight, mode);
  const height = fixed(box.sizing.vertical, mode) ?? Math.max(minHeight, inset.top + inset.bottom + content);
  const top = inset.top + (height - inset.top - inset.bottom - content) / 2;
  const placed = new Map<string, Placed>();
  for (const place of places) {
    const layer = box.children.find(({ key }) => key === place.key);
    if (layer !== undefined) {
      placed.set(layer.key, {
        x: inset.left + place.x,
        y: top + place.y,
        width: place.width,
        height: place.height,
        layers: inner(layer),
      });
    }
  }
  return { x: 0, y: 0, width, height, layers: placed };
}

/**
 * A row's layers on its one line, each at its own width and a filling one at what the line's others
 * and gaps leave, at least its minimum, set along the line by the row's `primaryAlign` and centred
 * across it. The test refuses a row with more than one filling layer, which Figma shares the room
 * between by a rule this test does not model.
 */
function oneLine(box: BoxSpec, layers: readonly RowLayer[], room: number, gap: number): readonly RowPlace[] {
  const fills = layers.filter(({ width }) => width.kind === "fill");
  if (fills.length > 1) {
    throw new Error(
      `the test lays out one filling layer on a line, and the build drew ${String(fills.length)}: ${fills.map(({ key }) => key).join(", ")}`
    );
  }
  const taken = layers.reduce((sum, { width }) => (width.kind === "fill" ? sum : sum + width.width), 0);
  const widths = layers.map(({ width }) =>
    width.kind === "fill" ? Math.max(width.minWidth, room - taken - gap * (layers.length - 1)) : width.width
  );
  const used = widths.reduce((sum, each) => sum + each, 0) + gap * (layers.length - 1);
  const tallest = Math.max(...layers.map(({ height }) => height));
  let x = lineStart(box, room - used);
  return layers.map((layer, index) => {
    const width = widths[index] ?? 0;
    const place = {
      key: layer.key,
      x,
      y: (tallest - layer.height) / 2,
      width,
      height: layer.height,
    };
    x += width + gap;
    return place;
  });
}

/**
 * Place a chip variant whose label sets `run`: its label and its remove button's instance, which
 * takes its own fixed lengths.
 */
function placeChip(mode: SweptMode, variant: string, run: TextRun): Placed {
  const root = variantRoot(kit.spec, variant);
  const measure = (layer: ChildLayerSpec): Size => {
    if (layer.kind === "text") {
      return { width: advanceOf(run), height: lineHeightPx(layer.lineHeight, mode) };
    }
    if (layer.kind === "instance") {
      const width = fixed(layer.sizing.horizontal, mode);
      const height = fixed(layer.sizing.vertical, mode);
      if (width === undefined || height === undefined) {
        throw new Error(`the chip's ${layer.key} takes no fixed size`);
      }
      return { width, height };
    }
    throw new Error(`the chip holds an unexpected ${layer.kind} ${layer.key}`);
  };
  return layOutRow(root, mode, measure, () => new Map());
}

/** Each edge of `figma` that sits more than the tolerance from `chromium`'s, named. */
function apart(name: string, figma: Box, chromium: Box): readonly string[] {
  return (["x", "y", "width", "height"] as const).flatMap((edge) =>
    Math.abs(figma[edge] - chromium[edge]) <= TOLERANCE_PX
      ? []
      : [`${name} ${edge} ${figma[edge].toFixed(3)} in Figma, ${chromium[edge].toFixed(3)} in Chromium`]
  );
}

/** A box offset by a parent's place. */
function within(parent: Box, box: Box): Box {
  return { ...box, x: parent.x + box.x, y: parent.y + box.y };
}

/**
 * The failures as a test reports them: none for none, or the total and the first few, each naming
 * its variant, pin, layer, edge and both values.
 */
function report(failures: readonly string[]): string {
  return failures.length === 0
    ? ""
    : [
        `${String(failures.length)} edges or line counts apart, the first ${String(Math.min(SHOWN_FAILURES, failures.length))}:`,
        ...failures.slice(0, SHOWN_FAILURES),
      ].join("\n");
}

describe("the Combobox chip set", () => {
  it("lays out the chip and its remove button as Chromium does under every pin", () => {
    const failures = chip.flatMap((cell) => {
      const element = cell.elements[0];
      const remove = at(cell, "combobox-chip-remove")[0];
      if (element === undefined || remove === undefined) {
        throw new Error(`${cell.key} measured no chip or no remove button`);
      }
      const placed = placeChip(cell.mode, cell.key, labelRun(cell.key, undefined, cell.mode));
      const removed = placed.layers.get("remove");
      if (removed === undefined) {
        throw new Error("the chip draws no remove layer");
      }
      return [
        ...apart("chip", placed, boxOf(cell, element)),
        ...apart("remove", removed, boxOf(cell, remove)),
      ].map((failure) => `${cell.key} ${named(cell.mode)}: ${failure}`);
    });
    expect(new Set(chip.map(({ mode }) => mode))).toEqual(new Set(file.modes));
    expect(new Set(chip.map(({ key }) => key))).toEqual(new Set(variantKeys("combobox-chip")));
    expect(report(failures)).toBe("");
  });
});

/** How many lines a set of boxes sits on, by where their middles sit across the row. */
function lineCount(boxes: readonly Box[]): number {
  return new Set(boxes.map(({ y, height }) => Math.round(y + height / 2))).size;
}

/**
 * Each edge of a chips cell's field box, chip, remove button and input that the built variant, laid
 * out as Figma does under the cell's pin, places apart from Chromium, and a line count apart from
 * `lines` and from Chromium's.
 */
function fieldFailures(cell: SweptCell, lines: number): readonly string[] {
  const root = variantRoot(kit.spec, cell.key);
  const chipElements = at(cell, "combobox-chip");
  const removes = at(cell, "combobox-chip-remove");
  const input = at(cell, "combobox-chip-input")[0];
  const chipsOf = new Map(
    root.children.flatMap((layer) =>
      layer.kind === "instance"
        ? [
            [
              layer.key,
              placeChip(cell.mode, layer.variant, labelRun(layer.variant, layer.properties?.text, cell.mode)),
            ] as const,
          ]
        : []
    )
  );
  const measure = (layer: ChildLayerSpec): Size => {
    const placedChip = chipsOf.get(layer.key);
    if (placedChip !== undefined) {
      return { width: placedChip.width, height: placedChip.height };
    }
    if (layer.kind === "frame") {
      const [text] = layer.children;
      if (text?.kind !== "text") {
        throw new Error(`${cell.key}'s ${layer.key} holds no text`);
      }
      return { width: 0, height: lineHeightPx(text.lineHeight, cell.mode) };
    }
    throw new Error(`${cell.key} holds an unexpected ${layer.kind} ${layer.key}`);
  };
  const box = layOutRow(root, cell.mode, measure, (layer) => chipsOf.get(layer.key)?.layers ?? new Map());
  const placed = box.layers;
  const chipLayers = root.children.filter((layer) => layer.kind === "instance");
  const fieldElement = cell.elements[0];
  if (fieldElement === undefined) {
    throw new Error(`${cell.key} measured no field box`);
  }
  const drawn = lineCount([...placed.values()]);
  const measured = lineCount(
    [...chipElements, ...(input === undefined ? [] : [input])].map((element) => boxOf(cell, element))
  );
  const rows = [
    ...(drawn === lines && measured === lines
      ? []
      : [
          `lines ${String(drawn)} in Figma, ${String(measured)} in Chromium, where the set draws ${String(lines)}`,
        ]),
    ...apart("field", box, boxOf(cell, fieldElement)),
    ...chipLayers.flatMap((layer, index) => {
      const chipBox = placed.get(layer.key);
      const remove = chipBox?.layers.get("remove");
      const element = chipElements[index];
      const removeElement = removes[index];
      if (
        chipBox === undefined ||
        remove === undefined ||
        element === undefined ||
        removeElement === undefined
      ) {
        throw new Error(`${cell.key} lays out no ${layer.key}`);
      }
      return [
        ...apart(layer.key, chipBox, boxOf(cell, element)),
        ...apart(`${layer.key} remove`, within(chipBox, remove), boxOf(cell, removeElement)),
      ];
    }),
    ...(input === undefined
      ? ["measured no input"]
      : apart(
          "input",
          placed.get("input") ?? { x: NaN, y: NaN, width: NaN, height: NaN },
          boxOf(cell, input)
        )),
  ];
  return rows.map((failure) => `${cell.key} ${named(cell.mode)}: ${failure}`);
}

describe("the Combobox chips set", () => {
  it("lays out the field box, its chips and its input on one line as Chromium does under every pin", () => {
    expect(new Set(chips.map(({ mode }) => mode))).toEqual(new Set(file.modes));
    expect(new Set(chips.map(({ key }) => key))).toEqual(new Set(variantKeys("combobox-chips")));
    expect(report(chips.flatMap((cell) => fieldFailures(cell, 1)))).toBe("");
  });
});
