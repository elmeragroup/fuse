/**
 * Unit under test: the studio's font stacks and `previewFontStack`, which reads a stack's loaded
 * families through the docs' `next/font` variables for an artboard. Oracles: the `--font-sans`
 * values the docs CSS declares (`styles/globals.css`), whatever selectors carry them, which the
 * previewed `inter` and `roboto` stacks must reproduce, and the portable stack, which names
 * families. Which scope draws which face is checked by the drawn-face browser tests.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseStyleRules } from "../../../../packages/fuse/test/css-rules.ts";
import { FONT_STACKS, previewFontStack } from "../../src/studio/lib/font-stacks";
import { parseTokenValue } from "../../src/studio/lib/token-values";

const GLOBAL_RULES = parseStyleRules(
  readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../../src/styles/globals.css"),
    "utf8"
  )
);

/** Every distinct `--font-sans` value the docs CSS declares, sorted. */
function declaredFontSans(): string[] {
  const values = GLOBAL_RULES.flatMap(({ declarations }) =>
    declarations.filter(({ name }) => name === "font-sans").map(({ value }) => value)
  );
  return [...new Set(values)].toSorted();
}

describe("FONT_STACKS", () => {
  it("names families, which an app's CSS can use", () => {
    expect([FONT_STACKS.inter, FONT_STACKS.roboto]).toEqual([
      "Inter, ui-sans-serif, system-ui, sans-serif",
      "Roboto, ui-sans-serif, system-ui, sans-serif",
    ]);
  });

  it("previews as the stacks the docs CSS declares", () => {
    expect(declaredFontSans()).toEqual(
      [previewFontStack(FONT_STACKS.inter), previewFontStack(FONT_STACKS.roboto)].toSorted()
    );
  });
});

describe("previewFontStack", () => {
  it("reads the docs' loaded families through their variables and keeps every other family", () => {
    expect(previewFontStack('"Roboto", Georgia, "Inter", serif')).toBe(
      "var(--font-roboto), Georgia, var(--font-inter), serif"
    );
    expect(previewFontStack("var(--font-sans)")).toBe("var(--font-sans)");
  });

  it("keeps a quoted family whole, a comma inside it included", () => {
    // The font knob accepts the stack, so an artboard previews it.
    expect(parseTokenValue("font-sans", 'Arial, "Inter,Roboto", serif').ok).toBe(true);
    expect(previewFontStack('Arial, "Inter,Roboto", serif')).toBe('Arial, "Inter,Roboto", serif');
    expect(previewFontStack(' Arial , "Inter" ,Roboto')).toBe("Arial, var(--font-inter), var(--font-roboto)");
  });
});
