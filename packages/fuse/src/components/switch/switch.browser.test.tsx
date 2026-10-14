import { useState } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import * as CssColor from "@elmeragroup/color/css-color";
import { getOrThrow } from "@elmeragroup/color/result";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
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
  it("renders a switch whose aria-checked reflects state, controlled by checked or uncontrolled from defaultChecked", async () => {
    const { unmount: unmountDefaults } = renderThemed(
      <>
        <Switch aria-label="Off" />
        <Switch aria-label="On" defaultChecked />
      </>
    );

    const off = switchNamed("Off", false);
    const on = switchNamed("On", true);
    expect(off.getAttribute("aria-checked")).toBe("false");
    expect(on.getAttribute("aria-checked")).toBe("true");
    expect(off.getAttribute("data-slot")).toBe("switch");
    expect(off.getAttribute("data-size")).toBe("default");
    unmountDefaults();

    const onCheckedChange = vi.fn();
    renderThemed(
      <>
        <Switch checked={false} onCheckedChange={onCheckedChange} aria-label="Held" />
        <Switch defaultChecked aria-label="Open" />
      </>
    );

    await expect.element(page.getByRole("switch", { name: "Held", checked: false })).toBeInTheDocument();
    await expect.element(page.getByRole("switch", { name: "Open", checked: true })).toBeInTheDocument();

    await userEvent.click(page.getByRole("switch", { name: "Held", exact: true }));
    expect(onCheckedChange).toHaveBeenNthCalledWith(1, true, expect.anything());
    await expect.element(page.getByRole("switch", { name: "Held", checked: false })).toBeInTheDocument();

    await userEvent.click(page.getByRole("switch", { name: "Open", exact: true }));
    await expect.element(page.getByRole("switch", { name: "Open", checked: false })).toBeInTheDocument();
  });

  it("toggles from Tab focus with Space and with Enter", async () => {
    const onCheckedChange = vi.fn();
    renderThemed(
      <>
        <button type="button">Before</button>
        <Switch aria-label="Alerts" onCheckedChange={onCheckedChange} />
      </>
    );

    page.getByRole("button", { name: "Before" }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(switchNamed("Alerts", false));

    await userEvent.keyboard(" ");
    expect(onCheckedChange).toHaveBeenNthCalledWith(1, true, expect.anything());
    await expect.element(page.getByRole("switch", { name: "Alerts", checked: true })).toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    expect(onCheckedChange).toHaveBeenNthCalledWith(2, false, expect.anything());
    await expect.element(page.getByRole("switch", { name: "Alerts", checked: false })).toBeInTheDocument();
  });

  it("blocks toggling and tab order when disabled", async () => {
    const onCheckedChange = vi.fn();
    renderThemed(
      <>
        <button type="button">Before</button>
        <Switch disabled aria-label="Alerts" onCheckedChange={onCheckedChange} />
        <button type="button">After</button>
      </>
    );

    const control = switchNamed("Alerts", false);
    await expect.element(page.getByRole("switch", { name: "Alerts", exact: true })).toBeDisabled();

    control.click();
    control.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onCheckedChange).not.toHaveBeenCalled();
    await expect.element(page.getByRole("switch", { name: "Alerts", checked: false })).toBeInTheDocument();

    page.getByRole("button", { name: "Before" }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(page.getByRole("button", { name: "After" }).element());
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

  it("takes its accessible name from Field.Label and stamps aria-invalid from Field", () => {
    renderThemed(
      <>
        <Field.Root>
          <Field.Label>Notifications</Field.Label>
          <Switch />
        </Field.Root>
        <Field.Root invalid>
          <Field.Label>Required</Field.Label>
          <Switch />
        </Field.Root>
      </>
    );

    expect(switchNamed("Notifications").getAttribute("aria-checked")).toBe("false");
    expect(switchNamed("Required").getAttribute("aria-invalid")).toBe("true");
  });

  it("submits name and value through the hidden input", async () => {
    const alerts: Array<FormDataEntryValue | null> = [];
    const quiet: Array<FormDataEntryValue | null> = [];
    renderThemed(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          alerts.push(data.get("alerts"));
          quiet.push(data.get("quiet"));
        }}>
        <Switch name="alerts" value="yes" defaultChecked aria-label="Alerts" />
        <Switch name="quiet" value="yes" aria-label="Quiet" />
        <button type="submit">Save</button>
      </form>
    );

    await userEvent.click(page.getByRole("button", { name: "Save", exact: true }));
    expect(alerts).toEqual(["yes"]);
    expect(quiet).toEqual([null]);
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

  it("keeps optical track and thumb sizes identical at both densities and under nested data-density", () => {
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

    stampDensity("dense");
    const denseDefault = assertTrack("Default", TRACK.default, "dense default");
    const denseSm = assertTrack("Small", TRACK.sm, "dense sm");

    stampDensity("comfortable");
    expect(measureSwitch("Default"), "comfortable default").toEqual(denseDefault);
    expect(measureSwitch("Small"), "comfortable sm").toEqual(denseSm);

    stampDensity("dense");
    expect(measureSwitch("Nested"), "nested comfortable under dense").toEqual(denseDefault);
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
