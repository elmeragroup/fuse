/**
 * The kit check's hold on labels that show the kit's glyph font. Unit under test: `checkKitSpec`
 * over a one-label kit, and over that kit with a second set whose instance gives the label its TEXT
 * value or leaves it at the property's default, which Apply then writes. Oracle: the fake's rule 51
 * from probe FT1 on #522, under which a range write over every character makes that style the base
 * style a TEXT write resets the label to, so a value of glyphs alone would let a later TEXT write show
 * letters in the glyph font, unbound. A refusal names the layer and says the value shows only glyphs.
 */
import { Result } from "effect";
import { describe, expect, it } from "vitest";

import { checkKitSpec } from "../../src/components/kit-check.ts";
import type { KitSpec } from "../../src/components/kit-spec.ts";
import { LABEL, nestedKit, outerKit } from "./button-kit-fixture.ts";
import { base64Decode } from "./fake/paints.ts";

/** The check's verdict: `accepted`, or the layer a glyph-only refusal names. */
function verdict(kit: KitSpec): string {
  const checked = checkKitSpec(kit, base64Decode);
  if (Result.isSuccess(checked)) {
    return "accepted";
  }
  const { message } = checked.failure;
  const [layer = ""] = message.split(" in the variant ");
  return message.includes("shows only glyphs") ? `refused at ${layer}` : message;
}

describe("the kit check's glyph labels", () => {
  it.each([
    ["⌘K", "accepted"],
    ["⇧⌘", "refused at Button: Label"],
  ])("judges a label of %s", (characters, expected) => {
    expect(verdict(nestedKit([{ ...LABEL, characters }]))).toBe(expected);
  });

  it.each([
    ["⌘B", "accepted"],
    ["⌘", "refused at Outer: Inner"],
  ])("judges an instance's TEXT value of %s", (shown, expected) => {
    expect(verdict(outerKit({ ...LABEL, characters: "⌘K" }, shown))).toBe(expected);
  });

  it.each([
    ["⌘K", "accepted"],
    ["⌘", "refused at Outer: Inner"],
  ])("judges the TEXT default %s an instance that gives no value shows", (defaultValue, expected) => {
    expect(verdict(outerKit({ ...LABEL, characters: "Save" }, undefined, defaultValue))).toBe(expected);
  });
});
