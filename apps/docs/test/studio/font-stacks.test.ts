/**
 * Unit under test: the studio's font stacks and `previewFontStack`, which reads a stack's loaded
 * families through the docs' `next/font` variables for an artboard. Oracles: the `--font-sans` the
 * docs CSS declares on the root and on each variant's theme scope (`styles/globals.css`), which a
 * previewed `inter` or `roboto` stack must reproduce, and the portable stack, which names families.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FONT_STACKS, previewFontStack } from "../../src/studio/lib/font-stacks";
import { parseTokenValue } from "../../src/studio/lib/token-values";

const GLOBALS = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../../src/styles/globals.css"),
  "utf8"
);

/** The `--font-sans` the rule whose selector is `selector` declares in the docs CSS. */
function declaredFontSans(selector: string): string | undefined {
  const start = GLOBALS.indexOf(`${selector} {`);
  const body = start === -1 ? "" : GLOBALS.slice(start, GLOBALS.indexOf("}", start));
  return /--font-sans:\s*([^;]+);/u.exec(body)?.[1]?.trim();
}

describe("FONT_STACKS", () => {
  it("names families, which an app's CSS can use", () => {
    expect([FONT_STACKS.inter, FONT_STACKS.roboto]).toEqual([
      "Inter, ui-sans-serif, system-ui, sans-serif",
      "Roboto, ui-sans-serif, system-ui, sans-serif",
    ]);
  });

  it("previews as the stacks the docs CSS sets on the root and on each variant's scopes", () => {
    expect([
      declaredFontSans(":root"),
      declaredFontSans('[data-theme-variant="internal"]:not(:root)'),
      declaredFontSans('[data-theme-variant="external"]:not(:root)'),
    ]).toEqual([
      previewFontStack(FONT_STACKS.inter),
      previewFontStack(FONT_STACKS.inter),
      previewFontStack(FONT_STACKS.roboto),
    ]);
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
