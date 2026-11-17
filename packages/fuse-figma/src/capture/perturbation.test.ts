/**
 * The probe's reading of a box's widths. Unit under test: `inferKind` and `agrees`. Oracle: the
 * rules the README's `figma:probe` paragraph states, applied by hand to boxes measured as the named
 * components measure. The probe in the browser only goes red where a mapped kind contradicts what it
 * infers, so a rule that stops inferring would pass it silently; these cases hold what each rule infers.
 */
import { describe, expect, it } from "vitest";

import { agrees, inferKind } from "./perturbation.ts";
import type { InferredKind, MappedWidth, ProbedBox } from "./perturbation.ts";

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
  tracksParent: false,
  overflows: false,
  fixedInViewport: false,
  capsAtParent: false,
  widened: true,
};

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
const PLAIN: MappedWidth = { resizesWithParent: false, heldAtMaximum: false };

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
  ])("%s", (_rule, inferred, mapped, width, agreed) => {
    const sizing =
      mapped === "fixed"
        ? { kind: mapped, length: { kind: "literal" as const, value: 100 } }
        : { kind: mapped };
    expect(agrees(inferred, sizing, false, width)).toBe(agreed);
  });
});
