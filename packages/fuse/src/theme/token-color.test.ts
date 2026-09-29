import { describe, expect, it } from "vitest";

import { composeTheme } from "./compose-theme";
import { cssVarReference } from "./css-values";
import { readTokenColor } from "./token-color";
import { TOKEN_KINDS, TOKEN_NAMES } from "./tokens/contract";
import { PRIMITIVES } from "./tokens/primitives";
import { LEGAL_THEMES, themeSlug } from "./tokens/themes";

describe("readTokenColor", () => {
  it.each<readonly [string, object]>([
    // The oklch() and hex literals token modules write.
    ["oklch(0.5 0.1 30)", { _tag: "ok", value: { _tag: "Oklch", l: 0.5 } }],
    ["#5c6773", { _tag: "ok", value: { _tag: "Srgb", r: 92 / 255 } }],
    // The notations the theme pipeline cannot compose.
    [
      "rgb(1, 2, 3)",
      { _tag: "err", error: { message: 'Expected an oklch() color, received "rgb(1, 2, 3)"' } },
    ],
    ["lab(50 0 0)", { _tag: "err", error: { message: 'Expected an oklch() color, received "lab(50 0 0)"' } }],
    ["white", { _tag: "err", error: { message: 'Expected an oklch() color, received "white"' } }],
    [
      "oklch(0.5 0.1)",
      { _tag: "err", error: { message: 'Expected an oklch() color, received "oklch(0.5 0.1)"' } },
    ],
    ["#fff", { _tag: "err", error: { message: 'Expected a #rrggbb hex color, received "#fff"' } }],
  ])("reads %j as %j", (input, expected) => {
    expect(readTokenColor(input)).toMatchObject(expected);
  });

  it("accepts every color literal in every composed theme and in the primitives", () => {
    for (const theme of LEGAL_THEMES) {
      for (const scheme of ["light", "dark"] as const) {
        const tokens = composeTheme(theme, scheme);
        for (const name of TOKEN_NAMES) {
          if (TOKEN_KINDS[name] !== "color") continue;
          const value = tokens[name];
          if (cssVarReference(value) !== undefined) continue;
          expect(readTokenColor(value)._tag, `${themeSlug(theme)} ${scheme} ${name}: ${value}`).toBe("ok");
        }
      }
    }
    for (const [name, value] of Object.entries(PRIMITIVES)) {
      if (cssVarReference(value) !== undefined) continue;
      expect(readTokenColor(value)._tag, `primitives ${name}: ${value}`).toBe("ok");
    }
  });
});
