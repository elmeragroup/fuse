/**
 * Unit under test: the content height the capture cascade gives a root's `height: 100%` from the
 * elements around it (`CaptureBoxCascade.heightBasis`), read from a capture built by hand. Oracle:
 * Chromium's layout of the same elements in a block host, measured for review rounds 1 and 2 of B4b:
 * a 100px `border-box` wrapper with 10px padding above and below leaves its child 80px, a
 * `content-box` one 100px, a 100px flex row 100px, and a 200px item that neither grows nor shrinks
 * in a 100px flex column 200px. `max-height: 40px` under `height: 100px` leaves it 40px,
 * `min-height: 100px` over `height: 40px` 100px, and padding past a `border-box` height 0px. An
 * absolute root takes 100px in that padded relative wrapper, its padding box, and 200px under a
 * static 100px wrapper in a relative 200px one, and a 200px item a 100px flex column shrinks leaves
 * 100px. The cascade gives the measured basis where the used height is provably the declared one,
 * and none elsewhere, so the height stays unmapped rather than wrong.
 *
 * It also holds the root's fill from the elements around it (`CaptureCellCascade.backdrop`) to
 * Chromium's pixels of a fill-less root under an opaque red wrapper, read on 2026-11-18 for review
 * round 1 of B4: red through a transparent inner wrapper, a composite of two layers under a
 * translucent one or a background image, which one fill cannot draw, so the root takes none and the
 * rows stay unmapped. So does an opaque wrapper whose opacity, rounded corners, filter, clip path,
 * mask or blend mode changes how it paints, as review round 2 of B4 measured: at `opacity: 0.5`
 * Chromium paints the root (255, 127, 127) over white, and at a 20px radius its corner pixel white,
 * neither of which one opaque rectangular fill draws. The same effects on the root itself leave
 * Chromium's red behind it whole, (255, 0, 0) under a root at `opacity: 0.5`, which a fill on the
 * root would fade. A wrapper that does not lie exactly behind the root, as the capture's
 * `coincidingAround` measures it, gives none, and so does the root element of a set whose manifest
 * holds the root's set as an instance part, which draws that paint around its instances itself, as
 * the manifests' instance graph, `instancingSlots`, says. And it holds a `width: 100%` child alone in a box that
 * hugs it to Chromium's layout of a shrink-to-fit box around a 100%-wide child around a 256px list,
 * where the child is 256px, the list's width, which a hug draws, and to Chromium's widths of the same
 * box under its own `min-width: 400px` and `max-width: 120px`, 400px and 120px, which no hug of the
 * list draws, as review round 2 of B4 measured, so the child's width stays unmapped.
 */
import { Effect } from "effect";
import { beforeAll, describe, expect, it } from "vitest";

import { readBackdrop } from "../components/box-paint.ts";
import { buildComponentSet } from "../components/component-builder.ts";
import type { BuildContext } from "../components/component-spec.ts";
import type { CoverageRow } from "../components/coverage.ts";
import { makeVariableIndex } from "../components/css-values.ts";
import { instancingSlots } from "../components/definition-parts.ts";
import { compileUtilities } from "../components/utility-css.ts";
import { CaptureSetCascade } from "./capture-cascade.ts";
import { CAPTURE_FORMAT, CAPTURE_VERSION } from "./capture-format.ts";
import type { CapturedDeclaration, CapturedElement, SetCapture } from "./capture-format.ts";
import { manifestDefinition } from "./manifest.ts";
import type { SetManifest } from "./manifest.ts";

let context: BuildContext;

beforeAll(async () => {
  context = {
    compiled: await Effect.runPromise(compileUtilities([])),
    variables: makeVariableIndex([]),
    page: [],
    base: [],
  };
});

/** A declaration a class of the element itself wins. */
function declaration(property: string, value: string): CapturedDeclaration {
  return {
    property,
    value,
    important: false,
    longhands: [property],
    source: "fuse",
    layer: "",
    selector: ".sample",
    className: "sample",
    owner: 0,
  };
}

/** An element with a `data-slot` that wins the declarations at the given indexes. */
function element(slot: string, declarations: readonly number[]): CapturedElement {
  return {
    tag: "div",
    attributes: { "data-slot": slot },
    classes: ["sample"],
    text: "",
    declarations,
    initial: [],
    pseudo: {},
    variables: {},
    unmatched: [],
    children: [],
  };
}

/** A block `<div>`, as the browser's own style sheet displays one, with the declarations given. */
function block(own: Readonly<Record<string, string>>) {
  return { display: "block", ...own };
}

/**
 * The pixels of the content height a `height: 100%` root takes inside wrappers, outermost first,
 * in a block host, as a sample renders in the page: each element a block `<div>` unless it says
 * otherwise.
 */
function basisInside(
  wrappers: readonly Readonly<Record<string, string>>[],
  root: Readonly<Record<string, string>> = {}
): number | undefined {
  const capture = captureOf([{}, ...wrappers].map(block), block({ height: "100%", ...root }), 0);
  return cascadeOf(capture).cell({ state: "rest" }).root("root").heightBasis?.pixels;
}

describe("a root's 100% height inside the elements around it", () => {
  it("takes a border-box wrapper's height less its padding: 80px", () => {
    expect(
      basisInside([
        { height: "100px", "box-sizing": "border-box", "padding-top": "10px", "padding-bottom": "10px" },
      ])
    ).toBe(80);
  });

  it("takes a content-box wrapper's height whole: 100px", () => {
    expect(
      basisInside([
        { height: "100px", "box-sizing": "content-box", "padding-top": "10px", "padding-bottom": "10px" },
      ])
    ).toBe(100);
  });

  it("takes a flex row's height, its item's cross size: 100px", () => {
    expect(basisInside([{ display: "flex", height: "100px" }])).toBe(100);
  });

  it("takes a flex column item's height where it neither grows nor shrinks: 200px", () => {
    expect(
      basisInside([
        { display: "flex", "flex-direction": "column", height: "100px" },
        { height: "200px", "flex-grow": "0", "flex-shrink": "0" },
      ])
    ).toBe(200);
  });

  // Oracle: CSS Flexbox 1 §9.2 and §9.7. A flex basis other than `auto` is the item's main size,
  // which it keeps when both factors are 0, so Chromium gives this item and its root 50px, not 200px.
  it("takes none from a flex column item whose basis replaces its height, which Chromium sizes to 50px", () => {
    expect(
      basisInside([
        { display: "flex", "flex-direction": "column", height: "100px" },
        { height: "200px", "flex-basis": "50px", "flex-grow": "0", "flex-shrink": "0" },
      ])
    ).toBeUndefined();
  });

  it("takes none under a max-height, which Chromium lets cap the wrapper at 40px", () => {
    expect(basisInside([{ height: "100px", "max-height": "40px" }])).toBeUndefined();
  });

  it("takes none over a min-height, which Chromium lets raise the wrapper to 100px", () => {
    expect(basisInside([{ height: "40px", "min-height": "100px" }])).toBeUndefined();
  });

  it("takes none where the padding outgrows a border-box height, which Chromium floors at 0px", () => {
    expect(
      basisInside([
        { height: "10px", "box-sizing": "border-box", "padding-top": "5px", "padding-bottom": "15px" },
      ])
    ).toBeUndefined();
  });

  it("takes none for an absolute root, which Chromium sizes to its block's padding box: 100px", () => {
    expect(
      basisInside(
        [
          {
            position: "relative",
            height: "100px",
            "box-sizing": "border-box",
            "padding-top": "10px",
            "padding-bottom": "10px",
          },
        ],
        { position: "absolute" }
      )
    ).toBeUndefined();
  });

  it("takes none for an absolute root, which Chromium sizes to a farther positioned block: 200px", () => {
    expect(
      basisInside([{ position: "relative", height: "200px" }, { height: "100px" }], { position: "absolute" })
    ).toBeUndefined();
  });

  it("takes none from a flex column's item, which Chromium shrinks from 200px to 100px", () => {
    expect(
      basisInside([
        { display: "flex", "flex-direction": "column", height: "100px" },
        { height: "200px", "min-height": "0" },
      ])
    ).toBeUndefined();
  });
});

/** A capture of one cell whose root sits in wrappers, outermost first, each with its declarations. */
function captureOf(
  wrappers: readonly Readonly<Record<string, string>>[],
  root: Readonly<Record<string, string>>,
  coinciding: number,
  children: readonly { readonly slot: string; readonly declarations: Readonly<Record<string, string>> }[] = []
): SetCapture {
  const declarations: CapturedDeclaration[] = [];
  const indexes = (own: Readonly<Record<string, string>>): number[] =>
    Object.entries(own).map(([property, value]) => declarations.push(declaration(property, value)) - 1);
  const around = wrappers.map((own, at) => element(`wrapper-${String(at)}`, indexes(own)));
  // Each child holds the next, as a viewport holds a list.
  const below = children
    .toReversed()
    .reduce<CapturedElement[]>(
      (inside, { slot, declarations: own }) => [{ ...element(slot, indexes(own)), children: inside }],
      []
    );
  const measured = coinciding === 0 ? {} : { measured: { coincidingAround: coinciding } };
  return {
    format: CAPTURE_FORMAT,
    version: CAPTURE_VERSION,
    set: "sample",
    environment: { chromium: "", theme: "", locale: "" },
    page: [],
    declarations,
    cells: [
      {
        key: "sample/state=rest",
        cell: { state: "rest" },
        roots: [{ around, root: { ...element("root", indexes(root)), ...measured, children: below } }],
      },
    ],
  };
}

const MANIFEST: SetManifest = {
  key: "sample",
  name: "Sample",
  slot: "root",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
};

/** The cascade of a capture of the sample set, recording its coverage rows where asked. */
function cascadeOf(
  capture: SetCapture,
  instancedIn: ReadonlySet<string> = new Set(),
  record: (row: Omit<CoverageRow, "component">) => void = () => undefined
) {
  return new CaptureSetCascade({
    capture,
    definition: manifestDefinition(MANIFEST),
    context,
    record,
    captureOf: () => undefined,
    open: undefined,
    anchorWidth: () => undefined,
    instancedIn,
  });
}

/** The fill a fill-less root takes from its wrappers, and the rows of the wrappers' backgrounds. */
function backdropUnder(
  wrappers: readonly Readonly<Record<string, string>>[],
  coinciding: number,
  instancedIn: ReadonlySet<string> = new Set(),
  rootStyle: Readonly<Record<string, string>> = {}
) {
  const rows: Omit<CoverageRow, "component">[] = [];
  const cascade = cascadeOf(captureOf(wrappers, rootStyle, coinciding), instancedIn, (row) => {
    rows.push(row);
  });
  const cell = cascade.cell({ state: "rest" });
  const root = cell.root("root");
  const behind = cell.backdrop();
  const fill = behind === undefined ? undefined : readBackdrop(behind, root.style, context.variables);
  cell.settle();
  const unmapped = rows
    .filter((row) => row.outcome === "unmapped")
    .map((row) => row.property)
    .toSorted();
  return { fill, unmapped };
}

const RED = { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } };

describe("a fill-less root's fill from the elements behind it", () => {
  it("takes an opaque wrapper's red through a transparent one inside it, as Chromium paints", () => {
    expect(
      backdropUnder([{ "background-color": "#ff0000" }, { "background-color": "transparent" }], 2)
    ).toEqual({
      fill: RED,
      unmapped: [],
    });
  });

  it("takes none under a translucent wrapper, which Chromium composites over the red", () => {
    expect(
      backdropUnder([{ "background-color": "#ff0000" }, { "background-color": "rgb(0 0 255 / 0.5)" }], 2)
    ).toEqual({ fill: undefined, unmapped: ["background-color", "background-color"] });
  });

  it("takes none under a background image, which Chromium paints over the red", () => {
    expect(
      backdropUnder(
        [{ "background-color": "#ff0000" }, { "background-image": "linear-gradient(#0000ff, #0000ff)" }],
        2
      )
    ).toEqual({ fill: undefined, unmapped: ["background-color", "background-image"] });
  });

  it.each([
    ["an opacity of 0.5, which Chromium paints (255, 127, 127) over white", { opacity: "0.5" }],
    ["a 20px corner radius, which leaves Chromium's corner pixel white", { "border-radius": "20px" }],
    ["a filter", { filter: "blur(2px)" }],
    ["a clip path", { "clip-path": "inset(10px)" }],
    ["a mask", { "mask-image": "linear-gradient(#000, transparent)" }],
    ["a blend mode", { "mix-blend-mode": "multiply" }],
  ])("takes none from an opaque wrapper with %s, which one rectangular fill cannot draw", (_, effect) => {
    expect(backdropUnder([{ "background-color": "#ff0000", ...effect }], 1)).toEqual({
      fill: undefined,
      unmapped: ["background-color"],
    });
  });

  it.each([
    ["an opacity of 0.5, which would fade the red Chromium paints whole behind it", { opacity: "0.5" }],
    [
      "a backdrop filter, which would stop filtering the red once it becomes the root's own fill",
      { "backdrop-filter": "brightness(0)" },
    ],
    [
      "a 20px corner radius, which would round the red Chromium paints square behind it",
      { "border-radius": "20px" },
    ],
  ])("takes none from an opaque wrapper into a root with %s", (_, effect) => {
    // The cascade alone reads none of the root's own rows, so its effect's row is unmapped too.
    const { fill, unmapped } = backdropUnder([{ "background-color": "#ff0000" }], 1, new Set(), effect);
    expect(fill).toBeUndefined();
    expect(unmapped).toContain("background-color");
  });

  it("takes none from a wrapper that does not lie exactly behind the root", () => {
    expect(backdropUnder([{ "background-color": "#ff0000" }], 0)).toEqual({ fill: undefined, unmapped: [] });
  });
});

describe("a 100% wide box alone in a box that hugs it", () => {
  /** The root's and the viewport's horizontal sizing, and the outcome of the viewport's width row. */
  const hugged = (root: Readonly<Record<string, string>>) => {
    const capture = captureOf([], { display: "block", ...root }, 0, [
      { slot: "viewport", declarations: { display: "block", width: "100%" } },
      { slot: "list", declarations: { display: "block", width: "256px" } },
    ]);
    const manifest: SetManifest = {
      ...MANIFEST,
      parts: [
        {
          key: "viewport",
          slot: "viewport",
          shownIn: () => true,
          label: undefined,
          iconsFor: () => [],
          parts: [{ key: "list", slot: "list", shownIn: () => true, label: undefined, iconsFor: () => [] }],
        },
      ],
    };
    const built = buildComponentSet(manifestDefinition(manifest), context, new Map(), {
      capture,
      open: undefined,
      instancedIn: new Set(),
    });
    const hugRoot = built.componentSet.variants[0]?.root;
    const viewport = hugRoot?.children[0];
    const width = built.coverage.find((row) => row.part === "viewport" && row.property === "width");
    return [
      hugRoot?.sizing.horizontal.kind,
      viewport && "sizing" in viewport ? viewport.sizing.horizontal.kind : undefined,
      width?.outcome,
    ];
  };

  it("hugs, as wide as the 256px list it holds", () => {
    expect(hugged({})).toEqual(["hug", "hug", "literal"]);
  });

  it("stays unmapped where the box's min-width of 400px makes Chromium's 100% 400px, not the list's 256px", () => {
    expect(hugged({ "min-width": "400px" })[2]).toBe("unmapped");
  });

  it("stays unmapped where the box's max-width of 120px makes Chromium's 100% 120px, not the list's 256px", () => {
    expect(hugged({ "max-width": "120px" })[2]).toBe("unmapped");
  });
});

describe("a fill-less root's fill inside a set that holds it as an instance", () => {
  // The row's wrapper is `wrapper-0`, as `captureOf` names the outermost element around the root.
  const row: SetManifest = { ...MANIFEST, key: "row", name: "Row" };
  const popup: SetManifest = {
    ...MANIFEST,
    key: "popup",
    name: "Popup",
    slot: "wrapper-0",
    parts: [{ kind: "instance", key: "row", of: row, cell: () => ({ state: "rest" }), shownIn: () => true }],
  };

  it("takes none from the holder's root, which paints around the instance itself", () => {
    const holders = instancingSlots([manifestDefinition(row), manifestDefinition(popup)]);
    expect(backdropUnder([{ "background-color": "#ff0000" }], 1, holders.get(row.key))).toEqual({
      fill: undefined,
      unmapped: [],
    });
  });

  it("takes the red of an element that roots no set holding it, as Sidebar's wrapper roots none", () => {
    const holders = instancingSlots([manifestDefinition(row)]);
    expect(backdropUnder([{ "background-color": "#ff0000" }], 1, holders.get(row.key))).toEqual({
      fill: RED,
      unmapped: [],
    });
  });
  it("takes none where an outer set renames the root of the set that holds it", () => {
    // Outer paints red and stamps `wrapper-1` on its Middle instance, which holds Leaf, so in Leaf's
    // capture Middle's root is `wrapper-1` inside Outer's `wrapper-0`.
    const leaf: SetManifest = { ...MANIFEST, key: "leaf", name: "Leaf" };
    const middle: SetManifest = {
      ...MANIFEST,
      key: "middle",
      name: "Middle",
      slot: "middle",
      parts: [
        { kind: "instance", key: "leaf", of: leaf, cell: () => ({ state: "rest" }), shownIn: () => true },
      ],
    };
    const outer: SetManifest = {
      ...MANIFEST,
      key: "outer",
      name: "Outer",
      slot: "wrapper-0",
      parts: [
        {
          kind: "instance",
          key: "middle",
          of: middle,
          slot: "wrapper-1",
          cell: () => ({ state: "rest" }),
          shownIn: () => true,
        },
      ],
    };
    const holders = instancingSlots([leaf, middle, outer].map(manifestDefinition));
    expect(backdropUnder([{ "background-color": "#ff0000" }, {}], 2, holders.get(leaf.key))).toEqual({
      fill: undefined,
      unmapped: [],
    });
  });
});
