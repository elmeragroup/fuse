import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";

import * as CssColor from "@elmeragroup/color/css-color";
import { getOrThrow } from "@elmeragroup/color/result";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { shadowLayerLengths, shadowLayers } from "../../../test/assert-invalid-ring";
import { render } from "../../../test/browser-render";
import { withLocale } from "../../../test/locale-matrix";
import { fkasPrivate, fkseExternal, guenExternal } from "../../../test/theme-fixtures";
import { fieldRootFrom, roleNamed, textNamed } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { CheckboxCard } from "../checkbox-card/checkbox-card";
import { CheckboxGroup } from "../checkbox/checkbox";
import { TextField } from "../text-field/text-field";
import { Card } from "./card";

type Shadow = { readonly geometry: string; readonly alpha: number };

/**
 * The layers of a computed `box-shadow` that cast anything. Tailwind composes its ring and inset
 * slots as `0 0 #0000`, which Chromium serializes as a zero-length transparent layer, so those
 * are dropped. Chromium writes each layer colour first, then its lengths.
 */
function castShadows(element: HTMLElement): readonly Shadow[] {
  return shadowLayers(getComputedStyle(element).boxShadow)
    .map((layer) => {
      const lengths = shadowLayerLengths(layer);
      const color = /^\S+\([^)]*\)/u.exec(layer)?.[0];
      if (lengths === undefined || color === undefined) {
        throw new Error(`unexpected box-shadow layer: ${layer}`);
      }
      const { x, y, blur, spread } = lengths;
      return {
        geometry: `${x}px ${y}px ${blur}px ${spread}px`,
        alpha: getOrThrow(CssColor.parse(color)).alpha,
      };
    })
    .filter((shadow) => shadow.geometry !== "0px 0px 0px 0px");
}

// Oracle: Tailwind 4's `--shadow-xs`, `0 1px 2px 0 rgb(0 0 0 / 0.05)`, and `--shadow-md`, two
// layers at 10% black.
const SHADOW_XS: readonly Shadow[] = [{ geometry: "0px 1px 2px 0px", alpha: 0.05 }];
const SHADOW_MD: readonly Shadow[] = [
  { geometry: "0px 4px 6px -1px", alpha: 0.1 },
  { geometry: "0px 2px 4px -2px", alpha: 0.1 },
];

function CardShadowParts() {
  return withLocale(
    "en-US",
    <>
      <Card.Root role="group" aria-label="Card" />
      <Card.Root role="group" aria-label="Raised card" className="shadow-md" />
      <Card.Root role="group" aria-label="Flat card" className="shadow-none" />
      <CheckboxGroup>
        <CheckboxCard value="roadside" title="Roadside" description="Towing included." />
      </CheckboxGroup>
      <TextField variant="card" label="Annual usage" placeholder="0" />
    </>
  );
}

/** The parts built on the Card recipe that keep the plain `shadow-xs` in every scope. */
function expectShadowKeepers(): void {
  // DOM audit: the CheckboxCard shadow is on Card.Root, which exposes its `card` slot.
  const checkboxCard = textNamed("Roadside").closest("[data-slot=card]");
  if (!(checkboxCard instanceof HTMLElement)) throw new Error("expected the CheckboxCard's card root");
  expect.soft(castShadows(checkboxCard), "CheckboxCard").toEqual(SHADOW_XS);
  expect.soft(castShadows(fieldRootFrom("Annual usage")), "TextField card").toEqual(SHADOW_XS);
}

/** A consumer `shadow-*` class replaces the card shadow whole, in its own colour. */
function expectClassOverride(): void {
  expect.soft(castShadows(roleNamed("group", "Raised card")), "shadow-md").toEqual(SHADOW_MD);
  expect.soft(castShadows(roleNamed("group", "Flat card")), "shadow-none").toEqual([]);
}

describe("the card shadow role", () => {
  it.each([
    ["internal light", (node: ReactNode) => <ThemeScope theme={fkasPrivate}>{node}</ThemeScope>],
    [
      "internal dark",
      (node: ReactNode) => (
        <div data-theme="dark">
          <ThemeScope theme={fkasPrivate}>{node}</ThemeScope>
        </div>
      ),
    ],
  ] as const)("casts Tailwind's shadow-xs under internal cards, %s", (_, scope) => {
    render(scope(<CardShadowParts />));
    expect(castShadows(roleNamed("group", "Card"))).toEqual(SHADOW_XS);
    expectShadowKeepers();
    expectClassOverride();
  });

  it.each([
    ["guen light", guenExternal, false],
    ["fkse light", fkseExternal, false],
    ["guen dark", guenExternal, true],
    ["fkse dark", fkseExternal, true],
  ] as const)("casts a transparent shadow under external cards, %s", (_, theme, dark) => {
    const scoped = (
      <ThemeScope theme={theme}>
        <CardShadowParts />
      </ThemeScope>
    );
    render(dark ? <div data-theme="dark">{scoped}</div> : scoped);
    expect(castShadows(roleNamed("group", "Card"))).toEqual([{ geometry: "0px 1px 2px 0px", alpha: 0 }]);
    expectShadowKeepers();
    expectClassOverride();
  });

  it("takes a --card-shadow override from any wrapper", () => {
    render(
      <ThemeScope theme={guenExternal}>
        <div style={{ "--card-shadow": "rgb(0 0 0 / 0.2)" }}>
          <Card.Root role="group" aria-label="Recoloured" />
        </div>
      </ThemeScope>
    );
    expect(castShadows(roleNamed("group", "Recoloured"))).toEqual([
      { geometry: "0px 1px 2px 0px", alpha: 0.2 },
    ]);
  });
});
