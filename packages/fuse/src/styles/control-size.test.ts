import { describe, expect, it } from "vitest";

import { cn } from "./cn";
import { controlSize } from "./control-size";
import { controlMdInsetTypeClass } from "./control-size-md";

/**
 * The contract in `control-size.ts`: every size class is an unprefixed utility a consumer's
 * `className` utility of the same family replaces through tailwind-merge. The expected
 * strings are Tailwind's own utilities, written here by hand; the recipe must land in the
 * same tailwind-merge group as each one.
 */
describe("control size: consumer utilities replace the recipe's", () => {
  const DENSITY_TYPE_SIZES = [
    ["md", "label"],
    ["md", "min-square"],
    ["lg", "label"],
    ["lg", "min-square"],
  ] as const;

  it.each(DENSITY_TYPE_SIZES)("binds the density type pair on %s %s as typed utilities", (size, fit) => {
    const classes = controlSize({ size, fit }).split(" ");
    expect(classes).toContain("text-(length:--control-text)");
    expect(classes).toContain("leading-(--control-leading)");
    expect(classes.filter((token) => token.startsWith("["))).toEqual([]);
  });

  it.each(DENSITY_TYPE_SIZES)("lets a consumer text-* class replace the %s %s type", (size, fit) => {
    const merged = cn(controlSize({ size, fit }), "text-sm").split(" ");
    expect(merged).toContain("text-sm");
    expect(merged).not.toContain("text-(length:--control-text)");
    // Tailwind's `text-sm` sets a line height of its own, so the recipe's leading goes too;
    // otherwise the density leading would sit on the consumer's smaller type.
    expect(merged).not.toContain("leading-(--control-leading)");
  });

  it.each(DENSITY_TYPE_SIZES)(
    "lets a consumer leading-* class replace the %s %s line height",
    (size, fit) => {
      const merged = cn(controlSize({ size, fit }), "leading-5").split(" ");
      expect(merged).toContain("leading-5");
      expect(merged).not.toContain("leading-(--control-leading)");
      expect(merged).toContain("text-(length:--control-text)");
    }
  );

  it("keeps the fixed xs and sm type replaceable too", () => {
    expect(cn(controlSize({ size: "xs", fit: "label" }), "text-base")).not.toContain("text-xs");
    expect(cn(controlSize({ size: "sm", fit: "label" }), "text-base")).not.toContain("text-sm");
  });

  it("does not let the font-size override touch the box metrics", () => {
    const merged = cn(controlSize({ size: "md", fit: "label" }), "text-sm leading-5").split(" ");
    expect(merged).toContain("h-(--control-h-md)");
    expect(merged).toContain("px-(--control-px-md)");
    expect(merged).toContain("gap-(--control-gap-md)");
  });
});

/**
 * The text-entry pair: the md inset, the density type and the 16px coarse-pointer floor that
 * keeps iOS Safari from zooming into a focused dense field. The expected strings are written
 * by hand; `control-size.browser.test.tsx` measures the floor itself.
 */
describe("control size: the text-entry inset-and-type pair", () => {
  const FLOOR = "pointer-coarse:[--entry-text:max(16px,var(--control-text))]";
  const FLOORED_TYPE = "text-[length:var(--entry-text,var(--control-text))]";

  /** Class order carries no meaning, so the pair is compared as a set. */
  function classSet(classes: string): string[] {
    return classes.split(" ").sort();
  }

  it("reads the floor in its one font-size class and keeps the density leading", () => {
    expect(classSet(controlMdInsetTypeClass)).toEqual(
      classSet(`px-(--control-px-md) ${FLOOR} ${FLOORED_TYPE} leading-(--control-leading)`)
    );
  });

  it.each(["text-sm", "text-lg"])("lets a consumer %s replace the type on every pointer", (consumer) => {
    // Only the inert floor variable stays: no font-size class but the consumer's reads it.
    expect(classSet(cn(controlMdInsetTypeClass, consumer))).toEqual(
      classSet(`px-(--control-px-md) ${FLOOR} ${consumer}`)
    );
  });

  it("keeps the floored type under a consumer leading-* class", () => {
    expect(classSet(cn(controlMdInsetTypeClass, "leading-5"))).toEqual(
      classSet(`px-(--control-px-md) ${FLOOR} ${FLOORED_TYPE} leading-5`)
    );
  });
});
