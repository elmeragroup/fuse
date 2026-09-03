import type { ReactNode } from "react";

import { CalendarDate, CalendarDateTime } from "@internationalized/date";
import type { ValidationResult } from "react-aria-components";
import { DateField as RacDateField, I18nProvider, Label as RacLabel } from "react-aria-components";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
// `styles.css` declares `--radius-md` in terms of `--radius` and `bg-card` in terms of
// `--card`, but defines neither; both live in `themes.css`. Without this second import
// every radius and fill below would compute to `0px` / `transparent` on both sides and
// the chrome-parity assertions would pass on nothing.
import "../../../dist/themes.css";
import { assertStateFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { describedTextsFor } from "../../../test/rac-calendar-testing";
import {
  CONTROL_MD,
  fkasExternal,
  px,
  renderThemed,
  stampDensity,
} from "../../../test/themed-browser-render";
import { Input } from "../../components/input/input";
import { ThemeScope } from "../../theme";
import { UiProviders } from "../ui-providers/ui-providers";
import { DateField, DateInput } from "./date-field";

function renderField(node: ReactNode) {
  return renderThemed(
    <UiProviders locale="en-US" navigate={() => undefined}>
      {node}
    </UiProviders>
  );
}

function groupNamed(name: string): HTMLElement {
  const element = page.getByRole("group", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected group ${name}`);
  }
  return element;
}

function spinbuttonNamed(name: string): HTMLElement {
  const element = page.getByRole("spinbutton", { name }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected spinbutton ${name}`);
  }
  return element;
}

function spinbuttonsIn(name: string): HTMLElement[] {
  return page
    .getByRole("spinbutton")
    .elements()
    .filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && groupNamed(name).contains(element)
    );
}

function fieldRootFrom(name: string): HTMLElement {
  const root = groupNamed(name).parentElement;
  if (!(root instanceof HTMLElement)) {
    throw new Error(`expected DateField root around ${name}`);
  }
  return root;
}

function buttonNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected button ${name}`);
  }
  return element;
}

/**
 * Both hosts RAC can hang `aria-describedby` on for one field: the field-box group and
 * the DateField root above it.
 */
function describedHostsFor(name: string): HTMLElement[] {
  const group = groupNamed(name);
  const root = group.parentElement;
  return root instanceof HTMLElement ? [group, root] : [group];
}

function describedTargetsFor(name: string): HTMLElement[] {
  const ids = describedHostsFor(name).flatMap((host) =>
    (host.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean)
  );
  return [
    ...new Set(
      ids
        .map((id) => document.getElementById(id))
        .filter((node): node is HTMLElement => node instanceof HTMLElement)
    ),
  ];
}

function describedTextsForField(name: string): string[] {
  return [...new Set(describedHostsFor(name).flatMap((host) => describedTextsFor(host)))];
}

const july14 = new CalendarDate(2026, 7, 14);

describe("DateField", () => {
  it("names the segment group from the label and exposes day/month/year spinbuttons", async () => {
    renderField(<DateField label="Invoice date" description="Billing date." defaultValue={july14} />);
    expect(groupNamed("Invoice date")).toBeTruthy();
    await expect.element(page.getByRole("spinbutton", { name: "month" })).toBeVisible();
    await expect.element(page.getByRole("spinbutton", { name: "day" })).toBeVisible();
    await expect.element(page.getByRole("spinbutton", { name: "year" })).toBeVisible();
    expect(spinbuttonsIn("Invoice date")).toHaveLength(3);
    expect(describedTextsForField("Invoice date")).toContain("Billing date.");
  });

  it("traverses segments with arrows, increments, and backspaces to a placeholder", async () => {
    renderField(<DateField label="Invoice date" defaultValue={july14} />);
    const month = spinbuttonNamed("month");
    const day = spinbuttonNamed("day");
    const year = spinbuttonNamed("year");
    month.focus();
    expect(document.activeElement).toBe(month);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(day);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(year);
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(day);
    month.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(month.textContent).toBe("08");
    await userEvent.keyboard("{ArrowDown}");
    expect(month.textContent).toBe("07");
    day.focus();
    await userEvent.keyboard("{Backspace}{Backspace}");
    expect(day.hasAttribute("data-placeholder")).toBe(true);
  });

  it("fills an empty day segment by typing 14 and auto-advances to month", async () => {
    renderField(
      <I18nProvider locale="en-GB">
        <DateField label="Invoice date" />
      </I18nProvider>
    );
    const day = spinbuttonNamed("day");
    const month = spinbuttonNamed("month");
    expect(day.hasAttribute("data-placeholder")).toBe(true);
    expect(day.getAttribute("aria-valuenow")).not.toBe("14");
    day.focus();
    await userEvent.keyboard("14");
    expect(day.getAttribute("aria-valuenow")).toBe("14");
    expect(document.activeElement).toBe(month);
  });

  it("renders leading zeros on day and month by default", async () => {
    renderField(<DateField label="Invoice date" defaultValue={new CalendarDate(2026, 7, 4)} />);
    await expect.element(page.getByRole("spinbutton", { name: "month" })).toBeVisible();
    expect(spinbuttonNamed("month").textContent).toBe("07");
    expect(spinbuttonNamed("day").textContent).toBe("04");
  });

  it("fires onChange with a DateValue, not an event", async () => {
    const onChange = vi.fn();
    renderField(<DateField label="Invoice date" defaultValue={july14} onChange={onChange} />);
    await expect.element(page.getByRole("spinbutton", { name: "month" })).toBeVisible();
    spinbuttonNamed("month").focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ year: 2026, month: 8, day: 14 })
    );
    expect(onChange.mock.calls.at(-1)?.[0]).not.toHaveProperty("nativeEvent");
    expect(onChange.mock.calls.at(-1)?.[0]).not.toBeInstanceOf(Event);
  });

  it("marks min/max violations invalid and associates string and function errors", async () => {
    let functionValidation: ValidationResult | undefined;
    renderField(
      <>
        <DateField
          label="String error"
          defaultValue={new CalendarDate(2026, 1, 1)}
          minValue={new CalendarDate(2026, 6, 1)}
          maxValue={new CalendarDate(2026, 12, 31)}
          validationBehavior="aria"
          errorMessage="Date is out of range"
        />
        <DateField
          label="Function error"
          defaultValue={new CalendarDate(2026, 1, 1)}
          minValue={new CalendarDate(2026, 6, 1)}
          maxValue={new CalendarDate(2026, 12, 31)}
          validationBehavior="aria"
          errorMessage={(result) => {
            functionValidation = result;
            return (
              <span role="status" aria-label="Function error details">
                Out of range
              </span>
            );
          }}
        />
      </>
    );
    expect(fieldRootFrom("String error")).toHaveAttribute("data-invalid");
    expect(fieldRootFrom("Function error")).toHaveAttribute("data-invalid");
    expect(functionValidation?.isInvalid).toBe(true);
    expect(describedTextsForField("String error")).toContain("Date is out of range");
    const functionError = page.getByRole("status", { name: "Function error details" });
    await expect.element(functionError).toBeVisible();
    const functionErrorNode = functionError.element();
    if (!(functionErrorNode instanceof HTMLElement)) {
      throw new Error("expected function error node");
    }
    expect(fieldRootFrom("Function error").contains(functionErrorNode)).toBe(true);
    expect(
      describedTargetsFor("Function error").some(
        (target) => target === functionErrorNode || target.contains(functionErrorNode)
      ),
      "function error must be associated via aria-describedby"
    ).toBe(true);
    expect(describedTextsForField("Function error")).toContain("Out of range");
  });

  it("skips disabled segments and keeps read-only segments focusable but inert", async () => {
    renderField(
      <>
        <button type="button">Before</button>
        <DateField label="Disabled" isDisabled defaultValue={july14} />
        <DateField label="Locked" isReadOnly defaultValue={july14} />
        <DateField label="Open" defaultValue={july14} />
      </>
    );
    const before = buttonNamed("Before");
    before.focus();
    await userEvent.keyboard("{Tab}");
    expect(groupNamed("Disabled").contains(document.activeElement)).toBe(false);
    expect(groupNamed("Locked").contains(document.activeElement)).toBe(true);
    const lockedMonth = spinbuttonsIn("Locked")[0];
    if (lockedMonth === undefined) {
      throw new Error("expected a locked segment");
    }
    const beforeValue = lockedMonth.textContent;
    lockedMonth.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(lockedMonth.textContent).toBe(beforeValue);
  });

  it("submits the ISO date string under name", async () => {
    const submitted: Array<FormDataEntryValue | null> = [];
    renderField(
      <form
        aria-label="Invoice"
        onSubmit={(event) => {
          event.preventDefault();
          submitted.push(new FormData(event.currentTarget).get("invoice"));
        }}>
        <DateField label="Invoice date" name="invoice" defaultValue={july14} />
        <button type="submit">Save</button>
      </form>
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    expect(submitted).toEqual(["2026-07-14"]);
  });

  it("composes a stateful className under the required DateField base classes", () => {
    renderField(
      <DateField
        label="Root callback"
        defaultValue={july14}
        className={(renderProps) => (renderProps.isDisabled ? "opacity-80" : "gap-2")}
      />
    );
    const rootGroup = groupNamed("Root callback");
    const root = rootGroup.parentElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error("expected DateField root");
    }
    expect(root.className.split(/\s+/)).toEqual(expect.arrayContaining(["flex", "flex-col", "gap-2"]));
    expect(rootGroup.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["bg-card", "h-(--control-h-md)"])
    );
  });

  it("composes a stateful DateInput className under field chrome", () => {
    renderField(
      <RacDateField defaultValue={july14} className="flex flex-col gap-1">
        <RacLabel>Custom start</RacLabel>
        <DateInput className={(renderProps) => (renderProps.isDisabled ? "opacity-25" : "min-w-[200px]")} />
      </RacDateField>
    );
    const group = groupNamed("Custom start");
    const classes = group.className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(["bg-card", "h-(--control-h-md)", "min-w-[200px]"]));
    expect(spinbuttonsIn("Custom start").length).toBeGreaterThan(0);
  });

  it("paints the shared state ring on the DateInput for keyboard focus at both densities", async () => {
    renderField(
      <>
        <button type="button">Before</button>
        <DateField label="Invoice date" defaultValue={july14} />
      </>
    );
    await expect.element(page.getByRole("spinbutton", { name: "month" })).toBeVisible();
    await assertStateFocusRingAtBothDensities(
      buttonNamed("Before"),
      spinbuttonNamed("month"),
      groupNamed("Invoice date")
    );
  });
});

describe("DateField density metrics", () => {
  it("pins DateInput to the signed md rung at both densities and does not rescope", () => {
    const { rerender } = renderField(<DateField label="Meter" defaultValue={july14} />);
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const style = getComputedStyle(groupNamed("Meter"));
      expect(px(style.height)).toBe(CONTROL_MD[density].height);
      expect(px(style.paddingInlineStart)).toBe(CONTROL_MD[density].px);
      expect(px(style.fontSize)).toBe(CONTROL_MD[density].font);
      expect(px(style.lineHeight)).toBe(CONTROL_MD[density].leading);
    }

    stampDensity("dense");
    rerender(
      <ThemeScope theme={fkasExternal}>
        <UiProviders locale="en-US" navigate={() => undefined}>
          <div data-density="comfortable">
            <DateField label="Meter" defaultValue={july14} />
          </div>
        </UiProviders>
      </ThemeScope>
    );
    expect(px(getComputedStyle(groupNamed("Meter")).height)).toBe(CONTROL_MD.dense.height);
  });
});

describe("DateField hour granularity", () => {
  it("exposes an hour spinbutton when granularity is hour", async () => {
    renderField(
      <DateField
        label="Appointment"
        granularity="hour"
        hourCycle={24}
        defaultValue={new CalendarDateTime(2026, 7, 14, 15)}
      />
    );
    await expect.element(page.getByRole("spinbutton", { name: "hour" })).toBeVisible();
    expect(spinbuttonsIn("Appointment").length).toBeGreaterThan(3);
  });
});

describe("DateField field-box chrome", () => {
  // spec 08 user story 6 / §8.9 (2026-09-03): DateField's box is Input's box, so a form
  // that mixes the interim tier with the base-ui tier has one field chrome. The file
  // imports `themes.css` alongside `styles.css` so all four computed comparisons resolve
  // to real values rather than to two matching zeroes.
  it("paints the same box as Input in the same form", () => {
    renderField(
      <>
        <DateField label="Meter" defaultValue={july14} />
        <Input aria-label="Reading" />
      </>
    );
    const dateElement = groupNamed("Meter");
    const inputElement = page.getByRole("textbox", { name: "Reading" }).element();
    const dateBox = getComputedStyle(dateElement);
    const inputBox = getComputedStyle(inputElement);

    expect(dateBox.borderRadius).toBe(inputBox.borderRadius);
    expect(dateBox.boxShadow).toBe(inputBox.boxShadow);
    expect(dateBox.borderTopWidth).toBe(inputBox.borderTopWidth);
    expect(dateBox.backgroundColor).toBe(inputBox.backgroundColor);

    // Each rung is a real value, not two matching defaults: an unresolved `--radius` or
    // `--card` would make the four equalities above vacuous.
    expect(dateBox.boxShadow).not.toBe("none");
    expect(px(dateBox.borderRadius)).toBeGreaterThan(0);
    expect(px(dateBox.borderTopWidth)).toBeGreaterThan(0);
    expect(dateBox.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");

    for (const rung of ["rounded-md", "shadow-xs"]) {
      expect(dateElement.classList.contains(rung), `DateField lost ${rung}`).toBe(true);
      expect(inputElement.classList.contains(rung), `Input lost ${rung}`).toBe(true);
    }
    // The interim tier's old rung is gone from both sides, not just from the one that moved.
    expect(dateElement.classList.contains("rounded-lg")).toBe(false);
    expect(inputElement.classList.contains("rounded-lg")).toBe(false);
  });
});
