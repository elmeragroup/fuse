import { useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { CalendarDate } from "@internationalized/date";
import type { ValidationResult } from "react-aria-components";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import {
  calendarGrid,
  calendarRoot,
  cellNamed,
  dayNamed,
  describedTextsFor,
  navButtonNamed,
} from "../../../test/rac-calendar-testing";
import {
  CONTROL_MD,
  cssVarColor,
  fkasExternal,
  px,
  renderThemed,
  stampDensity,
} from "../../../test/themed-browser-render";
import { Dialog } from "../../components/dialog/dialog";
import { ThemeScope } from "../../theme/theme-scope";
import { UiProviders } from "../ui-providers/ui-providers";
import { DatePicker, DatePickerPresetGroup, DatePickerPresetItem } from "./date-picker";

function renderPicker(node: ReactNode) {
  return renderThemed(
    <UiProviders locale="en-US" navigate={() => undefined}>
      {node}
    </UiProviders>
  );
}

/**
 * The trigger. RAC's `useDatePicker` owns the name — "Calendar" plus the field label —
 * so the composite never invents copy for it (date-picker.md §7/§8.2).
 */
function trigger(): HTMLElement {
  const element = page.getByRole("button", { name: /^calendar/i }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected the calendar trigger");
  }
  return element;
}

function groupNamed(name: string): HTMLElement {
  const element = page.getByRole("group", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected group ${name}`);
  }
  return element;
}

function dateInputRow(name: string): HTMLElement {
  const segment = spinbuttonNamed("month");
  const row = segment.parentElement;
  if (!(row instanceof HTMLElement) || !groupNamed(name).contains(row)) {
    throw new Error(`expected DateInput around ${name}`);
  }
  return row;
}

function spinbuttonNamed(name: string): HTMLElement {
  const element = page.getByRole("spinbutton", { name }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected spinbutton ${name}`);
  }
  return element;
}

function pickerDialog(): HTMLElement {
  const element = page.getByRole("dialog").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected the picker dialog");
  }
  return element;
}

function buttonNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected button ${name}`);
  }
  return element;
}

/**
 * A preset's pointer target. RAC keeps the `radio` element visually hidden inside the
 * label that carries the visible copy, so the item is *found* by its role and name and
 * *clicked* on the label the user actually sees.
 */
function presetTargetNamed(name: string): HTMLElement {
  const label = page.getByRole("radio", { name, exact: true }).element().closest("label");
  if (!(label instanceof HTMLElement)) {
    throw new Error(`expected the preset label for ${name}`);
  }
  return label;
}

/** The pane wrapper the composite puts around the preset group and the calendar (§2). */
function paneAroundCalendar(): HTMLElement {
  const pane = calendarRoot().parentElement;
  if (!(pane instanceof HTMLElement)) {
    throw new Error("expected the dialog's pane wrapper");
  }
  return pane;
}

async function openPicker(): Promise<HTMLElement> {
  await userEvent.click(trigger());
  await expect.element(page.getByRole("dialog")).toBeVisible();
  return pickerDialog();
}

const march10 = new CalendarDate(2026, 3, 10);
const july4 = new CalendarDate(2026, 7, 4);
const july14 = new CalendarDate(2026, 7, 14);

function presets(): ReactElement {
  return (
    <DatePickerPresetGroup>
      <DatePickerPresetItem value="today">Today</DatePickerPresetItem>
      <DatePickerPresetItem value="in-a-week" isCloseDialogOnDoubleClick>
        In a week
      </DatePickerPresetItem>
    </DatePickerPresetGroup>
  );
}

/**
 * A controlled picker, for the cases that need the value driven from outside the
 * composite. The focused-month sync reads the picker state's committed value, so it
 * behaves the same here as on an uncontrolled `defaultValue` picker (§2/§8.12).
 */
function ControlledPicker(): ReactElement {
  const [value, setValue] = useState<CalendarDate | null>(july14);
  return <DatePicker label="Invoice date" onChange={setValue} value={value} />;
}

describe("DatePicker", () => {
  it("names the field group from the label, exposes segment spinbuttons and a named collapsed trigger", async () => {
    renderPicker(<DatePicker label="Invoice date" description="Billing date." defaultValue={july14} />);
    const group = groupNamed("Invoice date");

    expect(group.getAttribute("data-slot")).toBe("field-group");
    await expect.element(page.getByRole("spinbutton", { name: "month" })).toBeVisible();
    await expect.element(page.getByRole("spinbutton", { name: "day" })).toBeVisible();
    await expect.element(page.getByRole("spinbutton", { name: "year" })).toBeVisible();
    expect(describedTextsFor(group)).toContain("Billing date.");

    const trigger_ = trigger();
    expect(trigger_).toHaveAttribute("aria-expanded", "false");
    expect(trigger_).toHaveAttribute("aria-haspopup", "dialog");
    expect(page.getByRole("dialog").query()).toBeNull();
    // The glyph is decoration; the button's own name carries the meaning (§2).
    expect(trigger_.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("opens a named dialog holding the calendar grid and commits a day with Enter", async () => {
    const onChange = vi.fn();
    renderPicker(<DatePicker label="Invoice date" value={march10} onChange={onChange} />);
    const dialog = await openPicker();

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    await expect.element(page.getByRole("grid")).toBeVisible();
    expect(dialog.contains(calendarGrid())).toBe(true);
    // The dialog keeps RAC's own name; an unnamed overlay would be an AT dead end (§7).
    await expect.element(page.getByRole("dialog", { name: /calendar/i })).toBeVisible();
    expect(cellNamed(/Tuesday, March 10, 2026/i)).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(dayNamed(/Tuesday, March 10, 2026/i));

    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ year: 2026, month: 3, day: 10 }));
    expect(onChange.mock.calls[0]?.[0]).not.toBeInstanceOf(Event);
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape without a change and returns focus to the trigger", async () => {
    const onChange = vi.fn();
    renderPicker(<DatePicker label="Invoice date" value={march10} onChange={onChange} />);
    await openPicker();

    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("reopens on the value's month after the user paged away and closed", async () => {
    renderPicker(<DatePicker label="Invoice date" value={march10} />);
    await openPicker();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/March\s+2026/i);

    await userEvent.keyboard("{PageDown}{PageDown}");
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/May\s+2026/i);

    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    await openPicker();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/March\s+2026/i);
  });

  it("reopens an uncontrolled picker on its defaultValue's month after paging away", async () => {
    // The sync reads the picker state's committed value, so `defaultValue` alone — with
    // no `value` prop in sight — still lands the reopen on July (§8.12).
    renderPicker(<DatePicker label="Invoice date" defaultValue={july14} />);
    await openPicker();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/July\s+2026/i);

    await userEvent.keyboard("{PageDown}{PageDown}");
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/September\s+2026/i);

    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    await openPicker();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/July\s+2026/i);
  });

  it("opens an uncontrolled picker on the month of the day the user last chose", async () => {
    renderPicker(<DatePicker label="Invoice date" defaultValue={july14} />);
    await openPicker();

    // Page to September and commit the focused day: the uncontrolled value is now the
    // picker's own, and reopening has to follow it rather than the initial default.
    await userEvent.keyboard("{PageDown}{PageDown}{Enter}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(spinbuttonNamed("month").textContent).toBe("09");

    await openPicker();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/September\s+2026/i);
  });

  it("opens on the current month when there is no value", async () => {
    const currentMonth = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
      new Date()
    );
    renderPicker(<DatePicker label="Invoice date" />);
    await openPicker();

    expect(calendarGrid().getAttribute("aria-label")).toBe(currentMonth);
  });

  it("follows a value change to its month while the dialog stays open", async () => {
    const november3 = new CalendarDate(2026, 11, 3);
    function PresetDriven(): ReactElement {
      const [value, setValue] = useState<CalendarDate | null>(july14);
      return (
        <DatePicker
          label="Invoice date"
          onChange={setValue}
          presetGroup={
            <DatePickerPresetGroup onChange={() => setValue(november3)}>
              <DatePickerPresetItem value="november">Early November</DatePickerPresetItem>
            </DatePickerPresetGroup>
          }
          value={value}
        />
      );
    }
    renderPicker(<PresetDriven />);
    await openPicker();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/July\s+2026/i);

    // A preset lives inside the popover, so the value can change while it stays open —
    // which is the case the value effect (rather than the per-open mount) exists for (§2).
    await userEvent.click(presetTargetNamed("Early November"));
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/November\s+2026/i);
    expect(spinbuttonNamed("month").textContent).toBe("11");
  });

  it("renders leading zeros on day and month by default", async () => {
    renderPicker(<DatePicker label="Invoice date" defaultValue={july4} />);
    await expect.element(page.getByRole("spinbutton", { name: "month" })).toBeVisible();

    expect(spinbuttonNamed("month").textContent).toBe("07");
    expect(spinbuttonNamed("day").textContent).toBe("04");
  });

  it("drops the leading zeros when a caller turns them off", async () => {
    renderPicker(<DatePicker label="Invoice date" defaultValue={july4} shouldForceLeadingZeros={false} />);
    await expect.element(page.getByRole("spinbutton", { name: "month" })).toBeVisible();

    expect(spinbuttonNamed("month").textContent).toBe("7");
    expect(spinbuttonNamed("day").textContent).toBe("4");
  });

  it("renders a function errorMessage from the ValidationResult and associates it", async () => {
    let seen: ValidationResult | undefined;
    renderPicker(
      <DatePicker
        label="Invoice date"
        defaultValue={new CalendarDate(2026, 1, 1)}
        minValue={july4}
        validationBehavior="aria"
        errorMessage={(validation) => {
          seen = validation;
          return (
            <span role="status" aria-label="Invoice date error details">
              {validation.validationErrors.join(" ")}
            </span>
          );
        }}
      />
    );
    const error = page.getByRole("status", { name: "Invoice date error details" });
    await expect.element(error).toBeVisible();
    const errorNode = error.element();
    if (!(errorNode instanceof HTMLElement)) {
      throw new Error("expected the error node");
    }

    expect(seen?.isInvalid).toBe(true);
    expect(seen?.validationErrors.length).toBeGreaterThan(0);
    expect(errorNode.textContent).not.toBe("");
    const group = groupNamed("Invoice date");
    const root = group.parentElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error("expected the DatePicker root");
    }
    expect(root).toHaveAttribute("data-invalid");
    expect(describedTextsFor(group)).toContain(errorNode.textContent);
  });

  it("renders no error node while the picker is valid", async () => {
    renderPicker(
      <DatePicker label="Invoice date" defaultValue={july14} errorMessage={<span>Required</span>} />
    );
    await expect.element(page.getByRole("spinbutton", { name: "month" })).toBeVisible();

    expect(document.body.textContent).not.toContain("Required");
  });

  it("fills the read-only field with the muted surface and keeps the popover closed", async () => {
    renderPicker(<DatePicker label="Invoice date" isReadOnly value={july14} />);
    const group = groupNamed("Invoice date");
    const glyph = group.querySelector("svg");
    if (!(glyph instanceof SVGElement)) {
      throw new Error("expected the trigger glyph");
    }

    // The FieldGroup's own `isReadOnly` axis paints the fill, exactly once. The glyph is
    // deliberately untinted: `bg-muted` on the `<svg>` never belonged there and went with
    // the picker recipe's duplicate arm (§8.11, 2026-09-03).
    expect(getComputedStyle(group).backgroundColor).toBe(cssVarColor(group, "--muted"));
    expect(group.getAttribute("data-readonly")).toBe("true");
    expect(getComputedStyle(glyph).backgroundColor).not.toBe(cssVarColor(group, "--muted"));
    expect(trigger()).toBeDisabled();

    await userEvent.click(trigger(), { force: true });
    expect(page.getByRole("dialog").query()).toBeNull();
  });
});

describe("DatePicker presets", () => {
  it("exposes a locale-named radiogroup whose items are named by their visible copy", async () => {
    renderPicker(<DatePicker label="Invoice date" value={march10} presetGroup={presets()} />);
    await openPicker();
    const radiogroup = page.getByRole("radiogroup", { name: "Date presets" }).element();
    if (!(radiogroup instanceof HTMLElement)) {
      throw new Error("expected the preset radiogroup");
    }

    expect(radiogroup.getAttribute("data-slot")).toBe("date-picker-preset-group");
    await expect.element(page.getByRole("radio", { name: "Today", exact: true })).toBeVisible();
    await expect.element(page.getByRole("radio", { name: "In a week", exact: true })).toBeVisible();
    // The name is the visible copy — never English synthesised from `value` (§8.8).
    expect(page.getByRole("radio", { name: /preset option/i }).query()).toBeNull();
    expect(presetTargetNamed("Today").getAttribute("data-slot")).toBe("date-picker-preset-item");
    expect(pickerDialog().contains(radiogroup)).toBe(true);
    expect(pickerDialog().contains(calendarGrid())).toBe(true);
  });

  it("selects on a single click and leaves the dialog open", async () => {
    renderPicker(<DatePicker label="Invoice date" value={march10} presetGroup={presets()} />);
    await openPicker();

    await userEvent.click(presetTargetNamed("Today"));
    await expect.element(page.getByRole("radio", { name: "Today", exact: true })).toBeChecked();
    expect(presetTargetNamed("Today")).toHaveAttribute("data-selected");
    await expect.element(page.getByRole("dialog")).toBeVisible();
  });

  it("moves between presets with the arrow keys and selects with Space", async () => {
    renderPicker(<DatePicker label="Invoice date" value={march10} presetGroup={presets()} />);
    await openPicker();
    const today = page.getByRole("radio", { name: "Today", exact: true }).element();
    if (!(today instanceof HTMLElement)) {
      throw new Error("expected the first preset");
    }

    today.focus();
    await userEvent.keyboard(" ");
    await expect.element(page.getByRole("radio", { name: "Today", exact: true })).toBeChecked();

    await userEvent.keyboard("{ArrowDown}");
    await expect.element(page.getByRole("radio", { name: "In a week", exact: true })).toBeChecked();
    await expect.element(page.getByRole("dialog")).toBeVisible();
  });

  it("closes the dialog on double-click only where the caller opted in, after its own handler", async () => {
    const onDoubleClick = vi.fn();
    renderPicker(
      <DatePicker
        label="Invoice date"
        value={march10}
        presetGroup={
          <DatePickerPresetGroup>
            <DatePickerPresetItem value="today" onDoubleClick={onDoubleClick}>
              Today
            </DatePickerPresetItem>
            <DatePickerPresetItem value="in-a-week" isCloseDialogOnDoubleClick onDoubleClick={onDoubleClick}>
              In a week
            </DatePickerPresetItem>
          </DatePickerPresetGroup>
        }
      />
    );
    await openPicker();

    await userEvent.dblClick(presetTargetNamed("Today"));
    expect(onDoubleClick).toHaveBeenCalledTimes(1);
    await expect.element(page.getByRole("dialog")).toBeVisible();

    await userEvent.dblClick(presetTargetNamed("In a week"));
    expect(onDoubleClick).toHaveBeenCalledTimes(2);
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });

  it("names the preset pane from the dictionary in every shipped locale", async () => {
    const expected = {
      "nb-NO": "Datoforvalg",
      "sv-SE": "Datumalternativ",
      "en-US": "Date presets",
      "fi-FI": "Päivämäärän pikavalinnat",
    } as const;
    expect(Object.keys(expected)).toEqual([...SUPPORTED_LOCALES]);

    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderThemed(
        withLocale(
          locale,
          <DatePickerPresetGroup>
            <DatePickerPresetItem value="today">Today</DatePickerPresetItem>
          </DatePickerPresetGroup>
        )
      );
      await expect.element(page.getByRole("radiogroup", { name: expected[locale] })).toBeVisible();
      unmount();
    }
  });

  it("lets an explicit label override the dictionary default", async () => {
    renderThemed(
      withLocale(
        "nb-NO",
        <DatePickerPresetGroup label="Hurtigvalg">
          <DatePickerPresetItem value="today">I dag</DatePickerPresetItem>
        </DatePickerPresetGroup>
      )
    );

    await expect.element(page.getByRole("radiogroup", { name: "Hurtigvalg" })).toBeVisible();
    expect(page.getByRole("radiogroup", { name: "Datoforvalg" }).query()).toBeNull();
  });
});

describe("DatePicker overlay containment", () => {
  it("portals the popover into the enclosing ThemeScope instead of the document body", async () => {
    const { host } = renderPicker(<DatePicker label="Invoice date" value={march10} />);
    const scope = host.querySelector("[data-theme-brand]");
    const dialog = await openPicker();

    expect(scope).not.toBeNull();
    expect(scope?.contains(dialog)).toBe(true);
    expect([...document.body.children].includes(dialog)).toBe(false);
  });

  it("stays inside a nested ThemeScope so the overlay keeps that scope's theme", async () => {
    renderPicker(
      <ThemeScope theme={fkasExternal}>
        <DatePicker label="Invoice date" value={march10} />
      </ThemeScope>
    );
    const dialog = await openPicker();

    expect(dialog.closest("[data-theme-variant=external]")).not.toBeNull();
  });

  it("portals into an explicit container when one is given", async () => {
    function WithContainer(): ReactElement {
      const container = useRef<HTMLDivElement>(null);
      return (
        <>
          <DatePicker container={container} label="Invoice date" value={march10} />
          <div data-explicit-container="" ref={container} />
        </>
      );
    }
    renderPicker(<WithContainer />);
    const dialog = await openPicker();

    expect(dialog.closest("[data-explicit-container]")).not.toBeNull();
  });

  it("keeps a host Dialog open while the user works inside the picker's popover", async () => {
    const onOpenChange = vi.fn();
    renderPicker(
      <Dialog.Root defaultOpen onOpenChange={onOpenChange}>
        <Dialog.Content showCloseButton={false}>
          <Dialog.Header>
            <Dialog.Title>Order</Dialog.Title>
          </Dialog.Header>
          <ControlledPicker />
        </Dialog.Content>
      </Dialog.Root>
    );
    await expect.element(page.getByRole("dialog", { name: "Order" })).toBeVisible();
    await userEvent.click(trigger());
    await expect.element(page.getByRole("dialog", { name: /calendar/i })).toBeVisible();

    // Paging is an interaction that keeps the popover open: the host must survive it.
    await userEvent.click(navButtonNamed(/next/i));
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/August\s+2026/i);
    expect(onOpenChange).not.toHaveBeenCalled();

    // Selecting a day dismisses the picker's own popover — and nothing else.
    await userEvent.click(dayNamed(/Wednesday, August 12, 2026/i));
    await expect.element(page.getByRole("dialog", { name: /calendar/i })).not.toBeInTheDocument();
    expect(spinbuttonNamed("day").textContent).toBe("12");
    expect(onOpenChange).not.toHaveBeenCalled();
    await expect.element(page.getByRole("dialog", { name: "Order" })).toBeVisible();
  });
});

describe("DatePicker density metrics", () => {
  it("pins the field box to the signed md rung at both densities and does not rescope", () => {
    const { rerender } = renderPicker(<DatePicker label="Meter" defaultValue={july14} />);
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      expect(px(getComputedStyle(groupNamed("Meter")).height)).toBe(CONTROL_MD[density].height);
      const inputStyle = getComputedStyle(dateInputRow("Meter"));
      expect(px(inputStyle.paddingInlineStart)).toBe(CONTROL_MD[density].px);
      expect(px(inputStyle.fontSize)).toBe(CONTROL_MD[density].font);
      expect(px(inputStyle.lineHeight)).toBe(CONTROL_MD[density].leading);
    }

    stampDensity("dense");
    rerender(
      <ThemeScope theme={fkasExternal}>
        <UiProviders locale="en-US" navigate={() => undefined}>
          <div data-density="comfortable">
            <DatePicker label="Meter" defaultValue={july14} />
          </div>
        </UiProviders>
      </ThemeScope>
    );
    expect(px(getComputedStyle(groupNamed("Meter")).height)).toBe(CONTROL_MD.dense.height);
  });
});

describe("DatePicker composition surface", () => {
  it("keeps a caller className on the root over the recipe's column layout", async () => {
    renderPicker(
      <DatePicker
        label="Invoice date"
        defaultValue={july14}
        className={(renderProps) => (renderProps.isOpen ? "gap-4" : "gap-2")}
      />
    );
    const root = groupNamed("Invoice date").parentElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error("expected the DatePicker root");
    }

    expect(getComputedStyle(root).display).toBe("flex");
    expect(getComputedStyle(root).flexDirection).toBe("column");
    expect(px(getComputedStyle(root).rowGap)).toBe(8);
    await openPicker();
    expect(px(getComputedStyle(root).rowGap)).toBe(16);
  });

  it("strips the calendar's card border and the dialog's padding inside the popover", async () => {
    renderPicker(<DatePicker label="Invoice date" value={march10} />);
    const dialog = await openPicker();
    const root = calendarRoot();

    expect(getComputedStyle(dialog).paddingTop).toBe("0px");
    expect(getComputedStyle(root).borderTopWidth).toBe("0px");
    expect(getComputedStyle(root).borderLeftWidth).toBe("0px");
    // No `title` ⇒ no header row at all: an empty heading would take the dialog's
    // accessible name from RAC and spend one 16 px `gap-4` on nothing
    // (react-aria/internal/dialog.tsx).
    expect(page.getByRole("button", { name: /close/i }).query()).toBeNull();
    expect(paneAroundCalendar().closest('[role="dialog"]')).toBe(dialog);
  });

  it("lays the dialog out in two divided panes only when a renderable preset group is given", async () => {
    function Toggleable(): ReactElement {
      const [presetGroup, setPresetGroup] = useState<ReactNode>(undefined);
      return (
        <>
          <button onClick={() => setPresetGroup(false)} type="button">
            Guard off
          </button>
          <button onClick={() => setPresetGroup(presets())} type="button">
            Add presets
          </button>
          <DatePicker label="Invoice date" presetGroup={presetGroup} value={march10} />
        </>
      );
    }
    renderPicker(<Toggleable />);

    await openPicker();
    expect(paneAroundCalendar().className).toBe("");
    expect(page.getByRole("radiogroup").query()).toBeNull();
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();

    // `presetGroup={showPresets && <Group />}` collapses to `false`, not to `undefined`:
    // a lone calendar must not get the two-pane divider and padding.
    await userEvent.click(buttonNamed("Guard off"));
    await openPicker();
    expect(paneAroundCalendar().className).toBe("");
    expect(page.getByRole("radiogroup").query()).toBeNull();
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(buttonNamed("Add presets"));
    await openPicker();
    expect(getComputedStyle(paneAroundCalendar()).display).toBe("flex");
    expect(px(getComputedStyle(paneAroundCalendar()).columnGap)).toBe(12);
    await expect.element(page.getByRole("radiogroup", { name: "Date presets" })).toBeVisible();
  });
});
