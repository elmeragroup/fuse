import type { ReactNode } from "react";

import { CalendarDate } from "@internationalized/date";
import type { ValidationResult } from "react-aria-components";
import { DateField as RacDateField, Label as RacLabel } from "react-aria-components";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
// `styles.css` declares `--radius-md` in terms of `--radius` and `bg-card` in terms of
// `--card`, but defines neither; both live in `themes.css`. Without this second import
// every radius and fill below would compute to `0px` / `transparent` on both sides and
// the chrome-parity assertions would pass on nothing.
import "../../../dist/themes.css";
import { describedTextsFor, segmentLocator, segmentNamed } from "../../../test/rac-calendar-testing";
import {
  CONTROL_MD,
  cssVarColor,
  // This suite's own fieldRootFrom finds a DateField's root; the shared one a base-ui Field's.
  px,
  renderThemed,
  textboxNamed,
  textNamed,
} from "../../../test/themed-browser-render";
import { InputGroup } from "../../components/input-group";
import { Input } from "../../components/input/input";
import { TextField } from "../../components/text-field/text-field";
import { DatePicker } from "../date-picker/date-picker";
import { DateRangePicker } from "../date-range-picker/date-range-picker";
import { SearchField } from "../search-field/search-field";
import { UiProviders } from "../ui-providers/ui-providers";
import { DateField, DateInput } from "./date-field";

function renderField(node: ReactNode) {
  return renderThemed(
    <UiProviders locale="en-US" navigate={() => undefined}>
      {node}
    </UiProviders>
  );
}

/** The group box around a control: InputGroup's root or a React Aria FieldGroup. */
function groupAround(element: HTMLElement): HTMLElement {
  const box = element.closest('[role="group"]');
  if (!(box instanceof HTMLElement)) {
    throw new Error("expected a group around the control");
  }
  return box;
}

function groupNamed(name: string): HTMLElement {
  const element = page.getByRole("group", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected group ${name}`);
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
    await expect.element(segmentLocator("month")).toBeVisible();
    await expect.element(segmentLocator("day")).toBeVisible();
    await expect.element(segmentLocator("year")).toBeVisible();
    expect(spinbuttonsIn("Invoice date")).toHaveLength(3);
    expect(describedTextsForField("Invoice date")).toContain("Billing date.");
  });

  it("renders leading zeros on day and month by default", async () => {
    renderField(<DateField label="Invoice date" defaultValue={new CalendarDate(2026, 7, 4)} />);
    await expect.element(segmentLocator("month")).toBeVisible();
    expect(segmentNamed("month").textContent).toBe("07");
    expect(segmentNamed("day").textContent).toBe("04");
  });

  it("fires onChange with a DateValue, not an event", async () => {
    const onChange = vi.fn();
    renderField(<DateField label="Invoice date" defaultValue={july14} onChange={onChange} />);
    await expect.element(segmentLocator("month")).toBeVisible();
    segmentNamed("month").focus();
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

  it("composes a stateful DateInput className under field chrome", () => {
    renderField(
      <RacDateField defaultValue={july14} className="flex flex-col gap-1">
        <RacLabel>Custom start</RacLabel>
        <DateInput className={(renderProps) => (renderProps.isDisabled ? "opacity-25" : "min-w-[200px]")} />
      </RacDateField>
    );
    const group = groupNamed("Custom start");
    expect(getComputedStyle(group).backgroundColor).toBe(cssVarColor(group, "--card"));
    expect(px(getComputedStyle(group).height)).toBe(CONTROL_MD.dense.height);
    expect(group.className).toContain("min-w-[200px]");
    expect(spinbuttonsIn("Custom start").length).toBeGreaterThan(0);
  });
});

describe("DateField field-box chrome", () => {
  it("paints an invalid field's label in the error colour, as TextField does", () => {
    renderField(
      <>
        <TextField label="Customer" isInvalid errorMessage="Required" />
        <TextField label="Nickname" />
        <DateField label="Meter" isInvalid description="Meter date" />
        <DatePicker label="Start" isInvalid description="Start date" />
        <DateRangePicker label="Period" isInvalid description="Billing period" />
        <SearchField label="Find" isInvalid description="Search term" />
        <DateField label="Due" />
        <DatePicker label="Issued" />
        <SearchField label="Filter" />
      </>
    );
    // Unit: each React Aria field's label colour. Oracle: an invalid TextField's label, which
    // `Field.Root` paints with `--error`, and which a valid label must not share.
    const invalidLabel = getComputedStyle(textNamed("Customer")).color;
    const validLabel = getComputedStyle(textNamed("Nickname")).color;
    expect(invalidLabel).toBe(cssVarColor(textNamed("Customer"), "--error"));
    expect(invalidLabel).not.toBe(validLabel);

    for (const [label, description] of [
      ["Meter", "Meter date"],
      ["Start", "Start date"],
      ["Period", "Billing period"],
      ["Find", "Search term"],
    ] as const) {
      expect(getComputedStyle(textNamed(label)).color, `${label} label`).toBe(invalidLabel);
      // The help text keeps its own muted colour under the invalid root.
      expect(getComputedStyle(textNamed(description)).color, `${label} description`).toBe(
        cssVarColor(textNamed(description), "--muted-foreground")
      );
    }
    // A valid field of each recipe keeps the valid TextField's colour, so the rule is gated on
    // `data-invalid` rather than painting every label.
    for (const label of ["Due", "Issued", "Filter"]) {
      expect(getComputedStyle(textNamed(label)).color, `${label} label`).toBe(validLabel);
    }
  });

  it("keeps the disabled fill on a disabled box that is also read-only", () => {
    renderField(
      <>
        <Input aria-label="Disabled" disabled />
        <Input aria-label="Disabled read-only" disabled readOnly />
        <InputGroup.Root>
          <InputGroup.Input aria-label="Grouped disabled" disabled />
        </InputGroup.Root>
        <InputGroup.Root>
          <InputGroup.Input aria-label="Grouped disabled read-only" disabled readOnly />
        </InputGroup.Root>
      </>
    );
    const fill = (element: HTMLElement): string => getComputedStyle(element).backgroundColor;
    const rootFill = (name: string): string => fill(groupAround(textboxNamed(name)));
    // Oracle: the same box disabled without `readOnly`.
    expect(fill(textboxNamed("Disabled read-only"))).toBe(fill(textboxNamed("Disabled")));
    expect(rootFill("Grouped disabled read-only")).toBe(rootFill("Grouped disabled"));
  });
});
