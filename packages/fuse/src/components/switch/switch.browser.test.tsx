import { useState } from "react";

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import * as CssColor from "@elmeragroup/color/css-color";
import { getOrThrow } from "@elmeragroup/color/result";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { consumerCss } from "../../../test/tailwind-consumer-build";
import {
  computedContrast,
  cssVarColor,
  formNamed,
  guenExternal,
  px,
  renderThemed,
  snapshotDocumentTheme,
  stampDensity,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { Field } from "../field";
import { Switch } from "./switch";

const TRACK = {
  default: { height: 18.4, width: 32, thumb: 16 },
  sm: { height: 14, width: 24, thumb: 12 },
} as const;

function switchNamed(name: string, checked?: boolean): HTMLElement {
  const element = page.getByRole("switch", { name, exact: true, checked }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected an HTML switch named ${name}`);
  }
  return element;
}

function switchThumb(root: HTMLElement, name: string): HTMLElement {
  // DOM audit: the thumb is presentational with no role, so its data-slot is the only locator.
  const thumb = root.querySelector('[data-slot="switch-thumb"]');
  if (!(thumb instanceof HTMLElement)) {
    throw new Error(`Expected a thumb inside ${name}`);
  }
  return thumb;
}

function measureSwitch(name: string) {
  const root = switchNamed(name);
  const thumb = switchThumb(root, name);
  const rootStyle = getComputedStyle(root);
  const thumbStyle = getComputedStyle(thumb);
  return {
    height: px(rootStyle.height),
    width: px(rootStyle.width),
    thumbHeight: px(thumbStyle.height),
    thumbWidth: px(thumbStyle.width),
  };
}

let restoreDocumentTheme: () => void = () => undefined;

beforeEach(() => {
  document.documentElement.style.fontSize = "16px";
  restoreDocumentTheme = snapshotDocumentTheme();
});

afterEach(() => {
  document.documentElement.style.removeProperty("font-size");
  restoreDocumentTheme();
});

describe("Switch", () => {
  beforeAll(async () => {
    // A Tailwind-source consumer's own utilities for the className overrides, so they need not be
    // ones Fuse spells. They go first in the head: only a recipe class dropped from the element lets
    // the consumer's apply.
    const style = document.createElement("style");
    style.textContent = await consumerCss(
      '@import "tailwindcss/theme.css" theme(reference);\n@import "tailwindcss/utilities.css" source(none);',
      ["h-7", "w-6", "max-w-xs", "w-72"]
    );
    document.head.prepend(style);
  });

  it("keeps the Field label and description when a wrapper forwards id and ARIA props as undefined", async () => {
    renderThemed(
      <Field.Root>
        <Field.Label>Notifications</Field.Label>
        <Switch id={undefined} aria-labelledby={undefined} aria-describedby={undefined} />
        <Field.Description>Sent by email.</Field.Description>
      </Field.Root>
    );
    await expect.element(switchNamed("Notifications")).toHaveAccessibleDescription("Sent by email.");
  });

  it("submits what each switch shows after native reset, controlled or not", async () => {
    function Alerts() {
      const [checked, setChecked] = useState(true);
      return <Switch name="alerts" aria-label="Alerts" checked={checked} onCheckedChange={setChecked} />;
    }
    renderThemed(
      <form aria-label="Settings">
        <Switch name="newsletter" aria-label="Newsletter" />
        <Alerts />
      </form>
    );
    await userEvent.click(switchNamed("Newsletter"));
    await userEvent.click(switchNamed("Alerts"));

    formNamed("Settings").reset();
    await vi.waitFor(() => {
      expect([...new FormData(formNamed("Settings")).entries()]).toEqual([["newsletter", "on"]]);
    });
    expect(switchNamed("Newsletter").getAttribute("aria-checked")).toBe("true");
    expect(switchNamed("Alerts").getAttribute("aria-checked")).toBe("false");
  });

  it.each(["light", "dark"] as const)(
    "outlines the unchecked switch at 3:1 on the page and cards, and keeps the checked thumb at 3:1 on its fill, in %s themes",
    (scheme) => {
      // Stamp before mounting: a scheme flip under a mounted switch runs its colour transition.
      document.documentElement.setAttribute("data-theme", scheme);
      renderThemed(
        <>
          <Switch aria-label="Internal off" />
          <Switch aria-label="Internal on" defaultChecked />
          <ThemeScope theme={guenExternal}>
            <Switch aria-label="Guen off" />
            <Switch aria-label="Guen on" defaultChecked />
          </ThemeScope>
          <ThemeScope theme={{ variant: "external", brand: "ngfi", segment: "private" }}>
            <Switch aria-label="Ngfi off" />
            <Switch aria-label="Ngfi on" defaultChecked />
          </ThemeScope>
        </>
      );
      // WCAG 1.4.11: the unchecked edge shows where the switch is and its thumb shows the state,
      // so each reaches 3:1 on what the switch sits on. The unchecked track paints no fill, so on
      // versus off reads as outline versus fill whatever the palette.
      for (const scope of ["Internal", "Guen", "Ngfi"]) {
        const off = switchNamed(`${scope} off`);
        const offStyle = getComputedStyle(off);
        const offThumb = getComputedStyle(switchThumb(off, `${scope} off`)).backgroundColor;
        expect(getOrThrow(CssColor.parse(offStyle.backgroundColor)).alpha, `${scope} off fill alpha`).toBe(0);
        for (const surface of ["--background", "--card", "--card-soft"]) {
          const surfaceColor = cssVarColor(off, surface);
          expect(
            computedContrast(offStyle.borderTopColor, surfaceColor),
            `${scope} off edge on ${surface}`
          ).toBeGreaterThanOrEqual(3);
          expect(
            computedContrast(offThumb, surfaceColor),
            `${scope} off thumb on ${surface}`
          ).toBeGreaterThanOrEqual(3);
        }
        const on = switchNamed(`${scope} on`);
        expect(
          computedContrast(
            getComputedStyle(switchThumb(on, `${scope} on`)).backgroundColor,
            getComputedStyle(on).backgroundColor
          ),
          `${scope} on thumb`
        ).toBeGreaterThanOrEqual(3);
      }
    }
  );

  it("draws the invalid border on an unchecked or checked switch inside an invalid Field", () => {
    renderThemed(
      <>
        <Field.Root invalid>
          <Field.Label>Required</Field.Label>
          <Switch />
        </Field.Root>
        <Field.Root invalid>
          <Field.Label>Accepted</Field.Label>
          <Switch defaultChecked />
        </Field.Root>
      </>
    );
    for (const control of [switchNamed("Required", false), switchNamed("Accepted", true)]) {
      expect(getComputedStyle(control).borderTopColor).toBe(cssVarColor(control, "--error"));
    }
  });

  it("emits data-size and keeps optical track and thumb sizes identical at both densities and under nested data-density", () => {
    renderThemed(
      <>
        <Switch aria-label="Default" />
        <Switch size="sm" aria-label="Small" />
        <div data-density="comfortable">
          <Switch aria-label="Nested" />
        </div>
      </>
    );

    function assertTrack(name: string, expected: (typeof TRACK)[keyof typeof TRACK], label: string) {
      const measured = measureSwitch(name);
      expect(measured.height, `${label} height`).toBeCloseTo(expected.height, 1);
      expect(measured.width, `${label} width`).toBe(expected.width);
      expect(measured.thumbHeight, `${label} thumb height`).toBe(expected.thumb);
      expect(measured.thumbWidth, `${label} thumb width`).toBe(expected.thumb);
      return measured;
    }

    expect(switchNamed("Default").getAttribute("data-slot")).toBe("switch");
    expect(switchNamed("Default").getAttribute("data-size")).toBe("default");
    expect(switchNamed("Small").getAttribute("data-size")).toBe("sm");

    stampDensity("dense");
    const denseDefault = assertTrack("Default", TRACK.default, "dense default");
    const denseSm = assertTrack("Small", TRACK.sm, "dense sm");

    stampDensity("comfortable");
    expect(measureSwitch("Default"), "comfortable default").toEqual(denseDefault);
    expect(measureSwitch("Small"), "comfortable sm").toEqual(denseSm);

    stampDensity("dense");
    expect(measureSwitch("Nested"), "nested comfortable under dense").toEqual(denseDefault);
  });

  it("takes a height or a narrower width from className, and a wider width with its max-w-*", () => {
    renderThemed(
      <>
        <Switch aria-label="Taller" className="h-7" />
        <Switch aria-label="Narrower" className="w-6" />
        <Switch aria-label="Wider" className="max-w-xs w-72" />
      </>
    );

    const taller = measureSwitch("Taller");
    expect([taller.height, taller.width], "h-7").toEqual([28, 32]);
    const narrower = measureSwitch("Narrower");
    expect(narrower.width, "w-6 width").toBe(24);
    expect(narrower.height, "w-6 height").toBeCloseTo(18.4, 1);
    expect(measureSwitch("Wider").width, "w-72 max-w-xs").toBe(288);
  });

  it("keeps its size as a direct child of a vertical Field.Root, which stretches its children", () => {
    renderThemed(
      <div style={{ width: 320 }}>
        <Field.Root>
          <Field.Label>Default</Field.Label>
          <Switch />
        </Field.Root>
        <Field.Root>
          <Field.Label>Small</Field.Label>
          <Switch size="sm" />
        </Field.Root>
      </div>
    );

    const fallback = measureSwitch("Default");
    expect(fallback.width, "default width").toBe(32);
    expect(fallback.height, "default height").toBeCloseTo(18.4, 1);
    const small = measureSwitch("Small");
    expect([small.width, small.height], "sm").toEqual([24, 14]);
  });

  it("paints the shared ring on keyboard focus-visible and not on mouse focus, at both densities", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Switch aria-label="Alerts" />
      </>
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(previous instanceof HTMLElement)) {
      throw new Error("expected before button");
    }
    await assertFocusRingAtBothDensities(previous, switchNamed("Alerts"));
  });
});
