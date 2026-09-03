import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  assertWithinKeyboardFocusRingAtBothDensities,
  expectNoFocusRing,
} from "../../../test/assert-focus-ring";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import {
  CONTROL_MD,
  fkasExternal,
  px,
  renderThemed,
  stampDensity,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { NumberField } from "./number-field";

function renderField(node: ReactNode, locale: (typeof SUPPORTED_LOCALES)[number] = "en-US") {
  return renderThemed(withLocale(locale, node));
}

function fieldRootFrom(name: string): HTMLElement {
  const root = textboxNamed(name).closest("[data-slot=field]");
  if (!(root instanceof HTMLElement)) {
    throw new Error(`expected field root around ${name}`);
  }
  return root;
}

/** The label-row status glyphs: every icon in the field that is not a stepper button's. */
function statusSvgs(name: string): SVGElement[] {
  return [...fieldRootFrom(name).querySelectorAll("svg")].filter((svg) => svg.closest("button") === null);
}

function groupFrom(name: string): HTMLElement {
  const group = textboxNamed(name).parentElement;
  if (!(group instanceof HTMLElement)) {
    throw new Error(`expected field group around ${name}`);
  }
  return group;
}

function buttonNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected button ${name}`);
  }
  return element;
}

function stepperIn(fieldName: string, name: "Increase" | "Decrease"): HTMLElement {
  const match = [...fieldRootFrom(fieldName).querySelectorAll("button")].find(
    (button) => button.getAttribute("aria-label") === name
  );
  if (!(match instanceof HTMLElement)) {
    throw new Error(`expected ${name} stepper in ${fieldName}`);
  }
  return match;
}

describe("NumberField", () => {
  it("renders the input by textbox name and the steppers by button role", () => {
    renderField(
      <NumberField label="Quantity" description="Whole packs." denomination="kr" defaultValue={2} />
    );
    const input = textboxNamed("Quantity");
    expect(input.hasAttribute("data-focus-ring-control")).toBe(true);
    expect(page.getByRole("button", { name: "Increase", exact: true }).query()).toBeTruthy();
    expect(page.getByRole("button", { name: "Decrease", exact: true }).query()).toBeTruthy();
    expect(groupFrom("Quantity").textContent).toContain("kr");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(
      describedBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent)
        .includes("Whole packs.")
    ).toBe(true);
  });

  it("steps with ArrowUp/ArrowDown and clamps Home/End to min/max", async () => {
    const onChange = vi.fn();
    renderField(
      <NumberField
        label="Quantity"
        defaultValue={4}
        minValue={0}
        maxValue={10}
        step={2}
        onChange={onChange}
      />
    );
    const input = textboxNamed("Quantity");
    input.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(onChange).toHaveBeenLastCalledWith(6);
    await userEvent.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenLastCalledWith(4);
    await userEvent.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith(10);
    await userEvent.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("commits a typed value on blur and reports NaN when the input is cleared", async () => {
    const onChange = vi.fn();
    renderField(<NumberField label="Quantity" onChange={onChange} />);
    const input = textboxNamed("Quantity");
    await userEvent.fill(page.getByRole("textbox", { name: "Quantity", exact: true }), "12");
    input.blur();
    expect(onChange).toHaveBeenLastCalledWith(12);
  });

  it("reports NaN when the input is cleared", async () => {
    const onChange = vi.fn();
    renderField(<NumberField label="Quantity" onChange={onChange} />);
    await userEvent.fill(page.getByRole("textbox", { name: "Quantity", exact: true }), "12");
    expect(onChange).toHaveBeenLastCalledWith(12);
    await userEvent.keyboard("{Backspace}{Backspace}");
    expect(textboxNamed("Quantity")).toHaveProperty("value", "");
    expect(onChange).toHaveBeenLastCalledWith(NaN);
  });

  it("clamps values outside min/max on commit and disables steppers at bounds", async () => {
    const onChange = vi.fn();
    renderField(
      <NumberField label="Quantity" defaultValue={5} minValue={0} maxValue={10} onChange={onChange} />
    );
    const input = textboxNamed("Quantity");
    await userEvent.fill(page.getByRole("textbox", { name: "Quantity", exact: true }), "99");
    input.blur();
    expect(onChange).toHaveBeenLastCalledWith(10);
    expect(stepperIn("Quantity", "Increase")).toHaveProperty("disabled", true);
    expect(stepperIn("Quantity", "Decrease")).toHaveProperty("disabled", false);

    await userEvent.fill(page.getByRole("textbox", { name: "Quantity", exact: true }), "-4");
    input.blur();
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(stepperIn("Quantity", "Decrease")).toHaveProperty("disabled", true);
    expect(stepperIn("Quantity", "Increase")).toHaveProperty("disabled", false);
  });

  it("round-trips formatOptions and follows the provider locale, not navigator.language", () => {
    const formatOptions: Intl.NumberFormatOptions = {
      style: "decimal",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    };
    const value = 1234.5;
    const originalLanguage = Object.getOwnPropertyDescriptor(navigator, "language");
    Object.defineProperty(navigator, "language", {
      configurable: true,
      get: () => "de-DE",
    });

    try {
      for (const locale of SUPPORTED_LOCALES) {
        const { unmount } = renderField(
          <NumberField label="Amount" defaultValue={value} formatOptions={formatOptions} />,
          locale
        );
        expect(textboxNamed("Amount")).toHaveProperty(
          "value",
          new Intl.NumberFormat(locale, formatOptions).format(value)
        );
        unmount();
      }

      const german = new Intl.NumberFormat("de-DE", formatOptions).format(value);
      const english = new Intl.NumberFormat("en-US", formatOptions).format(value);
      expect(german).not.toBe(english);
      renderField(
        <NumberField label="Conflicting" defaultValue={value} formatOptions={formatOptions} />,
        "en-US"
      );
      expect(textboxNamed("Conflicting")).toHaveProperty("value", english);
      expect(textboxNamed("Conflicting")).not.toHaveProperty("value", german);
    } finally {
      if (originalLanguage === undefined) {
        Reflect.deleteProperty(navigator, "language");
      } else {
        Object.defineProperty(navigator, "language", originalLanguage);
      }
    }
  });

  it("disables the input and steppers, and keeps a read-only input focusable", async () => {
    renderField(
      <>
        <button type="button">Before</button>
        <NumberField label="Disabled" isDisabled defaultValue={3} />
        <NumberField label="Locked" isReadOnly defaultValue={7} />
        <NumberField label="Open" defaultValue={1} />
      </>
    );
    const disabled = textboxNamed("Disabled");
    expect(disabled).toHaveProperty("disabled", true);
    disabled.focus();
    expect(document.activeElement).not.toBe(disabled);

    const locked = textboxNamed("Locked");
    expect(locked).toHaveProperty("readOnly", true);
    locked.focus();
    expect(document.activeElement).toBe(locked);
    expect(stepperIn("Locked", "Increase").getAttribute("aria-disabled")).toBe("true");
    expect(stepperIn("Locked", "Decrease").getAttribute("aria-disabled")).toBe("true");
    expect(stepperIn("Disabled", "Increase").getAttribute("aria-disabled")).toBe("true");

    page.getByRole("button", { name: "Before", exact: true }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(locked);
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(textboxNamed("Open"));
  });

  it("sets aria-invalid on the group and shows the alert when errorMessage is present", () => {
    renderField(
      <>
        <NumberField label="Valid" defaultValue={1} />
        <NumberField label="Invalid" isInvalid defaultValue={1} />
        <NumberField label="Broken" isInvalid errorMessage="Enter a quantity." defaultValue={1} />
      </>
    );
    expect(groupFrom("Valid").hasAttribute("aria-invalid")).toBe(false);
    expect(groupFrom("Invalid").getAttribute("aria-invalid")).toBe("true");
    expect(groupFrom("Broken").getAttribute("aria-invalid")).toBe("true");
    expect(page.getByRole("alert").element().textContent).toBe("Enter a quantity.");
    const describedBy = textboxNamed("Broken").getAttribute("aria-describedby") ?? "";
    expect(describedBy.split(/\s+/)).toContain(page.getByRole("alert").element().id);
  });

  it("submits the numeric value through the hidden input", async () => {
    const submitted: Array<FormDataEntryValue | null> = [];
    renderField(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted.push(new FormData(event.currentTarget).get("qty"));
        }}>
        <NumberField label="Quantity" name="qty" defaultValue={6} />
        <button type="submit">Save</button>
      </form>
    );
    await userEvent.click(page.getByRole("button", { name: "Save", exact: true }));
    expect(submitted).toEqual(["6"]);
  });

  it("crossfades the pending and success faces in the label row, success winning", () => {
    renderField(
      <>
        <NumberField aria-label="Pending" isPending />
        <NumberField aria-label="Done" isPending isSuccess />
      </>
    );

    // number-field.md §8.7 (2026-09-03): the two faces crossfade like TextField's
    // instead of stacking side by side, so both are always in the DOM and exactly one
    // is opaque.
    expect(fieldRootFrom("Pending").querySelector("[data-slot=field-label]")).toBeNull();

    const pendingSvgs = statusSvgs("Pending");
    expect(pendingSvgs).toHaveLength(2);
    const pendingShown = pendingSvgs.filter((svg) => getComputedStyle(svg).opacity === "1");
    expect(pendingShown).toHaveLength(1);
    expect(pendingShown[0]?.classList.contains("animate-spin")).toBe(true);

    const doneSvgs = statusSvgs("Done");
    expect(doneSvgs).toHaveLength(2);
    const doneShown = doneSvgs.filter((svg) => getComputedStyle(svg).opacity === "1");
    expect(doneShown).toHaveLength(1);
    expect(doneShown[0]?.classList.contains("animate-spin")).toBe(false);
  });

  it("paints the within ring on the group for keyboard focus, at both densities", async () => {
    renderField(
      <>
        <button type="button">Before</button>
        <NumberField label="Quantity" defaultValue={1} />
      </>
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(previous instanceof HTMLElement)) {
      throw new Error("expected before");
    }
    await assertWithinKeyboardFocusRingAtBothDensities(
      previous,
      textboxNamed("Quantity"),
      groupFrom("Quantity")
    );
  });

  it("leaves the group ring unpainted for mouse focus on a stepper", async () => {
    renderField(
      <>
        <button type="button">Before</button>
        <NumberField label="Quantity" defaultValue={1} />
      </>
    );
    // Chromium always matches :focus-visible on a clicked text field, so the
    // mouse arm is probed on a stepper — the non-editable receiver. Clicking
    // the stepper focuses the input (base-ui); a prior mouse click sets the
    // modality so focusing the button itself is not :focus-visible.
    const before = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(before instanceof HTMLElement)) {
      throw new Error("expected before");
    }
    await userEvent.click(before);
    expect(before.matches(":focus-visible")).toBe(false);

    const increment = buttonNamed("Increase");
    increment.focus();
    expect(document.activeElement).toBe(increment);
    expect(increment.matches(":focus-visible")).toBe(false);
    expectNoFocusRing(groupFrom("Quantity"), "mouse focus on a stepper must not paint the group ring");
  });
});

describe("NumberField density metrics", () => {
  it("pins the field box to the signed md rung at both densities and does not rescope", () => {
    const { rerender } = renderField(<NumberField label="Meter" defaultValue={1} />);
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      expect(px(getComputedStyle(groupFrom("Meter")).height)).toBe(CONTROL_MD[density].height);
      expect(px(getComputedStyle(textboxNamed("Meter")).paddingInlineStart)).toBe(CONTROL_MD[density].px);
    }

    stampDensity("dense");
    rerender(
      <ThemeScope theme={fkasExternal}>
        {withLocale(
          "en-US",
          <div data-density="comfortable">
            <NumberField label="Meter" defaultValue={1} />
          </div>
        )}
      </ThemeScope>
    );
    expect(px(getComputedStyle(groupFrom("Meter")).height)).toBe(CONTROL_MD.dense.height);
  });
});
