/**
 * Unit under test: the corners and the stroke's side weights a captured box's spec draws, as
 * `figma:capture` captures the box and the build reads it, where the box sets a corner or a border
 * side by its logical name.
 * Oracle: Chromium's computed physical `border-*-radius` and `border-*-width` longhands of the same
 * box on the same page, in every mode a designer can pick. A logical corner or side lands on a
 * physical one by the box's `direction` and `writing-mode` (CSS Logical Properties 1 §4, §6.2), which
 * a `dir` attribute on an ancestor sets as well as a declaration, and a rule of one mode as well as
 * one of every mode. So every corner and side the spec maps must be the one Chromium computes in each
 * mode. A box whose logical corners or sides Chromium puts elsewhere than on a left-to-right,
 * horizontal page in some mode maps none of them, and draws the edges a box with none of them mapped
 * draws. Each row pins the tuples Chromium computes across the modes and what the build must do with
 * them, each by hand from CSS Logical Properties 1, with the box's flow in each mode, so a fixture
 * whose rule stops matching fails rather than pass as a left-to-right control. The held rows build a
 * box around a hidden part, whose size the spec holds only where every side's width is known, against
 * the size Chromium lays the box out at in each mode.
 */
import { createElement as h } from "react";
import type { CSSProperties, ReactElement } from "react";

import { Effect } from "effect";
import { beforeAll, describe, expect, it } from "vitest";

import { chip, part } from "../../test/capture-fixtures.ts";
import { compileFixture } from "../../test/utility-rules.ts";
import type { FixtureCompile } from "../../test/utility-rules.ts";
import { manifestDefinition } from "../capture/manifest.ts";
import { EVERY_MODE } from "../capture/page-modes.ts";
import { CAPTURE_THEME, captureSet, requestOf } from "../capture/run-capture.ts";
import { CompareBrowser } from "../compare/browser-render.ts";
import type { CellRenderer } from "../compare/cell-renderers.ts";
import { PAGE_LAYOUT } from "../compare/preview-page.ts";
import { buildSetsInOrder } from "./component-builder.ts";
import { cornerLengths } from "./corner-spec.ts";
import { makeVariableIndex } from "./css-values.ts";
import { sideWeights, STROKE_SIDES } from "./kit-spec.ts";
import type { ComponentRootSpec, NumberSpec, SizingSpec } from "./kit-spec.ts";

/** A box's corners or its border sides: the physical longhands Chromium computes, in Figma's order. */
type Edges = {
  readonly longhands: readonly string[];
  /** Whether a coverage row's property sets one of the edges. */
  readonly declares: (property: string) => boolean;
  /** What the spec's root draws on each edge, in pixels. */
  readonly drawn: (root: ComponentRootSpec) => readonly number[];
  /** What a root of the rows' boxes draws on each edge, in pixels, where the build maps none. */
  readonly unmapped: readonly number[];
};

/** A spec number in pixels, NaN where it binds a variable. */
const pixels = (length: NumberSpec | undefined): number =>
  length?.kind === "literal" ? length.value : Number.NaN;

const CORNERS: Edges = {
  longhands: [
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-right-radius",
    "border-bottom-left-radius",
  ],
  declares: (property) => property.endsWith("radius"),
  drawn: (root) => {
    const lengths = cornerLengths(root.cornerRadius);
    return [0, 1, 2, 3].map((index) => pixels(lengths.length === 1 ? lengths[0] : lengths[index]));
  },
  unmapped: [0, 0, 0, 0],
};

const SIDES: Edges = {
  longhands: ["border-top-width", "border-right-width", "border-bottom-width", "border-left-width"],
  declares: (property) => property.startsWith("border") && !property.endsWith("radius"),
  drawn: (root) => {
    const weights = root.stroke === undefined ? undefined : sideWeights(root.stroke);
    return STROKE_SIDES.map((side) => (weights === undefined ? 0 : pixels(weights[side])));
  },
  // No stroke: where no side of the box maps, none of its border declarations does, the
  // `border-width` the capture splits into the sides it wins among them.
  unmapped: [0, 0, 0, 0],
};

/** The page's sheets: none, since each box states its style inline. */
const ASSETS = {
  styles: "",
  themes: "",
  preflight: "",
  fontCss: "",
  fontDirectories: new Map(),
  fontPackages: [],
  hostCss: "",
  client: "",
};

/** A 36px square that rounds every corner by 4px and its start-start corner by 8px. */
const ROUNDED: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 4,
  borderStartStartRadius: 8,
};

/** A 36px square with a 1px black border, which `border-s-0` takes from its inline-start side. */
const START_BARE: CSSProperties = {
  width: 36,
  height: 36,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#000000",
  borderInlineStartWidth: 0,
};

/** A 36px square with a 1px black border on every side. */
const BORDERED: CSSProperties = {
  width: 36,
  height: 36,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#000000",
};

/** Why the build leaves a box's logical corners unmapped where they lie elsewhere. */
const TURNED_CORNERS =
  "the box lays out other than left to right in horizontal lines, which puts its logical corners elsewhere than the capture reads them";

/** Why the build leaves a box's physical corners unmapped beside a logical one that lies elsewhere. */
const OTHER_CORNER = "another of the box's corners does not map, so none of its corners does";

/** Why the build leaves a box's logical border sides unmapped where they lie elsewhere. */
const TURNED_SIDES =
  "the box lays out other than left to right in horizontal lines, which puts its logical sides elsewhere than the capture reads them";

/** Why the build leaves a box's physical border sides unmapped beside a logical one that lies elsewhere. */
const OTHER_SIDE = "a flow-relative side of the box does not map, so none of its sides does";

/**
 * What the build must do with a row's edges: draw them as Chromium computes them in every mode, each
 * declaration of them read as a literal, or map none of them, each declaration unmapped with its
 * reason, by property.
 */
type Outcome =
  | { readonly kind: "mapped"; readonly drawn: readonly number[]; readonly properties: readonly string[] }
  | { readonly kind: "unmapped"; readonly notes: readonly (readonly [string, string])[] };

/** A box as its row renders it: the chip root, or the chip inside an element around it. */
type Row = {
  readonly name: string;
  readonly element: () => ReactElement;
  /** The host's sheet on the page, where a rule of one mode styles the box. */
  readonly hostCss?: string;
  readonly edges: Edges;
  /**
   * The box's computed `direction` and `writing-mode`, once for each distinct reading across the
   * modes, so a row whose rule stops matching fails rather than pass as a left-to-right control.
   */
  readonly flows: readonly string[];
  /** The four edges, in pixels, that Chromium computes, once for each distinct reading across the modes. */
  readonly chromium: readonly (readonly number[])[];
  readonly outcome: Outcome;
};

/** The flows a row's box takes, as `direction writing-mode`. */
const LTR = "ltr horizontal-tb";
const RTL = "rtl horizontal-tb";
const VERTICAL = "ltr vertical-rl";

const chipRoot = (style: CSSProperties): ReactElement => h("div", { "data-slot": "chip", style });

/** A 36px square that rounds every corner by 4px. */
const FOUR: CSSProperties = { width: 36, height: 36, borderRadius: 4 };

const ROWS: readonly Row[] = [
  {
    name: "a left-to-right box",
    element: () => chipRoot(ROUNDED),
    edges: CORNERS,
    flows: [LTR],
    chromium: [[8, 4, 4, 4]],
    outcome: {
      kind: "mapped",
      drawn: [8, 4, 4, 4],
      properties: [
        "border-bottom-left-radius",
        "border-bottom-right-radius",
        "border-start-start-radius",
        "border-top-right-radius",
      ],
    },
  },
  {
    // Right to left, `border-start-start-radius` rounds the top right (CSS Logical Properties 1 §6.2).
    name: "a box below an ancestor's dir=rtl",
    element: () => h("div", { dir: "rtl" }, chipRoot(ROUNDED)),
    edges: CORNERS,
    flows: [RTL],
    chromium: [[4, 8, 4, 4]],
    outcome: {
      kind: "unmapped",
      notes: [
        ["border-bottom-left-radius", OTHER_CORNER],
        ["border-bottom-right-radius", OTHER_CORNER],
        ["border-start-start-radius", TURNED_CORNERS],
        ["border-top-right-radius", OTHER_CORNER],
      ],
    },
  },
  {
    name: "a box of direction: rtl",
    element: () => chipRoot({ ...ROUNDED, direction: "rtl" }),
    edges: CORNERS,
    flows: [RTL],
    chromium: [[4, 8, 4, 4]],
    outcome: {
      kind: "unmapped",
      notes: [
        ["border-bottom-left-radius", OTHER_CORNER],
        ["border-bottom-right-radius", OTHER_CORNER],
        ["border-start-start-radius", TURNED_CORNERS],
        ["border-top-right-radius", OTHER_CORNER],
      ],
    },
  },
  {
    // The capture's left-to-right cascade gives the top left to the later physical corner and drops
    // the logical one, which Chromium puts on the top right.
    name: "a box of direction: rtl whose physical corner follows its logical one",
    element: () =>
      chipRoot({
        width: 36,
        height: 36,
        direction: "rtl",
        borderStartStartRadius: 8,
        borderTopLeftRadius: 2,
      }),
    edges: CORNERS,
    flows: [RTL],
    chromium: [[2, 8, 0, 0]],
    outcome: { kind: "unmapped", notes: [["border-top-left-radius", TURNED_CORNERS]] },
  },
  {
    // The left-to-right cascade gives `border-radius` the top right, where Chromium puts the logical
    // corner, so the capture cannot check that corner's winner against the browser. The capture splits
    // `border-radius` into the corners it wins there, the top right among them.
    name: "a box of direction: rtl whose physical corner follows its logical one over border-radius",
    element: () => chipRoot({ ...ROUNDED, direction: "rtl", borderTopLeftRadius: 2 }),
    edges: CORNERS,
    flows: [RTL],
    chromium: [[2, 8, 4, 4]],
    outcome: {
      kind: "unmapped",
      notes: [
        ["border-bottom-left-radius", TURNED_CORNERS],
        ["border-bottom-right-radius", TURNED_CORNERS],
        ["border-top-left-radius", TURNED_CORNERS],
        ["border-top-right-radius", TURNED_CORNERS],
      ],
    },
  },
  {
    // Under `vertical-rl` the block start is the right and the inline start the top, so
    // `border-start-start-radius` rounds the top right.
    name: "a box of writing-mode: vertical-rl",
    element: () => chipRoot({ ...ROUNDED, writingMode: "vertical-rl" }),
    edges: CORNERS,
    flows: [VERTICAL],
    chromium: [[4, 8, 4, 4]],
    outcome: {
      kind: "unmapped",
      notes: [
        ["border-bottom-left-radius", OTHER_CORNER],
        ["border-bottom-right-radius", OTHER_CORNER],
        ["border-start-start-radius", TURNED_CORNERS],
        ["border-top-right-radius", OTHER_CORNER],
      ],
    },
  },
  {
    // The capture reads the box's rules in its own mode, where the dark rule matches nothing.
    name: "a box a dark rule turns right to left and rounds by its start-start corner",
    element: () => chipRoot(FOUR),
    hostCss:
      '[data-theme="dark"] [data-slot="chip"] { direction: rtl; border-start-start-radius: 8px !important; }',
    edges: CORNERS,
    flows: [LTR, RTL],
    chromium: [
      [4, 4, 4, 4],
      [4, 8, 4, 4],
    ],
    outcome: { kind: "unmapped", notes: [["border-radius", TURNED_CORNERS]] },
  },
  {
    // The dark rule turns the box, and no rule sets a corner by its logical name, so the corners lie
    // where the capture reads them in every mode.
    name: "a box a dark rule turns right to left, with physical corners alone",
    element: () => chipRoot(FOUR),
    hostCss: '[data-theme="dark"] [data-slot="chip"] { direction: rtl; }',
    edges: CORNERS,
    flows: [LTR, RTL],
    chromium: [[4, 4, 4, 4]],
    outcome: { kind: "mapped", drawn: [4, 4, 4, 4], properties: ["border-radius"] },
  },
  {
    // A rule under a media query the page never matches applies in no mode the capture stamps, so the
    // box's logical corner is no corner of its own, and its physical corners lie where it reads them.
    name: "a right-to-left box whose print rule rounds its start-start corner",
    element: () => chipRoot({ ...FOUR, direction: "rtl" }),
    hostCss: '@media print { [data-slot="chip"] { border-start-start-radius: 8px !important; } }',
    edges: CORNERS,
    flows: [RTL],
    chromium: [[4, 4, 4, 4]],
    outcome: { kind: "mapped", drawn: [4, 4, 4, 4], properties: ["border-radius"] },
  },
  {
    // CSSOM keeps declarations inside an at-rule nested in a style rule as a rule of their own.
    name: "a box a dark rule's nested @media turns right to left and rounds by its start-start corner",
    element: () => chipRoot(FOUR),
    hostCss:
      '[data-theme="dark"] [data-slot="chip"] { @media all { direction: rtl; border-start-start-radius: 8px !important; } }',
    edges: CORNERS,
    flows: [LTR, RTL],
    chromium: [
      [4, 4, 4, 4],
      [4, 8, 4, 4],
    ],
    outcome: { kind: "unmapped", notes: [["border-radius", TURNED_CORNERS]] },
  },
  {
    name: "a box a dark rule's nested @media turns right to left",
    element: () => chipRoot(ROUNDED),
    hostCss: '[data-theme="dark"] [data-slot="chip"] { @media all { direction: rtl; } }',
    edges: CORNERS,
    flows: [LTR, RTL],
    chromium: [
      [8, 4, 4, 4],
      [4, 8, 4, 4],
    ],
    outcome: {
      kind: "unmapped",
      notes: [
        ["border-bottom-left-radius", OTHER_CORNER],
        ["border-bottom-right-radius", OTHER_CORNER],
        ["border-start-start-radius", TURNED_CORNERS],
        ["border-top-right-radius", OTHER_CORNER],
      ],
    },
  },
  {
    name: "a left-to-right box's border-s-0",
    element: () => chipRoot(START_BARE),
    edges: SIDES,
    flows: [LTR],
    chromium: [[1, 1, 1, 0]],
    outcome: {
      kind: "mapped",
      drawn: [1, 1, 1, 0],
      properties: [
        "border-bottom-width",
        "border-color",
        "border-inline-start-width",
        "border-right-width",
        "border-style",
        "border-top-width",
      ],
    },
  },
  {
    // Right to left, `border-inline-start-width` sets the right side (CSS Logical Properties 1 §4).
    name: "a box below an ancestor's dir=rtl, with border-s-0",
    element: () => h("div", { dir: "rtl" }, chipRoot(START_BARE)),
    edges: SIDES,
    flows: [RTL],
    chromium: [[1, 0, 1, 1]],
    outcome: {
      kind: "unmapped",
      notes: [
        ["border-bottom-width", OTHER_SIDE],
        ["border-color", OTHER_SIDE],
        ["border-inline-start-width", TURNED_SIDES],
        ["border-right-width", OTHER_SIDE],
        ["border-style", OTHER_SIDE],
        ["border-top-width", OTHER_SIDE],
      ],
    },
  },
  {
    name: "a box of direction: rtl's border-s-0",
    element: () => chipRoot({ ...START_BARE, direction: "rtl" }),
    edges: SIDES,
    flows: [RTL],
    chromium: [[1, 0, 1, 1]],
    outcome: {
      kind: "unmapped",
      notes: [
        ["border-bottom-width", OTHER_SIDE],
        ["border-color", OTHER_SIDE],
        ["border-inline-start-width", TURNED_SIDES],
        ["border-right-width", OTHER_SIDE],
        ["border-style", OTHER_SIDE],
        ["border-top-width", OTHER_SIDE],
      ],
    },
  },
  {
    // The capture's mode reads only the border's own declarations, which win every side there.
    name: "a box a dark rule turns right to left and takes the width of its inline-start side",
    element: () => chipRoot(BORDERED),
    hostCss:
      '[data-theme="dark"] [data-slot="chip"] { direction: rtl; border-inline-start-width: 0 !important; }',
    edges: SIDES,
    flows: [LTR, RTL],
    chromium: [
      [1, 1, 1, 1],
      [1, 0, 1, 1],
    ],
    outcome: {
      kind: "unmapped",
      notes: [
        ["border-color", TURNED_SIDES],
        ["border-style", TURNED_SIDES],
        ["border-width", TURNED_SIDES],
      ],
    },
  },
  {
    // A print rule applies in no mode the capture stamps, so the box sets no side by its logical name.
    name: "a right-to-left box whose print rule takes the width of its inline-start side",
    element: () => chipRoot({ ...BORDERED, direction: "rtl" }),
    hostCss: '@media print { [data-slot="chip"] { border-inline-start-width: 0 !important; } }',
    edges: SIDES,
    flows: [RTL],
    chromium: [[1, 1, 1, 1]],
    outcome: {
      kind: "mapped",
      drawn: [1, 1, 1, 1],
      properties: ["border-color", "border-style", "border-width"],
    },
  },
];

/** The renderer of a row's box. */
const rendererOf = (row: Row): CellRenderer => ({
  set: "chip",
  entry: "dist/button.js",
  element: row.element,
});

/** What a row's spec draws and Chromium computes. */
type Reading = {
  /** The four edges the spec's root draws, in pixels, or undefined where the build drew no root. */
  readonly drawn: readonly number[] | undefined;
  /** Each declaration the box makes of the row's edges, as its property, outcome and detail, by property. */
  readonly notes: readonly (readonly [string, string, string])[];
  /** The four edges Chromium computes, in pixels, once for each distinct reading across the modes. */
  readonly chromium: readonly (readonly number[])[];
  /** The box's flow Chromium computes, once for each distinct reading across the modes. */
  readonly flows: readonly string[];
};

/** Capture and build a row's box on a browser, and read the edges Chromium computes for it in every mode. */
function read(
  browser: CompareBrowser,
  row: Row,
  compiled: FixtureCompile["compiled"]
): Effect.Effect<Reading, unknown> {
  const renderer = rendererOf(row);
  const target = chip();
  return Effect.gen(function* () {
    const capture = yield* captureSet(browser, target, renderer);
    const chromium = yield* browser.openPreview(
      CAPTURE_THEME,
      [requestOf(target, renderer, { state: "rest" }, 0)],
      PAGE_LAYOUT,
      (opened) =>
        opened.page.evaluate(
          ({ longhands, modes }) => {
            const box = document.querySelector('[data-slot="chip"]');
            const readings = new Set<string>();
            const flows = new Set<string>();
            for (const mode of modes) {
              for (const [name, value] of Object.entries(mode.root)) {
                document.documentElement.setAttribute(name, value);
              }
              for (const [name, value] of Object.entries(mode.body)) {
                document.body.setAttribute(name, value);
              }
              const style = box === null ? undefined : getComputedStyle(box);
              flows.add(`${style?.direction ?? ""} ${style?.writingMode ?? ""}`);
              readings.add(
                JSON.stringify(
                  longhands.map((longhand) => Number.parseFloat(style?.getPropertyValue(longhand) ?? ""))
                )
              );
            }
            return { readings: [...readings], flows: [...flows] };
          },
          { longhands: row.edges.longhands, modes: EVERY_MODE }
        )
    );
    const [built] = buildSetsInOrder([{ definition: manifestDefinition(target), capture }], {
      compiled,
      variables: makeVariableIndex([]),
    });
    const root = built?.componentSet.variants[0]?.root;
    return {
      drawn: root === undefined ? undefined : row.edges.drawn(root),
      notes: (built?.coverage ?? [])
        .filter((each) => row.edges.declares(each.property))
        .map((each) => [each.property, each.outcome, each.detail] as const)
        .toSorted(([left], [right]) => left.localeCompare(right)),
      // SAFETY: each reading is the JSON of an array of numbers, which the page function wrote.
      chromium: chromium.readings.map((each) => JSON.parse(each) as readonly number[]),
      flows: chromium.flows,
    };
  });
}

/**
 * Read every row, the rows of one host sheet on one browser, at most two browsers at once: a launch
 * per row at once timed out the hook on a loaded Linux host.
 */
async function readAll(rows: readonly Row[]): Promise<ReadonlyMap<Row, Reading>> {
  const { compiled } = await compileFixture([]);
  const groups = [...Map.groupBy(rows, (row) => row.hostCss ?? "")];
  const read$ = Effect.forEach(
    groups,
    ([hostCss, owned]) =>
      Effect.scoped(
        Effect.gen(function* () {
          const browser = yield* CompareBrowser.launch({ ...ASSETS, hostCss });
          return yield* Effect.forEach(owned, (row) =>
            read(browser, row, compiled).pipe(Effect.map((reading) => [row, reading] as const))
          );
        })
      ),
    { concurrency: 2 }
  );
  return new Map((await Effect.runPromise(read$)).flat());
}

describe("a box's logical corners and sides", () => {
  let readings: ReadonlyMap<Row, Reading>;

  beforeAll(async () => {
    readings = await readAll(ROWS);
  });

  it.each(ROWS.map((row) => [row.name, row] as const))(
    "draws %s's edges where Chromium does, or maps none",
    (_, row) => {
      const reading = readings.get(row);
      const { outcome } = row;
      expect({
        flows: reading?.flows,
        chromium: reading?.chromium,
        drawn: reading?.drawn,
        notes:
          outcome.kind === "mapped"
            ? reading?.notes.map(([property, each]) => [property, each])
            : reading?.notes,
      }).toEqual({
        flows: row.flows,
        chromium: row.chromium,
        drawn: outcome.kind === "mapped" ? outcome.drawn : row.edges.unmapped,
        notes:
          outcome.kind === "mapped"
            ? outcome.properties.map((property) => [property, "literal"])
            : outcome.notes.map(([property, detail]) => [property, "unmapped", detail]),
      });
    }
  );
});

/**
 * A box around a hidden part whose logical border side lies elsewhere by one declaration of one mode.
 * The build holds a box around a hidden part at its size where every side's width is known, which a
 * logical width or style lying elsewhere leaves unknown, and a logical color does not.
 */
type HeldRow = {
  readonly name: string;
  /** The host's sheet, whose rule styles the box in some modes. */
  readonly hostCss: string;
  /** The box's own style beside its `inline-flex` and 2px padding around the 8px part. */
  readonly style: CSSProperties;
  readonly flows: readonly string[];
  /** The box's width and height, in pixels, that Chromium lays out, once for each distinct reading across the modes. */
  readonly sizes: readonly (readonly [number, number])[];
  /** What the build makes of the box: held at 12px around the hidden part, or a hug that leaves the part's `visibility` unmapped. */
  readonly built: "held" | "hug";
  /** The note on the box's `background-clip: padding-box`, as its outcome and detail, or `unset` for a box that sets none. */
  readonly clip: readonly [string, string] | "unset";
};

/** Why the build leaves a box's `background-clip` unmapped where a logical style leaves its widths unknown. */
const CLIP_STYLES_ELSEWHERE =
  "the box lays out other than left to right in horizontal lines, which puts its logical side styles elsewhere than the capture reads them, so the kit cannot tell where its padding box starts";

const HELD_ROWS: readonly HeldRow[] = [
  {
    // A color moves no width: every side computes 0px in every mode.
    name: "a right-to-left box a dark rule colors on its inline-start side",
    hostCss: '[data-theme="dark"] [data-slot="chip"] { border-inline-start-color: #ff0000; }',
    style: { direction: "rtl" },
    flows: [RTL],
    sizes: [[12, 12]],
    built: "held",
    clip: "unset",
  },
  {
    name: "a right-to-left box a print rule gives a 3px inline-start side",
    hostCss:
      '@media print { [data-theme="dark"] [data-slot="chip"] { border-inline-start: 3px solid #ff0000; } }',
    style: { direction: "rtl" },
    flows: [RTL],
    sizes: [[12, 12]],
    built: "held",
    clip: "unset",
  },
  {
    // Right to left, the dark rule's 3px lands on the right side (CSS Logical Properties 1 §4).
    name: "a right-to-left box a dark rule gives a 3px inline-start side",
    hostCss: '[data-theme="dark"] [data-slot="chip"] { border-inline-start: 3px solid #ff0000; }',
    style: { direction: "rtl" },
    flows: [RTL],
    sizes: [
      [12, 12],
      [15, 12],
    ],
    built: "hug",
    clip: "unset",
  },
  {
    // A solid style gives the 3px width its side, the top under `vertical-rl`, where a `none` style
    // computed it to 0 (CSS Backgrounds 3 §4.3).
    name: "a vertical box a dark rule styles solid on its inline-start side",
    hostCss:
      '[data-slot="chip"] { border: 3px none #ff0000; } [data-theme="dark"] [data-slot="chip"] { border-inline-start-style: solid; }',
    style: { writingMode: "vertical-rl" },
    flows: [VERTICAL],
    sizes: [
      [12, 12],
      [12, 15],
    ],
    built: "hug",
    clip: "unset",
  },
  {
    // A style moves no width where every side's width is 0, as preflight's `border: 0 solid` leaves it.
    name: "a right-to-left box of no border width a dark rule styles dashed on its inline-start side",
    hostCss:
      '[data-slot="chip"] { border: 0 solid #ff0000; } [data-theme="dark"] [data-slot="chip"] { border-inline-start-style: dashed; }',
    style: { direction: "rtl", backgroundColor: "#ffffff", backgroundClip: "padding-box" },
    flows: [RTL],
    sizes: [[12, 12]],
    built: "held",
    clip: ["dropped", "the box has no border, so its padding box is its border box"],
  },
  {
    // Right to left, the dark rule's solid inline-start style gives its 3px width the right side,
    // where every side computes 0px in light (CSS Backgrounds 3 §4.3). The light declarations are
    // all 0, so only the dark mode's used widths show the style draws a side.
    name: "a right-to-left box of no border width a dark rule gives a width and a solid inline-start style",
    hostCss:
      '[data-slot="chip"] { border: 0 none transparent; } [data-theme="dark"] [data-slot="chip"] { border-width: 3px; border-inline-start-style: solid; }',
    style: { direction: "rtl", backgroundColor: "#ffffff", backgroundClip: "padding-box" },
    flows: [RTL],
    sizes: [
      [12, 12],
      [15, 12],
    ],
    built: "hug",
    clip: ["unmapped", CLIP_STYLES_ELSEWHERE],
  },
  {
    // Under `vertical-rl` the box's own `border-inline-start-style: none` zeroes its top side, where
    // the capture's left-to-right page zeroes the left, which would hold it 15px by 18px.
    name: "a vertical box whose own rule takes the style of its inline-start side",
    hostCss: '[data-slot="chip"] { border: 3px solid #ff0000; border-inline-start-style: none; }',
    style: { writingMode: "vertical-rl" },
    flows: [VERTICAL],
    sizes: [[18, 15]],
    built: "hug",
    clip: "unset",
  },
];

/** What the build makes of a held row's box, and what Chromium lays out. */
type HeldReading = {
  readonly sizing: SizingSpec | undefined;
  /** The hidden part's `visibility` note, as its outcome. */
  readonly hidden: readonly string[];
  /** The box's `background-clip` notes, as outcome and detail. */
  readonly clip: readonly (readonly [string, string])[];
  readonly flows: readonly string[];
  readonly sizes: readonly (readonly [number, number])[];
};

/** Capture and build a held row's box on its own browser, and read what Chromium lays out in every mode. */
async function readHeld(row: HeldRow, compiled: FixtureCompile["compiled"]): Promise<HeldReading> {
  const target = chip({ parts: [part()] });
  const renderer: CellRenderer = {
    set: "chip",
    entry: "dist/button.js",
    element: () =>
      h(
        "div",
        { "data-slot": "chip", style: { display: "inline-flex", padding: 2, ...row.style } },
        h("div", { "data-slot": "chip-dot", style: { width: 8, height: 8, visibility: "hidden" } })
      ),
  };
  const read$ = Effect.gen(function* () {
    const browser = yield* CompareBrowser.launch({ ...ASSETS, hostCss: row.hostCss });
    const capture = yield* captureSet(browser, target, renderer);
    const page = yield* browser.openPreview(
      CAPTURE_THEME,
      [requestOf(target, renderer, { state: "rest" }, 0)],
      PAGE_LAYOUT,
      (opened) =>
        opened.page.evaluate((modes) => {
          const box = document.querySelector('[data-slot="chip"]');
          const sizes = new Set<string>();
          const flows = new Set<string>();
          for (const mode of modes) {
            for (const [name, value] of Object.entries(mode.root)) {
              document.documentElement.setAttribute(name, value);
            }
            for (const [name, value] of Object.entries(mode.body)) {
              document.body.setAttribute(name, value);
            }
            if (box instanceof HTMLElement) {
              const style = getComputedStyle(box);
              flows.add(`${style.direction} ${style.writingMode}`);
              sizes.add(JSON.stringify([box.offsetWidth, box.offsetHeight]));
            }
          }
          return { sizes: [...sizes], flows: [...flows] };
        }, EVERY_MODE)
    );
    const [built] = buildSetsInOrder([{ definition: manifestDefinition(target), capture }], {
      compiled,
      variables: makeVariableIndex([]),
    });
    return {
      sizing: built?.componentSet.variants[0]?.root.sizing,
      hidden: (built?.coverage ?? [])
        .filter((each) => each.property === "visibility")
        .map((each) => each.outcome),
      clip: (built?.coverage ?? [])
        .filter((each) => each.property === "background-clip")
        .map((each) => [each.outcome, each.detail] as const),
      flows: page.flows,
      // SAFETY: each size is the JSON of a pair of numbers, which the page function wrote.
      sizes: page.sizes.map((each) => JSON.parse(each) as readonly [number, number]),
    };
  });
  return Effect.runPromise(Effect.scoped(read$));
}

describe("a box's size around a hidden part where a logical border side lies elsewhere", () => {
  let readings: ReadonlyMap<HeldRow, HeldReading>;

  beforeAll(async () => {
    const { compiled } = await compileFixture([]);
    const read$ = Effect.forEach(
      HELD_ROWS,
      (row) => Effect.promise(async () => [row, await readHeld(row, compiled)] as const),
      { concurrency: 2 }
    );
    readings = new Map(await Effect.runPromise(read$));
  });

  const HELD = { kind: "fixed", length: { kind: "literal", value: 12 } } as const;
  it.each(HELD_ROWS.map((row) => [row.name, row] as const))("builds %s as Chromium lays it out", (_, row) => {
    expect(readings.get(row)).toEqual({
      sizing:
        row.built === "held"
          ? { horizontal: HELD, vertical: HELD }
          : { horizontal: { kind: "hug" }, vertical: { kind: "hug" } },
      hidden: [row.built === "held" ? "literal" : "unmapped"],
      clip: row.clip === "unset" ? [] : [row.clip],
      flows: row.flows,
      sizes: row.sizes,
    });
  });
});
