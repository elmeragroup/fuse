import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Meter } from "./meter";
import type { MeterMode } from "./meter-constants";

const WARNING_COPY = {
  "nb-NO": "Advarsel",
  "sv-SE": "Varning",
  "en-US": "Warning",
  "fi-FI": "Varoitus",
} as const;

const SUCCESS_COPY = {
  "nb-NO": "Vellykket",
  "sv-SE": "Lyckades",
  "en-US": "Success",
  "fi-FI": "Onnistui",
} as const;

function renderMeter(node: ReactNode, locale: (typeof SUPPORTED_LOCALES)[number] = "en-US") {
  return renderThemed(withLocale(locale, node));
}

/** DOM audit: the five `data-slot` parts and the `meter-bar-fill` class matrix. */
function slot(name: string, root?: HTMLElement): HTMLElement {
  const element = (root ?? document).querySelector(`[data-slot="${name}"]`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected data-slot=${name}`);
  }
  return element;
}

describe("Meter", () => {
  it("is found by role=meter with default aria values and the label as the accessible name", () => {
    renderMeter(<Meter label="Storage used" value={42} />);
    const meter = roleNamed("meter", "Storage used");
    expect(meter.getAttribute("aria-valuenow")).toBe("42");
    expect(meter.getAttribute("aria-valuemin")).toBe("0");
    expect(meter.getAttribute("aria-valuemax")).toBe("100");
  });

  it("renders the formatted Meter.Value by default and lets valueLabel replace it", () => {
    const { unmount: unmountDefault } = renderMeter(<Meter label="Used" value={42} />);
    expect(slot("meter-value").textContent).toContain("42%");
    unmountDefault();

    renderMeter(<Meter label="Custom" value={82} maxValue={120} valueLabel="82 of 120 GB" />);
    expect(slot("meter-value").textContent).toContain("82 of 120 GB");
    expect(slot("meter-value").textContent).not.toContain("42%");
  });

  it("emits all five data-slots", () => {
    renderMeter(<Meter label="Storage used" value={42} />);
    const root = roleNamed("meter", "Storage used");
    expect(root.getAttribute("data-slot")).toBe("meter");
    expect(slot("meter-label", root).textContent).toBe("Storage used");
    expect(slot("meter-bar", root)).toBeTruthy();
    expect(slot("meter-bar-fill", root)).toBeTruthy();
    expect(slot("meter-value", root)).toBeTruthy();
  });

  it("spot-checks each tone column of bar-fill classes on the live fill", () => {
    const cases: Array<{
      mode: MeterMode;
      value: number;
      maxValue?: number;
      fill: string;
    }> = [
      { mode: "default", value: 50, fill: "bg-success" },
      { mode: "default", value: 85, fill: "bg-warning" },
      { mode: "default", value: 100, fill: "bg-error" },
      { mode: "default", value: 150, maxValue: 120, fill: "bg-error" },
      { mode: "inverted", value: 50, fill: "bg-error" },
      { mode: "inverted", value: 85, fill: "bg-warning" },
      { mode: "inverted", value: 100, fill: "bg-success" },
      { mode: "inverted", value: 150, maxValue: 120, fill: "bg-error" },
      { mode: "success-only-when-full", value: 50, fill: "bg-error" },
      { mode: "success-only-when-full", value: 85, fill: "bg-error" },
      { mode: "success-only-when-full", value: 100, fill: "bg-success" },
      { mode: "success-only-when-full", value: 150, maxValue: 120, fill: "bg-error" },
      { mode: "neutral", value: 50, fill: "bg-primary" },
      { mode: "neutral", value: 85, fill: "bg-primary" },
      { mode: "neutral", value: 100, fill: "bg-primary" },
      { mode: "neutral", value: 150, maxValue: 120, fill: "bg-primary" },
    ];

    for (const row of cases) {
      const { unmount } = renderMeter(
        <Meter label={row.mode} value={row.value} maxValue={row.maxValue} mode={row.mode} />
      );
      expect(slot("meter-bar-fill").className.split(/\s+/), `${row.mode} ${row.value}`).toContain(row.fill);
      unmount();
    }
  });

  it("shows Warning at 85% in default mode and no icon at 79%", () => {
    const { unmount: unmountLow } = renderMeter(<Meter label="Low" value={79} />);
    expect(page.getByLabelText("Warning").query()).toBeNull();
    expect(page.getByLabelText("Success").query()).toBeNull();
    unmountLow();

    renderMeter(<Meter label="High" value={85} />);
    expect(page.getByLabelText("Warning").element()).toBeTruthy();
    expect(page.getByLabelText("Success").query()).toBeNull();
  });

  it("treats exactly 80% as LOW for both the fill and the icon", () => {
    const { unmount: unmountBoundary } = renderMeter(<Meter label="Boundary" value={80} />);
    expect(slot("meter-bar-fill").className.split(/\s+/)).toContain("bg-success");
    expect(page.getByLabelText("Warning").query()).toBeNull();
    unmountBoundary();

    const { unmount: unmountAbove } = renderMeter(<Meter label="Above" value={81} />);
    expect(slot("meter-bar-fill").className.split(/\s+/)).toContain("bg-warning");
    expect(page.getByLabelText("Warning").element()).toBeTruthy();
    unmountAbove();

    renderMeter(<Meter label="Scaled" value={96} maxValue={120} />);
    expect(slot("meter-bar-fill").className.split(/\s+/)).toContain("bg-success");
    expect(page.getByLabelText("Warning").query()).toBeNull();
  });

  it("shows CheckCircle at FULL in success-only-when-full and Warning otherwise", () => {
    const { unmount: unmountFull } = renderMeter(
      <Meter label="Full" value={100} mode="success-only-when-full" />
    );
    expect(page.getByLabelText("Success").element()).toBeTruthy();
    expect(page.getByLabelText("Warning").query()).toBeNull();
    unmountFull();

    renderMeter(<Meter label="Partial" value={40} mode="success-only-when-full" />);
    expect(page.getByLabelText("Warning").element()).toBeTruthy();
    expect(page.getByLabelText("Success").query()).toBeNull();
  });

  it("never renders an icon in inverted or neutral at any value", () => {
    for (const mode of ["inverted", "neutral"] as const) {
      for (const value of [0, 79, 85, 100]) {
        const { unmount } = renderMeter(<Meter label={mode} value={value} mode={mode} />);
        expect(page.getByLabelText("Warning").query(), `${mode} ${value}`).toBeNull();
        expect(page.getByLabelText("Success").query(), `${mode} ${value}`).toBeNull();
        unmount();
      }
    }
  });

  it("resolves warning and success labels in every locale and lets overrides win", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderMeter(<Meter label="Used" value={85} />, locale);
      expect(page.getByLabelText(WARNING_COPY[locale]).element(), locale).toBeTruthy();
      unmount();
    }

    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderMeter(
        <Meter label="Used" value={100} mode="success-only-when-full" />,
        locale
      );
      expect(page.getByLabelText(SUCCESS_COPY[locale]).element(), locale).toBeTruthy();
      unmount();
    }

    const { unmount } = renderMeter(
      <Meter label="Used" value={85} warningLabel="Heads up" successLabel="All good" />,
      "nb-NO"
    );
    expect(page.getByLabelText("Heads up").element()).toBeTruthy();
    expect(page.getByLabelText("Advarsel").query()).toBeNull();
    unmount();
  });

  it("is read-only: no keyboard interaction surface", () => {
    renderMeter(<Meter label="Storage used" value={42} />);
    const meter = roleNamed("meter", "Storage used");
    expect(meter.getAttribute("tabindex")).toBeNull();
    expect(meter.querySelectorAll("input")).toHaveLength(0);
    meter.focus();
    expect(document.activeElement).not.toBe(meter);
  });
});
