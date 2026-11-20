/**
 * The probe's reading of a box's widths. Unit under test: `inferKind`, `agrees` and, through
 * `contradictions`, the hug a kept width allows and the width a hug draws around fixed layers.
 * Oracle: the rules the README's `figma:probe` section states, applied by hand to boxes measured as
 * the named components measure, and Chromium's widths of built sets' samples under far longer text
 * on 2026-11-18: the Navigation menu popup stays 264px around its `w-64` list in every run, and a
 * Badge widens with its text. Review round 2 of B4 measured a 500px root that a hug of its 256px
 * child does not draw. The probe in the browser only goes red where a mapped kind contradicts what
 * it infers, so a rule that stops inferring would pass it silently; these cases hold what each rule
 * infers.
 */
import { Result } from "effect";
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import { buildCaptured, buildChip, chip, ICON, part, rest } from "../../test/capture-fixtures";
import type { BuiltFixture } from "../../test/capture-fixtures";
import { KEPT } from "../../test/probed-box";
import { densityLengths } from "../components/build-kit.ts";
import { NO_LIMITS } from "../components/kit-spec.ts";
import type {
  BoxSpec,
  ChildLayerSpec,
  ComponentRootSpec,
  ComponentSetSpec,
  FrameLayerSpec,
  IconLayerSpec,
  InstanceLayerSpec,
  NumberSpec,
  SizingSpec,
} from "../components/kit-spec.ts";
import type { ProbedBox } from "./perturbation.ts";
import { agrees, contradictions, inferKind, sizingReadsOf } from "./probe-sizing.ts";
import type { InferredKind, MappedWidth } from "./probe-sizing.ts";

describe("inferKind", () => {
  it.each<readonly [string, ProbedBox, InferredKind]>([
    ["a box that widens with its container fills it", { ...KEPT, wider: 220 }, "fill"],
    ["a box that widens with its text hugs it", { ...KEPT, longer: 180 }, "hug"],
    ["a box whose own text could widen it and did not is fixed", KEPT, "fixed"],
    [
      "a box whose text sits in a box of a set width, as an avatar's initials, reads as one without text",
      { ...KEPT, textReaches: false },
      "not-fill",
    ],
    [
      "a box whose only text is visually hidden, as Breadcrumb's ellipsis, does not read as tracking its parent",
      { ...KEPT, textReaches: false, parentWidened: false, tracksParent: true },
      "unknown",
    ],
    [
      "a box without text that kept its width in a parent that widened does not fill",
      { ...KEPT, text: false },
      "not-fill",
    ],
    [
      "a box without text as wide as a parent that kept its width, as an avatar's image, shows nothing",
      { ...KEPT, text: false, parentWidened: false, tracksParent: true },
      "unknown",
    ],
    [
      "a box without text narrower than a parent that kept its width does not fill it",
      { ...KEPT, text: false, parentWidened: false, tracksParent: false },
      "not-fill",
    ],
    [
      "a box whose root's container the probe left as it is shows nothing",
      { ...KEPT, text: false, widened: false },
      "unknown",
    ],
    // An inline-block with `min-width: 300px` measured 300px rendered and with its text longer, and
    // 600px with it far longer: an auto width held at a minimum grows with its text past it.
    [
      "a box its far longer text widened past the width it kept under longer text hugs its text",
      { ...KEPT, base: 300, wider: 300, longer: 300, longest: 600, capsAtParent: false },
      "hug",
    ],
    // The same inline-block in a 600px parent measured 300px, 300px and 600px, where far longer
    // text stops it at its parent's content box.
    [
      "a box its far longer text widened to the room its parent leaves it fits its text",
      { ...KEPT, base: 300, wider: 300, longer: 300, longest: 600, capsAtParent: true },
      "fits",
    ],
    // A box inside an inline-flex that holds text at `min-width: 300px` beside a 20px sibling
    // measured 320px rendered and with its text longer, and 4507px with it far longer in a 20000px
    // root, as `perturbation.chromium.test.ts` measures it. The text's own element kept its minimum
    // under the longer text, so the longer run reads as not reaching.
    [
      "a box its far longer text widened hugs its text where the longer run read as not reaching it",
      { ...KEPT, textReaches: false, base: 320, wider: 320, longer: 320, longest: 4507 },
      "hug",
    ],
  ])("%s", (_rule, box, kind) => {
    expect(inferKind(box)).toBe(kind);
  });
});

/** A layer's width as a plain frame in the flow decides it. */
const PLAIN: MappedWidth = {
  resizesWithParent: false,
  heldAtMaximum: false,
  hugWidth: "follows-text",
  fixedAtMeasuredWidth: false,
  cellFixedAtRenderedWidth: false,
};

describe("agrees", () => {
  it.each<readonly [string, InferredKind, "fixed" | "fill" | "hug", MappedWidth, boolean]>([
    ["a fixed layer below the root contradicts a box that fills", "fill", "fixed", PLAIN, false],
    [
      "a fixed absolute layer that scales with its parent, as Meter's fill, agrees with a box that fills",
      "fill",
      "fixed",
      { ...PLAIN, resizesWithParent: true },
      true,
    ],
    ["a filling layer contradicts a box that kept its width", "fixed", "fill", PLAIN, false],
    [
      "a filling layer held at its maximum, as Empty's content, agrees with a box that kept its width",
      "fixed",
      "fill",
      { ...PLAIN, heldAtMaximum: true },
      true,
    ],
    ["a filling layer contradicts a box that does not fill", "not-fill", "fill", PLAIN, false],
    ["a hugging layer contradicts a box that kept its width", "fixed", "hug", PLAIN, false],
    [
      "a hugging layer whose fixed layers draw the width the probe measured, as the Navigation menu popup round its w-64 list, agrees with a box that kept its width",
      "fixed",
      "hug",
      { ...PLAIN, hugWidth: "kept" },
      true,
    ],
    [
      "a layer fixed at the width the probe measured, which its text never widened, as a calendar day's button in the cell that hugs it, agrees with a box as wide as its parent",
      "tracks",
      "fixed",
      { ...PLAIN, fixedAtMeasuredWidth: true },
      true,
    ],
    [
      "a fixed layer at another width contradicts a box as wide as its parent",
      "tracks",
      "fixed",
      PLAIN,
      false,
    ],
  ])("%s", (_rule, inferred, mapped, width, agreed) => {
    const sizing =
      mapped === "fixed"
        ? { kind: mapped, length: { kind: "literal" as const, value: 100 } }
        : { kind: mapped };
    expect(agrees(inferred, sizing, false, width)).toBe(agreed);
  });
});

describe("a hug the probe measured at a kept width", () => {
  let built: BuiltSets;

  beforeAll(async () => {
    built = await builtKit();
  }, 120_000);

  /** What the probe finds against a set's first variant, whose root it measured at a kept width. */
  const foundAt = (key: string, width: number) => {
    const set = built.spec.componentSets.find((each) => each.key === key);
    const variant = set?.variants[0];
    if (set === undefined || variant === undefined) {
      throw new Error(`the kit builds no set ${key}`);
    }
    const root: ProbedBox = {
      ...KEPT,
      slot: variant.root.name,
      place: "0/root",
      root: true,
      base: width,
      wider: width,
      longer: width,
      longest: width,
    };
    return contradictions(
      set,
      new Map([[variant.key, { id: "cell", boxes: [root], gap: undefined }]]),
      built.drawn,
      sizingReadsOf(built.spec.componentSets, Result.getOrThrow(densityLengths("dense")))
    ).found.map(({ inferred, mapped }) => `${inferred} → ${mapped}`);
  };

  it("agrees with the Navigation menu popup, which hugs its w-64 list at the 264px Chromium measures", () => {
    expect(foundAt("navigation-menu-popup", 264)).toEqual([]);
  });

  it("contradicts the same hug where the probe measured the root at 500px, as an authored width holds it", () => {
    expect(foundAt("navigation-menu-popup", 500)).toEqual(["fixed → hug"]);
  });

  it("contradicts a Badge, which hugs its text, where the probe measured its width kept", () => {
    expect(foundAt("badge", 40)).toEqual(["fixed → hug"]);
  });
});

// Oracle: the probe's own runs. A calendar day's `size-9` button sits as wide as the cell that hugs
// it in every run; the fixed 36px the kit draws agrees only where the far longer text kept it at
// 36px too, since a box that grows with far longer text, as an auto width under a `min-width` does
// once its text passes the minimum, is no fixed layer.
describe("a fixed layer as wide as the parent that hugs it", () => {
  let built: BuiltSets;

  beforeAll(async () => {
    built = await builtKit();
  }, 120_000);

  const found = (longest: number) => {
    const set = built.spec.componentSets.find((each) => each.key === "calendar-day");
    const variant = set?.variants[0];
    if (set === undefined || variant === undefined) {
      throw new Error("the kit builds no calendar-day set");
    }
    const place = built.drawn.get(variant.key)?.find(({ slot }) => slot === "calendar-day-button")?.place;
    if (place === undefined) {
      throw new Error("the build records no calendar-day-button");
    }
    const button: ProbedBox = {
      ...KEPT,
      slot: "calendar-day-button",
      place,
      base: 36,
      wider: 36,
      longer: 36,
      longest,
      tracksParent: true,
    };
    return contradictions(
      set,
      new Map([[variant.key, { id: "cell", boxes: [button], gap: undefined }]]),
      built.drawn,
      sizingReadsOf(built.spec.componentSets, Result.getOrThrow(densityLengths("dense")))
    ).found.map(({ inferred, mapped }) => `${inferred} → ${mapped}`);
  };

  it("agrees where the far longer text kept the button at its 36px", () => {
    expect(found(36)).toEqual([]);
  });

  it("contradicts the fixed width where the far longer text widened the box", () => {
    expect(found(1264)).toEqual(["tracks → fixed"]);
  });
});

// Oracle: the widths of hand-built sets, summed by hand from the lengths each layer names, Figma's
// widths the fake file records, and the minimum width the plugin sets on an instance (PH3). A
// hugging layer agrees with a box the probe kept at a width only where the hug draws that width, so
// each case puts a box at the width the rule under test draws and at a width it does not. A width
// no probe of Figma proves, as a grid's or one held at a maximum, agrees with no kept width. Fuse's
// `fuse.css` sets `--control-h-md` to 2.25rem at dense density, 36px, and 2.75rem at comfortable
// density, 44px, and the probe's page renders dense.
describe("the width a hug draws around fixed layers", () => {
  const ZERO = { kind: "literal", value: 0 } as const;
  const px = (value: number) => ({ kind: "literal", value }) as const;
  const CONTROL_H_MD = {
    kind: "variable",
    variable: { collection: "Fuse density", name: "control-h-md" },
  } as const;
  const BOX: Omit<BoxSpec, "sizing" | "children"> = {
    direction: "HORIZONTAL",
    limits: NO_LIMITS,
    clips: false,
    paddingTop: ZERO,
    paddingRight: ZERO,
    paddingBottom: ZERO,
    paddingLeft: ZERO,
    itemSpacing: ZERO,
    primaryAlign: "MIN",
    counterAlign: "MIN",
    cornerRadius: ZERO,
    shadows: [],
    opacity: 1,
    fill: undefined,
    stroke: undefined,
  };
  const BLACK = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } } as const;
  const fixedWidth = (length: NumberSpec): SizingSpec => ({
    horizontal: { kind: "fixed", length },
    vertical: { kind: "hug" },
  });
  const HUGS: SizingSpec = { horizontal: { kind: "hug" }, vertical: { kind: "hug" } };
  const frame = (key: string, fields: Partial<FrameLayerSpec> = {}): FrameLayerSpec => ({
    ...BOX,
    kind: "frame",
    key,
    name: key,
    sizing: HUGS,
    children: [],
    ...fields,
  });
  const instance = (variant: string, fields: Partial<InstanceLayerSpec> = {}): InstanceLayerSpec => ({
    kind: "instance",
    key: "item",
    name: "item",
    componentSet: "inner",
    variant,
    sizing: HUGS,
    ...fields,
  });
  /** A set of variants, each by its key and root. */
  const setOf = (
    key: string,
    roots: readonly (readonly [string, ComponentRootSpec])[],
    booleanProperties: ComponentSetSpec["booleanProperties"] = []
  ): Omit<ComponentSetSpec, "page"> => ({
    key,
    name: key,
    axes: [],
    columnAxis: "state",
    textProperties: [],
    swapProperties: [],
    booleanProperties,
    variants: roots.map(([variant, root]) => ({ key: variant, properties: {}, root })),
  });
  const root = (fields: Partial<ComponentRootSpec> = {}): ComponentRootSpec => ({
    ...BOX,
    name: "root",
    sizing: HUGS,
    children: [],
    ...fields,
  });
  const icon = (key: string, fields: Partial<IconLayerSpec> = {}): IconLayerSpec => ({
    kind: "icon",
    key,
    name: key,
    icon: "check",
    swapProperty: undefined,
    size: px(20),
    color: BLACK,
    ...fields,
  });
  /** A 36px frame, a 20px frame, a 20px icon and an 8px gap, the layers each inner root below hugs. */
  const button = frame("button", { sizing: fixedWidth(px(36)) });
  const chip = frame("chip", { sizing: fixedWidth(px(20)) });
  const INNER = setOf(
    "inner",
    [
      ["inner/hug", root({ children: [button] })],
      // A root fixed at a preview width, as Radio group's legend at 384px, around a 36px button.
      ["inner/preview", root({ sizing: fixedWidth(px(384)), children: [button] })],
      ["inner/min", root({ limits: { ...NO_LIMITS, minWidth: px(80) }, children: [button] })],
      ["inner/wide", root({ children: [frame("panel", { sizing: fixedWidth(px(300)) })] })],
      [
        "inner/optional",
        root({ itemSpacing: px(8), children: [button, icon("icon", { visibleProperty: "Icon" })] }),
      ],
    ],
    [{ name: "Icon", defaultValue: false }]
  );

  /**
   * What the probe finds of a set whose root holds one layer, where it kept the layer's box at a
   * width in every run.
   *
   * @param layer - The layer, which the box's `data-slot`, `box`, names.
   * @param width - The width the probe kept the box at.
   * @param measured - What else the probe measured of the box, such as a run that outgrew the width.
   */
  const foundAt = (layer: ChildLayerSpec, width: number, measured: Partial<ProbedBox> = {}) => {
    const outer = setOf(
      "outer",
      [["outer/rest", root({ children: [layer] })]],
      [{ name: "Close", defaultValue: false }]
    );
    const box: ProbedBox = {
      ...KEPT,
      base: width,
      wider: width,
      longer: width,
      longest: width,
      ...measured,
    };
    return contradictions(
      outer,
      new Map([["outer/rest", { id: "cell", boxes: [box], gap: undefined }]]),
      new Map([["outer/rest", [{ place: box.place, slot: box.slot, part: layer.key, path: [layer.key] }]]]),
      sizingReadsOf([INNER, outer], Result.getOrThrow(densityLengths("dense")))
    ).found.map(({ inferred, mapped }) => `${inferred} → ${mapped}`);
  };

  /** A grid of two 20px columns and two 20px rows, a 20px frame in each cell. */
  const grid = frame("item", {
    direction: "GRID",
    grid: {
      columns: [
        { kind: "fixed", length: 20 },
        { kind: "fixed", length: 20 },
      ],
      rows: [
        { kind: "fixed", length: 20 },
        { kind: "fixed", length: 20 },
      ],
      columnGap: ZERO,
      rowGap: ZERO,
      cells: [
        { key: "a", row: 0, column: 0 },
        { key: "b", row: 0, column: 1 },
        { key: "c", row: 1, column: 0 },
        { key: "d", row: 1, column: 1 },
      ],
    },
    children: ["a", "b", "c", "d"].map((key) => frame(key, { sizing: fixedWidth(px(20)) })),
  });

  it.each<readonly [string, ChildLayerSpec, number, readonly string[]]>([
    [
      "a hug around an instance fixed at 40px, as Pagination's item around its link, draws 40px",
      frame("item", { children: [instance("inner/hug", { key: "link", sizing: fixedWidth(px(40)) })] }),
      40,
      [],
    ],
    [
      "the same hug kept at the 36px its instance's variant's root hugs, which the instance's own width replaces",
      frame("item", { children: [instance("inner/hug", { key: "link", sizing: fixedWidth(px(40)) })] }),
      36,
      ["fixed → hug"],
    ],
    [
      "a hug around an instance fixed at 36px whose variant's root keeps 80px at least draws the 80px the plugin sets",
      frame("item", { children: [instance("inner/min", { key: "link", sizing: fixedWidth(px(36)) })] }),
      80,
      [],
    ],
    [
      "the same hug kept at the instance's 36px, below the minimum it takes from its variant's root",
      frame("item", { children: [instance("inner/min", { key: "link", sizing: fixedWidth(px(36)) })] }),
      36,
      ["fixed → hug"],
    ],
    // Figma measured a stroke-less row 20px and the same row with a 4px INSIDE stroke 28px around a
    // 20px child (PS4, `plugin/src/fake/layout.ts`).
    [
      "a hug whose 4px stroke counts in its layout draws 28px around a 20px layer",
      frame("item", { stroke: { color: BLACK, weight: px(4) }, children: [chip] }),
      28,
      [],
    ],
    [
      "the same hug kept at its layer's 20px, as if its stroke took no room",
      frame("item", { stroke: { color: BLACK, weight: px(4) }, children: [chip] }),
      20,
      ["fixed → hug"],
    ],
    [
      "a hug whose stroke is an outline that takes no room draws its layer's 20px",
      frame("item", { stroke: { color: BLACK, weight: px(4), inLayout: false }, children: [chip] }),
      20,
      [],
    ],
    [
      "a grid of two 20px columns draws no width the probe reads, not the 80px of its four layers in a row",
      grid,
      80,
      ["fixed → hug"],
    ],
    ["nor the 40px of its two columns", grid, 40, ["fixed → hug"]],
    [
      "a hug held at a maximum width draws no width the probe reads",
      frame("item", { limits: { ...NO_LIMITS, maxWidth: px(30) }, children: [button] }),
      30,
      ["fixed → hug"],
    ],
    [
      "nor the 36px of its layer",
      frame("item", { limits: { ...NO_LIMITS, maxWidth: px(30) }, children: [button] }),
      36,
      ["fixed → hug"],
    ],
    [
      "a hugging instance whose variant's root hugs a 36px button, as Calendar's day, draws 36px",
      instance("inner/hug"),
      36,
      [],
    ],
    [
      "a hugging instance draws no root fixed at a preview width, which only its own set keeps",
      instance("inner/preview"),
      384,
      ["fixed → hug"],
    ],
    [
      "a hugging instance reads no width at all from a root fixed at a preview width, not even its layers'",
      instance("inner/preview"),
      36,
      ["fixed → hug"],
    ],
    [
      "a hugging instance's minimum width replaces its variant's root's 80px",
      instance("inner/min", { minWidth: px(24) }),
      36,
      [],
    ],
    [
      "a hugging instance with no minimum width of its own keeps its variant's root's 80px",
      instance("inner/min"),
      80,
      [],
    ],
    [
      "a layer a BOOLEAN property shows takes no room where the property's default is off",
      instance("inner/optional"),
      36,
      [],
    ],
    [
      "an icon a BOOLEAN property shows takes its size where the instance turns the property on",
      instance("inner/optional", { properties: { boolean: { Icon: true } } }),
      64,
      [],
    ],
    [
      "a layer of the probed set's own variant takes room whatever its BOOLEAN default, as the cell renders it",
      frame("item", { children: [button, frame("close", { ...chip, visibleProperty: "Close" })] }),
      56,
      [],
    ],
    [
      "a hidden layer takes no room in a hug",
      frame("item", { children: [button, frame("hidden", { ...chip, hidden: true })] }),
      36,
      [],
    ],
    [
      "a placed layer sits out of the flow and takes no room in a hug",
      frame("item", {
        children: [
          button,
          frame("badge", {
            ...chip,
            placement: {
              kind: "edges",
              within: "parent",
              horizontal: { kind: "end", end: 0 },
              vertical: { kind: "start", start: 0 },
            },
          }),
        ],
      }),
      36,
      [],
    ],
  ])("%s", (_case, layer, width, found) => {
    expect(foundAt(layer, width)).toEqual(found);
  });

  // An inline-block with `min-width: 300px` measured 300px rendered and with its text longer, and
  // 600px with it far longer. A hug drawn at one width agrees only with a box that kept it in each
  // run, and a layer fixed at 300px draws no width the far longer text reached.
  it.each<readonly [string, ChildLayerSpec, number, readonly string[]]>([
    [
      "agrees with a hugging instance around a 300px layer kept at 300px in every run",
      instance("inner/wide"),
      300,
      [],
    ],
    [
      "contradicts a layer fixed at 300px where the far longer text widened the box to 600px",
      frame("item", { sizing: fixedWidth(px(300)) }),
      600,
      ["hug → fixed"],
    ],
  ])("%s", (_case, layer, longest, found) => {
    expect(foundAt(layer, 300, { longest })).toEqual(found);
  });

  // Oracle: a hug around one fixed layer draws that layer's width whatever its text, so it agrees
  // only with a box that kept that width in every run. The box measured 300px rendered, wider and
  // with its text longer, and 600px with it far longer, as an inline-block at `min-width: 300px`.
  it("contradicts a row that hugs one 264px layer where the far longer text widened the box", () => {
    expect(
      foundAt(frame("item", { children: [frame("list", { sizing: fixedWidth(px(264)) })] }), 300, {
        longest: 600,
      })
    ).toEqual(["hug → hug"]);
  });

  // Oracle: the inline-flex box above, 320px rendered and with its text longer and 4507px with it
  // far longer, whose longer run read as not reaching it. Its far longer text widened it, so a layer
  // fixed at its 320px draws a width the text outgrew.
  it("contradicts a layer fixed at 320px where far longer text widened a box the longer run read as not reaching", () => {
    expect(
      foundAt(frame("item", { sizing: fixedWidth(px(320)) }), 320, { textReaches: false, longest: 4507 })
    ).toEqual(["hug → fixed"]);
  });

  // Oracle: Figma's auto layout puts its gap between the layers along a row only (the Figma Plugin
  // API's `itemSpacing`), so a column's width, or a row's around one layer, is its layers' whatever
  // the gap. A gap bound to a variable no density mode pins reads as unknown at the probe's density.
  const UNPINNED_GAP = {
    kind: "variable",
    variable: { collection: "Fuse density", name: "no-such-gap" },
  } as const;
  it.each<readonly [string, ChildLayerSpec, number, readonly string[]]>([
    [
      "a column around one 36px layer draws 36px whatever its gap",
      frame("item", { direction: "VERTICAL", itemSpacing: UNPINNED_GAP, children: [button] }),
      36,
      [],
    ],
    [
      "a column around a 36px and a 20px layer draws the wider 36px whatever its gap",
      frame("item", { direction: "VERTICAL", itemSpacing: UNPINNED_GAP, children: [button, chip] }),
      36,
      [],
    ],
    [
      "a row around one 36px layer draws 36px whatever its gap",
      frame("item", { itemSpacing: UNPINNED_GAP, children: [button] }),
      36,
      [],
    ],
    [
      "a row around a 36px and a 20px layer draws no width the probe reads where its gap is unknown",
      frame("item", { itemSpacing: UNPINNED_GAP, children: [button, chip] }),
      56,
      ["fixed → hug"],
    ],
  ])("%s", (_case, layer, width, found) => {
    expect(foundAt(layer, width)).toEqual(found);
  });

  // Oracle: CSS 2.1 §17.5.2.2, where a table cell's set width is a minimum, so text longer than
  // the cell widens it, and Chromium's widths of a `th` at `width: 36px` holding "Mo" on 2026-11-20,
  // as `perturbation.chromium.test.ts` measures them: 36px rendered, 55.14px with its text longer.
  // The kit draws such a cell fixed at the width the browser renders it, so a cell that grows with
  // its text agrees with a layer fixed at its rendered width, and with no other width.
  it.each<readonly [string, number, boolean, readonly string[]]>([
    ["a table cell that grows with its text agrees with a layer fixed at the 36px it renders", 36, true, []],
    ["a table cell that grows with its text contradicts a layer fixed at 40px", 40, true, ["hug → fixed"]],
    [
      "a box that is no table cell and grows with its text contradicts a layer fixed at 36px",
      36,
      false,
      ["hug → fixed"],
    ],
  ])("%s", (_case, fixedAt, tableCell, found) => {
    expect(
      foundAt(frame("cell", { sizing: fixedWidth(px(fixedAt)) }), 36, {
        tableCell,
        longer: 55.14,
        longest: 55.14,
      })
    ).toEqual(found);
  });

  it.each<readonly [string, number, readonly string[]]>([
    ["agrees with a link fixed at control-h-md, as wide as its item at the dense 36px", 36, []],
    [
      "contradicts it kept at the comfortable 44px, which the dense page does not draw",
      44,
      ["tracks → fixed"],
    ],
  ])("%s", (_case, width, found) => {
    expect(
      foundAt(frame("link", { sizing: fixedWidth(CONTROL_H_MD) }), width, { tracksParent: true })
    ).toEqual(found);
  });

  // Oracle: Chromium's widths of a block that tracks an inline-block parent, 35.25px rendered and
  // 36.875px with its text longer and far longer. Each reading lies within 1px of 36px, yet the box
  // grew 1.625px with its text, which a layer fixed at 36px never does.
  it("contradicts a layer fixed at 36px where the box grew past 1px from its rendered width", () => {
    expect(
      foundAt(frame("link", { sizing: fixedWidth(px(36)) }), 35.25, {
        tracksParent: true,
        longer: 36.875,
        longest: 36.875,
      })
    ).toEqual(["tracks → fixed"]);
  });
});

// Oracle: Chromium on 2026-11-20 measured an `inline-flex` row with an 8px gap at 40px wide when it
// held a 40px item and a 100px `position: absolute` item, and at 148px wide with both items in the
// flow (CSS Flexbox 1 §4.1), so a hug leaves out a layer placed outside its auto layout.
describe("a hug holding a layer placed outside its auto layout", () => {
  /** A hugging row of a 40px item and a 100px item placed at its top left. */
  let row: BuiltFixture;

  beforeAll(async () => {
    row = await buildChip(
      "relative inline-flex gap-[8px]",
      [
        { slot: "chip-item", classes: "w-[40px] h-[20px]" },
        { slot: "chip-placed", classes: "absolute top-0 left-0 w-[100px] h-[20px]" },
      ],
      { parts: [part({ key: "item", slot: "chip-item" }), part({ key: "placed", slot: "chip-placed" })] }
    );
  });

  /** What the probe finds against the row's variant, whose root it measured at a kept width. */
  const foundAtRoot = (width: number) => {
    const variant = row.componentSet.variants[0];
    if (variant === undefined) {
      throw new Error(`the set ${row.componentSet.key} has no variant`);
    }
    const root: ProbedBox = {
      ...KEPT,
      slot: variant.root.name,
      place: "0/root",
      root: true,
      base: width,
      wider: width,
      longer: width,
      longest: width,
    };
    return contradictions(
      row.componentSet,
      new Map([[variant.key, { id: "cell", boxes: [root], gap: undefined }]]),
      new Map([[variant.key, row.accounting.get(variant.key)?.parts ?? []]]),
      sizingReadsOf([row.componentSet], Result.getOrThrow(densityLengths("dense")))
    ).found.map(({ inferred, mapped }) => `${inferred} → ${mapped}`);
  };

  it("agrees with the row at the 40px its one flowing item gives it", () => {
    expect(foundAtRoot(40)).toEqual([]);
  });

  it("contradicts the row at the 148px it would draw with the placed item in the flow", () => {
    expect(foundAtRoot(148)).toEqual(["fixed → hug"]);
  });
});

// Oracle: a hand-built chip whose `<svg>` icon, `size-[16px]`, carries the `chip-icon` slot: the icon
// draws 16px whatever the cell holds, so its box agrees only where the probe measured 16px in every run.
describe("an icon's box", () => {
  let built: BuiltFixture;

  beforeAll(async () => {
    built = await buildCaptured(
      chip({ iconsFor: () => [ICON] }),
      rest({
        slot: "chip",
        classes: "flex text-[#000000]",
        children: [{ tag: "svg", slot: "chip-icon", classes: "size-[16px]" }],
      })
    );
  }, 120_000);

  type Runs = Pick<ProbedBox, "base" | "wider" | "longer" | "longest">;
  const every = (width: number): Runs => ({ base: width, wider: width, longer: width, longest: width });

  const probe = (runs: Runs, lengthOf = Result.getOrThrow(densityLengths("dense"))) => {
    const key = built.variant?.key ?? "";
    const box: ProbedBox = { ...KEPT, slot: "chip-icon", place: "0/root/0", text: false, ...runs };
    const parts = (built.accounting.get(key)?.parts ?? []).filter(({ slot }) => slot === "chip-icon");
    return contradictions(
      built.componentSet,
      new Map([[key, { id: "cell", boxes: [box], gap: undefined }]]),
      new Map([[key, parts]]),
      sizingReadsOf([built.componentSet], lengthOf)
    );
  };

  it("agrees where the probe measured the icon's size in every run", () => {
    const { found, compared } = probe(every(16));
    expect({ found, compared }).toEqual({ found: [], compared: 1 });
  });

  it("contradicts the icon where the probe measured it at another width", () => {
    expect(probe(every(20)).found).toEqual([
      {
        cell: "chip/state=rest",
        slot: "chip-icon",
        part: "icon",
        place: "0/root/0",
        inferred: "not-fill",
        mapped: "fixed",
        widths: { drawn: 16, run: "base", measured: 20 },
      },
    ]);
  });

  it.each<readonly [string, Runs, { readonly run: string; readonly measured: number }]>([
    ["its wider run alone", { ...every(16), wider: 12 }, { run: "wider", measured: 12 }],
    ["its longer run alone", { ...every(16), longer: 20 }, { run: "longer", measured: 20 }],
    ["its longest run alone", { ...every(16), longest: 18 }, { run: "longest", measured: 18 }],
  ])(
    "contradicts the icon and names the run where the probe measured another width in %s",
    (_, runs, off) => {
      expect(probe(runs).found.map(({ part, widths }) => ({ part, widths }))).toEqual([
        { part: "icon", widths: { drawn: 16, ...off } },
      ]);
    }
  );

  it("contradicts the icon where the probe's page draws no size it can read", () => {
    expect(probe(every(16), () => undefined).found.map(({ part, widths }) => ({ part, widths }))).toEqual([
      { part: "icon", widths: { drawn: undefined, run: "base", measured: 16 } },
    ]);
  });
});
