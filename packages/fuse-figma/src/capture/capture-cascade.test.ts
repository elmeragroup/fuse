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
 */
import { Effect } from "effect";
import { beforeAll, describe, expect, it } from "vitest";

import type { BuildContext } from "../components/component-spec.ts";
import { makeVariableIndex } from "../components/css-values.ts";
import { compileUtilities } from "../components/utility-css.ts";
import { CaptureSetCascade } from "./capture-cascade.ts";
import { CAPTURE_FORMAT, CAPTURE_VERSION } from "./capture-format.ts";
import type { CapturedDeclaration, CapturedElement, SetCapture } from "./capture-format.ts";
import { manifestDefinition } from "./manifest.ts";

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
  const declarations: CapturedDeclaration[] = [];
  const indexes = (own: Readonly<Record<string, string>>): number[] =>
    Object.entries(own).map(([property, value]) => declarations.push(declaration(property, value)) - 1);
  const around = [block({}), ...wrappers.map(block)].map((own, at) =>
    element(`wrapper-${String(at)}`, indexes(own))
  );
  const capture: SetCapture = {
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
        roots: [{ around, root: element("root", indexes(block({ height: "100%", ...root }))) }],
      },
    ],
  };
  const definition = manifestDefinition({
    key: "sample",
    name: "Sample",
    slot: "root",
    axes: [{ name: "state", values: ["rest"] }],
    columnAxis: "state",
    label: undefined,
    iconsFor: () => [],
    swapProperties: [],
  });
  const cascade = new CaptureSetCascade({
    capture,
    definition,
    context,
    record: () => undefined,
    captureOf: () => undefined,
    open: undefined,
    anchorWidth: () => undefined,
  });
  return cascade.cell({ state: "rest" }).root("root").heightBasis?.pixels;
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
