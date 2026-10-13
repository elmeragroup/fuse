import { useState } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

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

function measureSwitch(name: string) {
  const root = switchNamed(name);
  const thumb = [...root.children].find((child): child is HTMLElement => child instanceof HTMLElement);
  if (!(thumb instanceof HTMLElement)) {
    throw new Error(`Expected a thumb inside ${name}`);
  }
  const rootStyle = getComputedStyle(root);
  const thumbStyle = getComputedStyle(thumb);
  return {
    height: px(rootStyle.height),
    width: px(rootStyle.width),
    thumbHeight: px(thumbStyle.height),
    thumbWidth: px(thumbStyle.width),
  };
}

beforeEach(() => {
  document.documentElement.style.fontSize = "16px";
});

afterEach(() => {
  document.documentElement.style.removeProperty("font-size");
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

  it("draws the unchecked track at 3:1 against the page and cards, and the thumb at 3:1 on its track, in light themes", () => {
    renderThemed(
      <>
        <Switch aria-label="Internal off" />
        <Switch aria-label="Internal on" defaultChecked />
        <ThemeScope theme={guenExternal}>
          <Switch aria-label="External off" />
          <Switch aria-label="External on" defaultChecked />
        </ThemeScope>
      </>
    );
    // WCAG 1.4.11: the track shows where an unchecked switch is, and the thumb on it shows the
    // state, so each must reach 3:1 against what it sits on.
    for (const scope of ["Internal", "External"]) {
      const track = switchNamed(`${scope} off`);
      const trackColor = getComputedStyle(track).backgroundColor;
      for (const surface of ["--background", "--card", "--card-soft"]) {
        expect(
          computedContrast(trackColor, cssVarColor(track, surface)),
          `${scope} track on ${surface}`
        ).toBeGreaterThanOrEqual(3);
      }
      for (const name of [`${scope} off`, `${scope} on`]) {
        const root = switchNamed(name);
        const thumb = root.firstElementChild;
        if (!(thumb instanceof HTMLElement)) {
          throw new Error(`Expected a thumb inside ${name}`);
        }
        expect(
          computedContrast(getComputedStyle(thumb).backgroundColor, getComputedStyle(root).backgroundColor),
          `${name} thumb`
        ).toBeGreaterThanOrEqual(3);
      }
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
