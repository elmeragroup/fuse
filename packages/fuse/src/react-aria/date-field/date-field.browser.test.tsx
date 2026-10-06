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
import { assertStateFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { describedTextsFor, segmentLocator, segmentNamed } from "../../../test/rac-calendar-testing";
import {
  CONTROL_MD,
  cssVarColor,
  // This suite's own fieldRootFrom finds a DateField's root; the shared one a base-ui Field's.
  fieldRootFrom as baseFieldRootFrom,
  fkasExternal,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { InputGroup } from "../../components/input-group";
import { Input } from "../../components/input/input";
import { TextField } from "../../components/text-field/text-field";
import { Textarea } from "../../components/textarea/textarea";
import { fieldCornerClass } from "../../styles/corner-radius";
import { ThemeScope } from "../../theme";
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

function segmentInsetsIn(name: string) {
  const box = groupNamed(name).getBoundingClientRect();
  const segments = spinbuttonsIn(name).map((segment) => segment.getBoundingClientRect());
  const top = Math.min(...segments.map((rect) => rect.top));
  const bottom = Math.max(...segments.map((rect) => rect.bottom));
  return { top: top - box.top, bottom: box.bottom - bottom, slack: box.height - (bottom - top) };
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
    expect(getComputedStyle(root).display).toBe("flex");
    expect(getComputedStyle(root).flexDirection).toBe("column");
    expect(px(getComputedStyle(root).rowGap)).toBe(8);
    expect(getComputedStyle(rootGroup).backgroundColor).toBe(cssVarColor(rootGroup, "--card"));
    expect(px(getComputedStyle(rootGroup).height)).toBe(CONTROL_MD.dense.height);
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

  it("paints the shared state ring on the DateInput for keyboard focus at both densities", async () => {
    renderField(
      <>
        <button type="button">Before</button>
        <DateField label="Invoice date" defaultValue={july14} />
      </>
    );
    await expect.element(segmentLocator("month")).toBeVisible();
    await assertStateFocusRingAtBothDensities(
      buttonNamed("Before"),
      segmentNamed("month"),
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

  it("centers the segment row in the field box at both densities", () => {
    renderField(<DateField label="Meter" defaultValue={july14} />);
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const inset = segmentInsetsIn("Meter");
      expect(inset.slack, `the ${density} box has no slack to distribute`).toBeGreaterThan(1);
      expect(inset.top, `segment row is off-center at ${density}`).toBeCloseTo(inset.bottom, 1);
    }
  });
});

describe("DateField field-box chrome", () => {
  // DateField's box is Input's box, so a form
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

    // The field corner's classes, from their shared owner.
    for (const rung of [...fieldCornerClass.split(" "), "shadow-xs"]) {
      expect(dateElement.classList.contains(rung), `DateField lost ${rung}`).toBe(true);
      expect(inputElement.classList.contains(rung), `Input lost ${rung}`).toBe(true);
    }
    // The interim tier's old rung is gone from both sides, not just from the one that moved.
    expect(dateElement.classList.contains("rounded-lg")).toBe(false);
    expect(inputElement.classList.contains("rounded-lg")).toBe(false);
  });

  it("paints the read-only fill on every read-only field box", async () => {
    renderField(
      <>
        <DateField label="Meter" isReadOnly defaultValue={july14} />
        <Input aria-label="Reading" readOnly defaultValue="Locked" />
        <Textarea aria-label="Note" readOnly defaultValue="Locked" />
        <TextField label="Customer" isReadOnly defaultValue="Locked" />
        <TextField label="Nickname" variant="inline" isReadOnly defaultValue="Locked" />
        <TextField label="Annual usage" variant="card" isReadOnly defaultValue="4200" />
        <InputGroup.Root>
          <InputGroup.Addon>
            <InputGroup.Text>kr</InputGroup.Text>
          </InputGroup.Addon>
          <InputGroup.Input aria-label="Amount" readOnly defaultValue="120" />
        </InputGroup.Root>
        <SearchField label="Find" isReadOnly defaultValue="Locked" />
        <Input aria-label="Editable" />
      </>
    );
    const dateElement = groupNamed("Meter");
    // Unit: each box's computed fill. Oracle: DateField's FieldGroup `isReadOnly` face, which
    // paints `--muted`, the fill every other read-only field box must reproduce.
    const readOnlyFill = getComputedStyle(dateElement).backgroundColor;
    expect(readOnlyFill).toBe(cssVarColor(dateElement, "--muted"));
    // Not the resting fill, so the equalities below cannot pass on two editable boxes.
    expect(readOnlyFill).not.toBe(getComputedStyle(textboxNamed("Editable")).backgroundColor);

    for (const name of ["Reading", "Note", "Customer", "Nickname"]) {
      expect.soft(getComputedStyle(textboxNamed(name)).backgroundColor, name).toBe(readOnlyFill);
    }
    // A box that wraps its control paints the fill once, and the control inside stays clear.
    const wrapped = [
      { name: "Annual usage", control: textboxNamed("Annual usage"), box: baseFieldRootFrom("Annual usage") },
      { name: "Amount", control: textboxNamed("Amount"), box: groupAround(textboxNamed("Amount")) },
      {
        name: "Find",
        control: roleNamed("searchbox", "Find"),
        box: groupAround(roleNamed("searchbox", "Find")),
      },
    ];
    for (const { name, control, box } of wrapped) {
      expect.soft(getComputedStyle(box).backgroundColor, `${name} box`).toBe(readOnlyFill);
      expect.soft(getComputedStyle(control).backgroundColor, `${name} control`).toBe("rgba(0, 0, 0, 0)");
    }

    // The inline field's hover reveal does not repaint a read-only one as editable.
    await userEvent.hover(textboxNamed("Nickname"));
    expect(getComputedStyle(textboxNamed("Nickname")).backgroundColor).toBe(readOnlyFill);
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
