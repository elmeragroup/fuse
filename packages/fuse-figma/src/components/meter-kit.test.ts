/**
 * Unit under test: the Meter component set as the build produces it. Oracle: the Fuse variable or
 * literal each Figma field of a cell must carry, read by hand from `meterVariants` in
 * `meter-variants.ts`, the mode and level table in `meter-tone.ts`, Base UI's `MeterIndicator`, which
 * sets `inset-inline-start: 0; height: inherit; width: <share>%` on the fill, the docs Modes demo
 * (50, 85 and 100 of 100, and 130 of 120, which Base UI clamps to 100%), and
 * `research/avatar-meter.md` §3 to §5: a 256px column with a 4px gap, holding a header that fills
 * its width and spaces the label and the value apart 8px or more, and a 6px `muted` bar on a 3px
 * corner that fills its width and holds the fill at its top left, at the level's share of 256px. The
 * label is `Storage used` at 14/20 Medium in `foreground`. The value is the level's percentage at
 * 14/20 Regular in the tone's color, after the tone's icon and one Roboto space at 14px: 508 of 2048
 * units, 3.47265625px, read from the `hmtx` table of `@fontsource/roboto` 5.3.0's Regular face.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  FILL,
  fixed,
  fixedSize,
  HUG,
  literal,
  paint,
  token,
  UNLIMITED,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";
import { fixedLength } from "./kit-spec";
import type { ComponentRootSpec, FillSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

function meter(mode: string, level: string): ComponentRootSpec {
  return variantRoot(spec, `meter/mode=${mode},level=${level}`);
}

/** Roboto Regular's space at 14px: 508 / 2048 × 14. */
const SPACE = 3.47265625;

/** A box with no limits, padding, corner, paint or shadow. */
const PLAIN = {
  limits: UNLIMITED,
  paddingTop: literal(0),
  paddingRight: literal(0),
  paddingBottom: literal(0),
  paddingLeft: literal(0),
  stroke: undefined,
  shadows: [],
  opacity: 1,
} as const;

/** A part that hugs its text and centers its layers in a row, with no gap, corner or fill. */
const HUGGING_PART = {
  ...PLAIN,
  kind: "frame",
  direction: "HORIZONTAL",
  sizing: { horizontal: HUG, vertical: HUG },
  clips: false,
  itemSpacing: literal(0),
  primaryAlign: "CENTER",
  counterAlign: "CENTER",
  cornerRadius: literal(0),
  fill: undefined,
} as const;

/** A 14/20 text in the page's font family that hugs its characters, set from the top left. */
const TEXT = {
  kind: "text",
  fontFamily: token("font-sans"),
  fontSize: literal(14),
  lineHeight: literal(20),
  underline: undefined,
  sizing: { horizontal: HUG, vertical: HUG },
  align: { horizontal: "LEFT", vertical: "TOP" },
  truncation: undefined,
} as const;

/** The default meter at 85 of 100: a warning, with the Warning icon. */
const DEFAULT_MEDIUM = {
  ...PLAIN,
  name: "meter",
  direction: "VERTICAL",
  sizing: { horizontal: fixed(literal(256)), vertical: HUG },
  clips: true,
  itemSpacing: literal(4),
  primaryAlign: "MIN",
  counterAlign: "MIN",
  cornerRadius: literal(0),
  fill: undefined,
  children: [
    {
      ...HUGGING_PART,
      key: "header",
      name: "header",
      sizing: { horizontal: FILL, vertical: HUG },
      itemSpacing: literal(8),
      primaryAlign: "SPACE_BETWEEN",
      children: [
        {
          ...HUGGING_PART,
          key: "label",
          name: "meter-label",
          children: [
            {
              ...TEXT,
              key: "label",
              name: "label",
              characters: "Storage used",
              textProperty: "Label",
              fontStyle: "Medium",
              color: paint("foreground"),
            },
          ],
        },
        {
          ...HUGGING_PART,
          key: "value",
          name: "meter-value",
          itemSpacing: literal(SPACE),
          children: [
            {
              kind: "icon",
              key: "icon",
              name: "icon",
              icon: "icon/Warning",
              swapProperty: undefined,
              size: literal(16),
              color: paint("warning-foreground"),
            },
            {
              ...TEXT,
              key: "value",
              name: "value",
              characters: "85%",
              textProperty: undefined,
              fontStyle: "Regular",
              color: paint("warning-foreground"),
            },
          ],
        },
      ],
    },
    {
      ...HUGGING_PART,
      key: "bar",
      name: "meter-bar",
      sizing: { horizontal: FILL, vertical: fixed(literal(6)) },
      cornerRadius: literal(3),
      fill: paint("muted"),
      children: [
        {
          ...HUGGING_PART,
          key: "fill",
          name: "meter-bar-fill",
          sizing: fixedSize(literal(217.6), literal(6)),
          cornerRadius: literal(3),
          fill: paint("warning"),
          absolute: { x: 0, y: 0, constraints: { horizontal: "SCALE", vertical: "STRETCH" } },
          children: [],
        },
      ],
    },
  ],
} as const;

/** The value's text and color, the icon before it, and the fill's width and color, as one row. */
type Face = readonly [text: string, color: string, icon: string | undefined, width: number, fill: string];

/**
 * Each cell's face, by mode and level, read from `METER_TONE_TABLE`: a tone paints the value in
 * `success`, `warning-foreground`, `error` or `foreground` and the fill in `success`, `warning`,
 * `error` or `primary`, and the icon is Warning, CheckCircle or none.
 */
const FACES: readonly (readonly [mode: string, level: string, face: Face])[] = [
  ["default", "low", ["50%", "success", undefined, 128, "success"]],
  ["default", "medium", ["85%", "warning-foreground", "Warning", 217.6, "warning"]],
  ["default", "full", ["100%", "error", "Warning", 256, "error"]],
  ["default", "exceeded", ["100%", "error", "Warning", 256, "error"]],
  ["inverted", "low", ["50%", "error", undefined, 128, "error"]],
  ["inverted", "medium", ["85%", "warning-foreground", undefined, 217.6, "warning"]],
  ["inverted", "full", ["100%", "success", undefined, 256, "success"]],
  ["inverted", "exceeded", ["100%", "error", undefined, 256, "error"]],
  ["success-only-when-full", "low", ["50%", "error", "Warning", 128, "error"]],
  ["success-only-when-full", "medium", ["85%", "error", "Warning", 217.6, "error"]],
  ["success-only-when-full", "full", ["100%", "success", "CheckCircle", 256, "success"]],
  ["success-only-when-full", "exceeded", ["100%", "error", "Warning", 256, "error"]],
  ["neutral", "low", ["50%", "foreground", undefined, 128, "primary"]],
  ["neutral", "medium", ["85%", "foreground", undefined, 217.6, "primary"]],
  ["neutral", "full", ["100%", "foreground", undefined, 256, "primary"]],
  ["neutral", "exceeded", ["100%", "foreground", undefined, 256, "primary"]],
];

/** A cell's face as the built root draws it. */
function faceOf(root: ComponentRootSpec): Face {
  const [header, bar] = root.children;
  const value = header?.kind === "frame" ? header.children[1] : undefined;
  const layers = value?.kind === "frame" ? value.children : [];
  const text = layers.find((layer) => layer.kind === "text");
  const icon = layers.find((layer) => layer.kind === "icon");
  const fill = bar?.kind === "frame" ? bar.children[0] : undefined;
  const box = fill?.kind === "frame" ? fill : undefined;
  const width = box === undefined ? undefined : fixedLength(box.sizing.horizontal);
  const name = (color: FillSpec | undefined) => (color?.kind === "variable" ? color.variable.name : "");
  return [
    text?.characters ?? "",
    name(text?.color),
    icon?.icon.replace("icon/", ""),
    width?.kind === "literal" ? width.value : Number.NaN,
    name(box?.fill),
  ];
}

describe("the Meter component set", () => {
  it("holds 4 modes at the docs Modes demo's 4 levels, with columns by level, one Label property and no swap", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "meter");
    expect(set?.axes).toEqual([
      { name: "mode", values: ["default", "inverted", "success-only-when-full", "neutral"] },
      { name: "level", values: ["low", "medium", "full", "exceeded"] },
    ]);
    expect(set?.columnAxis).toBe("level");
    expect(new Set(set?.variants.map((cell) => cell.key)).size).toBe(16);
    expect([set?.textProperties, set?.swapProperties]).toEqual([
      [{ name: "Label", defaultValue: "Storage used" }],
      [],
    ]);
  });

  it("draws the default meter at 85% as a column of the spaced header and the bar holding an absolute fill", () => {
    expect(meter("default", "medium")).toEqual(DEFAULT_MEDIUM);
  });

  it.each(FACES)("draws %s at %s with the tone's value text, icon and fill", (mode, level, face) => {
    expect(faceOf(meter(mode, level))).toEqual(face);
  });

  it("keeps the value one space after an icon and drops the gap where no icon shows", () => {
    const gap = (mode: string, level: string) => {
      const [header] = meter(mode, level).children;
      const value = header?.kind === "frame" ? header.children[1] : undefined;
      return value?.kind === "frame" ? value.itemSpacing : undefined;
    };
    expect([gap("default", "full"), gap("success-only-when-full", "full"), gap("default", "low")]).toEqual([
      literal(SPACE),
      literal(SPACE),
      literal(0),
    ]);
  });

  it("reads Base UI's inline style on the fill, over its h-full and left-0", () => {
    const fillRows = coverage.filter((row) => row.component === "Meter" && row.part === "meter-bar-fill");
    const inline = new Set(
      fillRows
        .filter((row) => row.className === "inline style")
        .map((row) => `${row.property} ${row.value}: ${row.outcome}, ${row.detail}`)
    );
    expect(inline).toEqual(
      new Set([
        "width 50%: literal, 128px, 50% of the parent's width",
        "width 85%: literal, 217.6px, 85% of the parent's width",
        "width 100%: literal, 256px, the parent's width that 100% takes",
        "height inherit: literal, 6px",
        "left 0: literal, an absolute layer at its parent's top left, which keeps its share of the parent's width and stretches with its height",
      ])
    );
    expect(fillRows.filter((row) => row.className === "h-full" || row.className === "left-0")).toEqual([]);
  });

  it("drops what Figma draws no field for: the forced-colors fill, the transparent outline and the icon's text-bottom", () => {
    const reasons = (className: string) =>
      new Set(
        coverage
          .filter((row) => row.component === "Meter" && row.className === className)
          .map((row) => `${row.property}: ${row.outcome}`)
      );
    expect(reasons("forced-colors:bg-[Highlight]")).toEqual(new Set(["background-color: dropped"]));
    expect(reasons("outline-1")).toEqual(new Set(["outline-style: dropped", "outline-width: dropped"]));
    expect(reasons("-outline-offset-1")).toEqual(new Set(["outline-offset: dropped"]));
    expect(reasons("outline-transparent")).toEqual(new Set(["outline-color: dropped"]));
    expect(reasons("align-text-bottom")).toEqual(new Set(["vertical-align: dropped"]));
    expect(reasons("inline-block")).toEqual(new Set(["display: literal"]));
    expect(coverage.filter((row) => row.component === "Meter" && row.outcome === "unmapped")).toEqual([]);
  });
});
