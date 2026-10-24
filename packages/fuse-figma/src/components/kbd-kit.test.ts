/**
 * Unit under test: the Kbd group component set as the build produces it. Oracle: the Fuse variable or
 * literal each Figma field must carry, read by hand from `kbd.tsx` and `kbd-variants.ts`, and from the
 * docs Combination demo's first combination, `<KbdGroup><Kbd>Ctrl</Kbd><Kbd>K</Kbd></KbdGroup>`. The
 * group's `inline-flex items-center gap-1` lays the caps out in a row 4px apart, as Chromium measured
 * them on the compare page on 2026-10-24 (`Ctrl` at x 0, `K` at x 33.14 after a 29.14px cap), and its
 * `rounded-sm` corner binds `radius-sm`. Each cap is the Kbd set's text cap, 20px tall from its `h-5`
 * and hugging its label, and its `rounded-[inherit]` from the group's
 * `*:data-[slot=kbd]:rounded-[inherit]` gives it the group's `rounded-sm`, its own corner, so the
 * instance overrides nothing.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, CENTERED_BOX, fixed, HUG, literal, token, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

/** A text cap of the Kbd set, at its own 20px height, exposed to the group's panel. */
const cap = (key: string) =>
  ({
    kind: "instance",
    key,
    name: "kbd",
    componentSet: "kbd",
    variant: "kbd/content=text",
    sizing: { horizontal: HUG, vertical: fixed(literal(20)) },
    exposed: true,
  }) as const;

describe("the Kbd group component set", () => {
  it("holds one variant on the Kbd page under a one-value keys property, with no properties of its own", () => {
    const groups = spec.componentSets.find((candidate) => candidate.key === "kbd-group");
    expect([groups?.name, groups?.page]).toEqual(["Kbd group", "page/kbd"]);
    expect(groups?.axes).toEqual([{ name: "keys", values: ["2"] }]);
    expect(groups?.columnAxis).toBe("keys");
    expect([groups?.textProperties, groups?.swapProperties, groups?.booleanProperties]).toEqual([
      [],
      [],
      undefined,
    ]);
  });

  it("lays out a Ctrl cap and the K cap 4px apart on the radius-sm corner", () => {
    expect(variantRoot(spec, "kbd-group/keys=2")).toEqual({
      name: "kbd-group",
      ...CENTERED_BOX,
      itemSpacing: literal(4),
      sizing: { horizontal: HUG, vertical: HUG },
      clips: true,
      cornerRadius: token("radius-sm"),
      children: [{ ...cap("modifier"), properties: { text: { Label: "Ctrl" } } }, cap("key")],
    });
  });
});
