/**
 * Unit under test: the `Radio row` set as the build produces it.
 * Oracle: the Figma field each cell must carry, read by hand from `radioRowVariants` in
 * `radio-group-variants.ts` and `radio-group.tsx`, and Chromium's layout of the docs Basic demo's
 * rows with preflight and Fuse's built CSS on 2026-10-27:
 *
 * - The row is a flex `<div>`; the label is `text-sm flex items-center gap-2`, so the radio and the
 *   content sit 8px apart, centred, in 14/20px type; the content dims to 50% through
 *   `peer-data-disabled:`.
 * - In a horizontal group a row hugs its label, 55.9 by 20px for `Fixed`. In a vertical one the group
 *   stretches it across its 384px, its label packed at its start.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, fixed, HUG, literal, paint, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

function row(width: string, checked: string, state: string) {
  return variantRoot(spec, `radio-row/width=${width},checked=${checked},state=${state}`);
}

describe("the Radio row component set", () => {
  it("sits on the Radio page, hugging or filling, off and on in Radio's four states", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "radio-row");
    expect([set?.name, set?.page, set?.axes, set?.textProperties]).toEqual([
      "Radio row",
      "page/radio",
      [
        { name: "width", values: ["hug", "fill"] },
        { name: "checked", values: ["off", "on"] },
        { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
      ],
      [{ name: "Label", defaultValue: "Fixed" }],
    ]);
  });

  it("lays the radio and the 14/20px text 8px apart, centred, hugging or across 384px", () => {
    const [hug, fill] = [row("hug", "on", "rest"), row("fill", "on", "rest")];
    expect([hug.sizing.horizontal, fill.sizing.horizontal, fill.primaryAlign]).toEqual([
      HUG,
      fixed(literal(384)),
      "MIN",
    ]);
    const [label] = hug.children;
    expect(label).toMatchObject({ kind: "frame", itemSpacing: literal(8), counterAlign: "CENTER" });
    const [radio, content] = label?.kind === "frame" ? label.children : [];
    expect([radio?.kind === "instance" ? radio.variant : undefined]).toEqual(["radio/checked=on,state=rest"]);
    expect(content?.kind === "frame" ? content.children[0] : undefined).toMatchObject({
      characters: "Fixed",
      fontSize: literal(14),
      lineHeight: literal(20),
      color: paint("foreground"),
    });
  });

  it("dims the text to 50% when disabled and turns it `error` in an invalid group", () => {
    const content = (state: string) => {
      const [label] = row("hug", "off", state).children;
      return label?.kind === "frame" ? label.children[1] : undefined;
    };
    const disabled = content("disabled");
    expect(disabled?.kind === "frame" ? disabled.opacity : undefined).toBe(0.5);
    const invalid = content("invalid");
    expect(invalid?.kind === "frame" ? invalid.children[0] : undefined).toMatchObject({
      color: paint("error"),
    });
  });
});
