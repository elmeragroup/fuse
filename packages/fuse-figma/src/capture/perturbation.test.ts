/**
 * The probe's reading of a box's widths. Unit under test: `inferKind`, `agrees` and, through
 * `contradictions`, the hug a kept width allows. Oracle: the rules the README's `figma:probe`
 * paragraph states, applied by hand to boxes measured as the named components measure, and
 * Chromium's widths of built sets' samples under far longer text on 2026-11-18: the Navigation menu
 * popup stays 264px around its `w-64` list, and a Badge widens with its text. Review round 2 of B4
 * measured a 500px root that a hug of its 256px child does not draw. The probe in the browser only goes red where a
 * mapped kind contradicts what it infers, so a rule that stops inferring would pass it silently;
 * these cases hold what each rule infers. A hug leaves out a layer placed outside its auto layout.
 * On 2026-11-20 Chromium measured an `inline-flex` row with an 8px gap at 40px wide when it held a
 * 40px item and a 100px `position: absolute` item, and at 148px wide with both items in the flow
 * (CSS Flexbox 1 §4.1).
 */
import { Result } from "effect";
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import { buildChip, part } from "../../test/capture-fixtures";
import { densityLengths } from "../components/build-kit.ts";
import type { ComponentSetSpec } from "../components/kit-spec.ts";
import { agrees, contradictions, inferKind } from "./perturbation.ts";
import type { InferredKind, MappedWidth, ProbedBox } from "./perturbation.ts";

/** Each length's pixels at Dense. */
const DENSE = Result.getOrThrow(densityLengths("dense"));

/** A 100px box below a widened root that widened neither with its container nor with its text. */
const KEPT: ProbedBox = {
  slot: "box",
  root: false,
  text: true,
  textReaches: true,
  parentWidened: true,
  base: 100,
  wider: 100,
  longer: 100,
  longest: 100,
  tracksParent: false,
  overflows: false,
  fixedInViewport: false,
  capsAtParent: false,
  widened: true,
};

/**
 * What the probe finds against a set's first variant, whose root it measured at a kept width.
 *
 * @param set - The set.
 * @param width - The root's kept width, in pixels.
 * @returns Each contradiction, as `inferred → mapped`.
 */
function foundAtRoot(set: Omit<ComponentSetSpec, "page">, width: number): readonly string[] {
  const variant = set.variants[0];
  if (variant === undefined) {
    throw new Error(`the set ${set.key} has no variant`);
  }
  const root: ProbedBox = {
    ...KEPT,
    slot: variant.root.name,
    root: true,
    base: width,
    wider: width,
    longer: width,
    longest: width,
  };
  return contradictions(
    set,
    new Map([[variant.key, { id: "cell", boxes: [root], gap: undefined }]]),
    new Map(),
    DENSE
  ).found.map(({ inferred, mapped }) => `${inferred} → ${mapped}`);
}

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
  ])("%s", (_rule, box, kind) => {
    expect(inferKind(box)).toBe(kind);
  });
});

/** A layer's width as a plain frame in the flow decides it. */
const PLAIN: MappedWidth = {
  resizesWithParent: false,
  heldAtMaximum: false,
  hugsMeasuredWidth: false,
  fixedAtMeasuredWidth: false,
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
      { ...PLAIN, hugsMeasuredWidth: true },
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
    if (set === undefined) {
      throw new Error(`the kit builds no set ${key}`);
    }
    return foundAtRoot(set, width);
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
    const button: ProbedBox = {
      ...KEPT,
      slot: "calendar-day-button",
      base: 36,
      wider: 36,
      longer: 36,
      longest,
      tracksParent: true,
    };
    return contradictions(
      set,
      new Map([[variant.key, { id: "cell", boxes: [button], gap: undefined }]]),
      new Map([["calendar-day-button", "button"]]),
      DENSE
    ).found.map(({ inferred, mapped }) => `${inferred} → ${mapped}`);
  };

  it("agrees where the far longer text kept the button at its 36px", () => {
    expect(found(36)).toEqual([]);
  });

  it("contradicts the fixed width where the far longer text widened the box", () => {
    expect(found(1264)).toEqual(["tracks → fixed"]);
  });
});

describe("a hug holding a layer placed outside its auto layout", () => {
  /** A hugging row of a 40px item and a 100px item placed at its top left. */
  let row: Omit<ComponentSetSpec, "page">;

  beforeAll(async () => {
    ({ componentSet: row } = await buildChip(
      "relative inline-flex gap-[8px]",
      [
        { slot: "chip-item", classes: "w-[40px] h-[20px]" },
        { slot: "chip-placed", classes: "absolute top-0 left-0 w-[100px] h-[20px]" },
      ],
      { parts: [part({ key: "item", slot: "chip-item" }), part({ key: "placed", slot: "chip-placed" })] }
    ));
  });

  it("agrees with the row at the 40px its one flowing item gives it", () => {
    expect(foundAtRoot(row, 40)).toEqual([]);
  });

  it("contradicts the row at the 148px it would draw with the placed item in the flow", () => {
    expect(foundAtRoot(row, 148)).toEqual(["fixed → hug"]);
  });
});
