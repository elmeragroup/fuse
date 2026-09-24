import { describe, expect, it } from "vitest";

import { composeTheme } from "./compose-theme";
import { cssVarReference } from "./css-values";
import { readTokenColor } from "./token-color";
import { TOKEN_KINDS, TOKEN_NAMES } from "./tokens/contract";
import { PRIMITIVES } from "./tokens/primitives";
import { LEGAL_THEMES, themeSlug } from "./tokens/themes";

describe("readTokenColor", () => {
  it("reads the oklch() and hex literals token modules write", () => {
    expect(readTokenColor("oklch(0.5 0.1 30)")).toMatchObject({
      _tag: "ok",
      value: { _tag: "Oklch", l: 0.5 },
    });
    expect(readTokenColor("#5c6773")).toMatchObject({ _tag: "ok", value: { _tag: "Srgb", r: 92 / 255 } });
  });

  it("refuses the notations the theme pipeline cannot compose", () => {
    const refusals: ReadonlyArray<readonly [string, string]> = [
      ["rgb(1, 2, 3)", 'Expected an oklch() color, received "rgb(1, 2, 3)"'],
      ["lab(50 0 0)", 'Expected an oklch() color, received "lab(50 0 0)"'],
      ["white", 'Expected an oklch() color, received "white"'],
      ["oklch(0.5 0.1)", 'Expected an oklch() color, received "oklch(0.5 0.1)"'],
      ["#fff", 'Expected a #rrggbb hex color, received "#fff"'],
    ];
    for (const [input, message] of refusals) {
      expect(readTokenColor(input), input).toMatchObject({ _tag: "err", error: { message } });
    }
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
