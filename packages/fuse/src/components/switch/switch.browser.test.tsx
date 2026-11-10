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
  guenBranded,
  px,
  renderThemed,
  snapshotDocumentTheme,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { Field } from "../field";
import { Switch } from "./switch";

/** The track and thumb geometry the Switch draws: its border box, its 1px edge and the thumb's size. */
const TRACK = {
  default: { height: 18.4, width: 32, thumb: 16, border: 1 },
  sm: { height: 14, width: 24, thumb: 12, border: 1 },
} as const;

function switchNamed(name: string, checked?: boolean): HTMLElement {
  const element = page.getByRole("switch", { name, exact: true, checked }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected an HTML switch named ${name}`);
  }
  return element;
}

function switchThumb(root: HTMLElement, name: string): HTMLElement {
  // The thumb is presentational with no role, so its data-slot is the only locator.
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
      ["h-7", "w-6", "max-w-xs", "w-72", "[:where(&>*)]:justify-center"]
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
          <Switch aria-label="Neutral off" />
          <Switch aria-label="Neutral on" defaultChecked />
          <ThemeScope theme={guenBranded}>
            <Switch aria-label="Guen off" />
            <Switch aria-label="Guen on" defaultChecked />
          </ThemeScope>
          <ThemeScope theme={{ identity: "branded", brand: "ngfi", segment: "private" }}>
            <Switch aria-label="Ngfi off" />
            <Switch aria-label="Ngfi on" defaultChecked />
          </ThemeScope>
        </>
      );
      // WCAG 1.4.11: the unchecked edge shows where the switch is and its thumb shows the state,
      // so each reaches 3:1 on what the switch sits on. The unchecked track paints no fill, so on
      // versus off reads as outline versus fill whatever the palette.
      for (const scope of ["Neutral", "Guen", "Ngfi"]) {
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

  it.each([
    ["on its own", ""],
    // A zero-weight child rule, as the docs stage and Fuse's own `:where()` defaults write one.
    ["under a parent that centres its children's content", "[:where(&>*)]:justify-center"],
  ])("rests the thumb inside the track at both ends, %s", (_, parent) => {
    renderThemed(
      <div className={parent}>
        <Switch aria-label="Default off" />
        <Switch aria-label="Default on" defaultChecked />
        <Switch size="sm" aria-label="Small off" />
        <Switch size="sm" aria-label="Small on" defaultChecked />
      </div>
    );
    for (const [size, label] of [
      ["default", "Default"],
      ["sm", "Small"],
    ] as const) {
      const { width, thumb, border } = TRACK[size];
      // Unchecked, the thumb's layout box starts at the track's padding edge; it is drawn at 75%,
      // so its layout offset, not its painted box, says where it rests.
      const off = switchNamed(`${label} off`);
      expect(switchThumb(off, `${label} off`).offsetLeft, `${label} off thumb start`).toBe(0);
      // Checked, the painted thumb ends at the padding edge of the track's far end.
      const on = switchNamed(`${label} on`);
      const track = on.getBoundingClientRect();
      const painted = switchThumb(on, `${label} on`).getBoundingClientRect();
      expect(painted.width, `${label} on thumb width`).toBe(thumb);
      expect(painted.right - track.left, `${label} on thumb end`).toBeCloseTo(width - border, 1);
    }
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
