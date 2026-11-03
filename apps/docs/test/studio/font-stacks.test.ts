/**
 * Unit under test: the studio's `inter` and `roboto` font stacks, which seed each theme's
 * `--font-sans` and which the font knob matches to show the picked stack. Oracle: the `--font-sans`
 * the docs CSS declares on the root and on each variant's theme scope (`styles/globals.css`), the
 * value an artboard draws until an edit replaces it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FONT_STACKS } from "../../src/studio/lib/font-stacks";

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
  it("holds the stacks the docs CSS sets on the root and on each variant's scopes", () => {
    expect([
      declaredFontSans(":root"),
      declaredFontSans('[data-theme-variant="internal"]:not(:root)'),
      declaredFontSans('[data-theme-variant="external"]:not(:root)'),
    ]).toEqual([FONT_STACKS.inter, FONT_STACKS.inter, FONT_STACKS.roboto]);
  });
});
