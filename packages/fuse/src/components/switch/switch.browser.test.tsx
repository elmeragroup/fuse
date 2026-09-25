import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { px, renderThemed, stampDensity } from "../../../test/themed-browser-render";
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
  it("renders a switch whose aria-checked reflects state", () => {
    renderThemed(
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
  });

  it("toggles on click and fires onCheckedChange with the new checked value", async () => {
    const onCheckedChange = vi.fn();
    renderThemed(<Switch aria-label="Alerts" onCheckedChange={onCheckedChange} />);

    await expect.element(page.getByRole("switch", { name: "Alerts", checked: false })).toBeInTheDocument();
    await userEvent.click(page.getByRole("switch", { name: "Alerts", exact: true }));
    await expect.element(page.getByRole("switch", { name: "Alerts", checked: true })).toBeInTheDocument();
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenNthCalledWith(1, true, expect.anything());
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

  it("supports controlled checked and uncontrolled defaultChecked", async () => {
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

  it("emits data-size for sm and default", () => {
    renderThemed(
      <>
        <Switch size="sm" aria-label="Small" />
        <Switch size="default" aria-label="Default" />
      </>
    );
    expect(switchNamed("Small").getAttribute("data-size")).toBe("sm");
    expect(switchNamed("Default").getAttribute("data-size")).toBe("default");
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
