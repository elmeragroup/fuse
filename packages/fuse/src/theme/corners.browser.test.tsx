import type { CSSProperties, ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { render } from "../../test/browser-render";
import { cornerRadius } from "../../test/inner-corner-specimens";
import { withLocale } from "../../test/locale-matrix";
import { fkasBranded, fkasPrivate, tkasCompany } from "../../test/theme-fixtures";
import { roleNamed, snapshotDocumentTheme, stampDocumentTheme } from "../../test/themed-browser-render";
import { Button } from "../components/button/button";
import { Card } from "../components/card/card";
import { Input } from "../components/input/input";
import { LEGAL_THEMES, themeSlug } from "./theme-input";
import type { BrandCode, ThemeInput } from "./theme-input";
import { ThemeScope } from "./theme-scope";

// Oracle: the corner policy in px at the 16px root, written out here. A neutral theme rounds
// cards, fields and buttons at 8px. A branded theme rounds cards and fields at its brand
// radius and buttons at its brand button radius; fkab shares fkas's corners.
const NEUTRAL = { radius: 8, button: 8 } as const;
const BRANDED = {
  fkas: { radius: 12, button: 29 },
  fkab: { radius: 12, button: 29 },
  tkas: { radius: 16, button: 16 },
  guen: { radius: 8, button: 8 },
  fkse: { radius: 12, button: 29 },
  elma: { radius: 6, button: 6 },
  ngfi: { radius: 6, button: 29 },
} as const satisfies Record<BrandCode, { radius: number; button: number }>;

const SCHEMES = ["light", "dark"] as const;

function expectedCorners(theme: ThemeInput): { radius: number; button: number } {
  return theme.identity === "neutral" ? NEUTRAL : BRANDED[theme.brand];
}

/** A card, a field and a button, each labelled with `prefix`. */
function Corners({ prefix }: { prefix: string }): ReactNode {
  return withLocale(
    "en-US",
    <>
      <Card.Root role="group" aria-label={`${prefix} card`} />
      <Input aria-label={`${prefix} input`} />
      <Button>{`${prefix} button`}</Button>
    </>
  );
}

function measured(prefix: string) {
  return {
    card: cornerRadius(roleNamed("group", `${prefix} card`)),
    field: cornerRadius(roleNamed("textbox", `${prefix} input`)),
    button: cornerRadius(roleNamed("button", `${prefix} button`)),
  };
}

/** A document theme of the other identity, with other corners, so a root-resolved corner shows. */
function otherIdentity(theme: ThemeInput): ThemeInput {
  return theme.identity === "neutral"
    ? tkasCompany
    : { identity: "neutral", brand: theme.brand === "fkab" ? "fkas" : theme.brand, segment: "private" };
}

describe("corner sets", () => {
  let restoreDocumentTheme: () => void = () => undefined;

  beforeEach(() => {
    restoreDocumentTheme = snapshotDocumentTheme();
    document.documentElement.style.fontSize = "16px";
  });

  afterEach(() => {
    restoreDocumentTheme();
    document.documentElement.style.removeProperty("font-size");
  });

  it.each(SCHEMES)("rounds every legal theme with its identity's corners on the document in %s", (scheme) => {
    // Corners are CSS alone, so one tree reads every theme the document is restamped with.
    render(<Corners prefix="Document" />);
    for (const theme of LEGAL_THEMES) {
      stampDocumentTheme(theme, scheme);
      const { radius, button } = expectedCorners(theme);
      expect(measured("Document"), `${themeSlug(theme)} ${scheme}`).toEqual({
        card: radius,
        field: radius,
        button,
      });
    }
  });

  it.each(SCHEMES)("rounds a scope of the other identity with its own corners in %s", (scheme) => {
    // Unit under test: the corner rules on a nested theme element. Each scope sits under a
    // document of the other identity, so a dark rule or an inherited corner would show.
    // One tree per scheme: each theme rerenders the scope with its attributes.
    const { rerender } = render(null);
    for (const theme of LEGAL_THEMES) {
      stampDocumentTheme(otherIdentity(theme), scheme);
      rerender(
        <ThemeScope theme={theme}>
          <Corners prefix="Nested" />
        </ThemeScope>
      );
      const { radius, button } = expectedCorners(theme);
      expect(measured("Nested"), `${themeSlug(theme)} ${scheme}`).toEqual({
        card: radius,
        field: radius,
        button,
      });
    }
  });

  it.each(SCHEMES)("keeps a host --radius override on the theme element in %s", (scheme) => {
    // A host restyles the corner on the element that carries the theme attributes, inline or
    // with a rule that ties the corner rule and follows themes.css. No dark rule outweighs it.
    stampDocumentTheme(fkasPrivate, scheme);
    const style = document.createElement("style");
    style.textContent = '.host-corners[data-theme-brand="fkas"] { --radius: 1.25rem; }';
    document.head.append(style);
    try {
      const inline: CSSProperties = { "--radius": "0.25rem" };
      render(
        <>
          <ThemeScope theme={fkasBranded} className="host-corners">
            <Corners prefix="Rule" />
          </ThemeScope>
          <ThemeScope theme={fkasBranded} style={inline}>
            <Corners prefix="Inline" />
          </ThemeScope>
        </>
      );
      // The button keeps the brand's own button radius, which the theme element states.
      expect(measured("Rule")).toEqual({ card: 20, field: 20, button: 29 });
      expect(measured("Inline")).toEqual({ card: 4, field: 4, button: 29 });
    } finally {
      style.remove();
    }
  });
});
