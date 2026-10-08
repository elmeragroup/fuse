import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { CalendarDate } from "@internationalized/date";
import { DatePickerContext } from "react-aria-components";
import type { ValidationResult } from "react-aria-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import * as CssColor from "@elmeragroup/color/css-color";
import { getOrThrow } from "@elmeragroup/color/result";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { shadowLayers } from "../../../test/assert-invalid-ring";
import { CaughtError } from "../../../test/caught-error";
import { withLocale } from "../../../test/locale-matrix";
import {
  calendarGrid,
  calendarRoot,
  cellNamed,
  describedTextsFor,
  insetsWithin,
  paddingBox,
  ROW_VIEWPORT,
  segmentLocator,
  segmentNamed,
  STACKED_VIEWPORT,
  SUBPIXEL,
  unionBox,
} from "../../../test/rac-calendar-testing";
import {
  CONTROL_MD,
  cssVarColor,
  fkasExternal,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
} from "../../../test/themed-browser-render";
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
 * so the composite never invents copy for it.
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
  const segment = segmentNamed(`month, ${name}`);
  const row = segment.parentElement;
  if (!(row instanceof HTMLElement) || !groupNamed(name).contains(row)) {
    throw new Error(`expected DateInput around ${name}`);
  }
  return row;
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

/** The pane wrapper the composite puts around the preset group and the calendar. */
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

/** Both trigger placements, for the tests whose behavior must not depend on the side. */
const triggerPlacements = ["end", "start"] as const;

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
 * A controlled picker whose single preset drives the value from inside the open popover.
 * A preset is the only way to change the value with the popover open, so this is the
 * fixture for the value-change resync rather than the per-open initializer.
 */
function PresetDrivenPicker({
  next,
  presetLabel,
  ...pickerProps
}: {
  next: CalendarDate | null;
  presetLabel: string;
  placeholderValue?: CalendarDate;
}): ReactElement {
  const [value, setValue] = useState<CalendarDate | null>(july14);
  return (
    <DatePicker
      {...pickerProps}
      label="Invoice date"
      onChange={setValue}
      presetGroup={
        <DatePickerPresetGroup onChange={() => setValue(next)}>
          <DatePickerPresetItem value="preset">{presetLabel}</DatePickerPresetItem>
        </DatePickerPresetGroup>
      }
      value={value}
    />
  );
}

describe("DatePicker", () => {
  it("throws the missing-LocaleProvider error when it mounts, before the calendar opens", () => {
    const { host } = renderThemed(
      <CaughtError>
        <DatePicker label="Dates" />
      </CaughtError>
    );
    expect(host.textContent).toBe("useLocale must be used within LocaleProvider");
  });

  it("names the field group from the label, exposes segment spinbuttons and a named collapsed trigger", async () => {
    renderPicker(<DatePicker label="Invoice date" description="Billing date." defaultValue={july14} />);
    const group = groupNamed("Invoice date");

    expect(group.getAttribute("data-slot")).toBe("field-group");
    await expect.element(segmentLocator("month")).toBeVisible();
    await expect.element(segmentLocator("day")).toBeVisible();
    await expect.element(segmentLocator("year")).toBeVisible();
    expect(describedTextsFor(group)).toContain("Billing date.");

    const trigger_ = trigger();
    expect(trigger_).toHaveAttribute("aria-expanded", "false");
    expect(trigger_).toHaveAttribute("aria-haspopup", "dialog");
    expect(page.getByRole("dialog").query()).toBeNull();
    // The glyph is decoration; the button's own name carries the meaning.
    expect(trigger_.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it.each(triggerPlacements)(
    "opens a named dialog holding the calendar grid and commits a day with Enter, trigger at the %s",
    async (triggerPlacement) => {
      const onChange = vi.fn();
      renderPicker(
        <DatePicker
          label="Invoice date"
          value={march10}
          onChange={onChange}
          triggerPlacement={triggerPlacement}
        />
      );
      const dialog = await openPicker();

      expect(trigger()).toHaveAttribute("aria-expanded", "true");
      await expect.element(page.getByRole("grid")).toBeVisible();
      expect(dialog.contains(calendarGrid())).toBe(true);
      // The dialog keeps RAC's own name; an unnamed overlay would be an AT dead end.
      await expect.element(page.getByRole("dialog", { name: /calendar/i })).toBeVisible();
      expect(cellNamed(/Tuesday, March 10, 2026/i)).toHaveAttribute("aria-selected", "true");
      // RAC moves focus onto the selected day from an effect after the popover mounts.
      await expect.element(page.getByRole("button", { name: /Tuesday, March 10, 2026/i })).toHaveFocus();

      await userEvent.keyboard("{Enter}");
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ year: 2026, month: 3, day: 10 }));
      expect(onChange.mock.calls[0]?.[0]).not.toBeInstanceOf(Event);
      await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    }
  );

  it("reopens an uncontrolled picker on its defaultValue's month after paging away", async () => {
    // The sync reads the picker state's committed value, so `defaultValue` alone — with
    // no `value` prop in sight — still lands the reopen on July.
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
    expect(segmentNamed("month").textContent).toBe("09");

    await openPicker();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/September\s+2026/i);
  });

  it.each([
    [
      "the current month",
      <DatePicker key="current" label="Invoice date" />,
      new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date()),
    ],
    [
      "the placeholder's month",
      <DatePicker key="placeholder" label="Birth date" placeholderValue={new CalendarDate(1990, 1, 1)} />,
      expect.stringMatching(/January\s+1990/i),
    ],
  ] as const)("opens on %s when there is no value", async (_case, picker, month) => {
    renderPicker(picker);
    await openPicker();

    expect(calendarGrid().getAttribute("aria-label")).toEqual(month);
  });

  it("returns to the placeholder's month when the value is cleared with the dialog open", async () => {
    renderPicker(
      <PresetDrivenPicker next={null} presetLabel="No date" placeholderValue={new CalendarDate(1990, 1, 1)} />
    );
    await openPicker();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/July\s+2026/i);

    await userEvent.click(presetTargetNamed("No date"));
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/January\s+1990/i);
  });

  it("follows a value change to its month while the dialog stays open", async () => {
    const november3 = new CalendarDate(2026, 11, 3);
    renderPicker(<PresetDrivenPicker next={november3} presetLabel="Early November" />);
    await openPicker();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/July\s+2026/i);

    // A preset lives inside the popover, so the value can change while it stays open —
    // which is the case the value effect (rather than the per-open mount) exists for.
    await userEvent.click(presetTargetNamed("Early November"));
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/November\s+2026/i);
    expect(segmentNamed("month").textContent).toBe("11");
  });

  it("keeps a paged month when the value is replaced by an equal date", async () => {
    // A fresh object for the same day: the committed value has not changed.
    renderPicker(<PresetDrivenPicker next={new CalendarDate(2026, 7, 14)} presetLabel="Same day" />);
    await openPicker();
    await userEvent.keyboard("{PageDown}{PageDown}");
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/September\s+2026/i);

    await userEvent.click(presetTargetNamed("Same day"));
    expect(page.getByRole("radio", { name: "Same day", exact: true }).element()).toBeChecked();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/September\s+2026/i);
  });

  it("opens on a placeholder supplied through DatePickerContext", async () => {
    renderPicker(
      <DatePickerContext.Provider value={{ placeholderValue: new CalendarDate(1990, 1, 1) }}>
        <DatePicker label="Birth date" />
      </DatePickerContext.Provider>
    );
    await openPicker();

    expect(calendarGrid().getAttribute("aria-label")).toMatch(/January\s+1990/i);
  });

  it.each([
    ["renders leading zeros on day and month by default", {}, "07", "04"],
    ["drops the leading zeros when a caller turns them off", { shouldForceLeadingZeros: false }, "7", "4"],
  ] as const)("%s", async (_title, props, month, day) => {
    renderPicker(<DatePicker label="Invoice date" defaultValue={july4} {...props} />);
    await expect.element(segmentLocator("month")).toBeVisible();

    expect(segmentNamed("month").textContent).toBe(month);
    expect(segmentNamed("day").textContent).toBe(day);
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
    await expect.element(segmentLocator("month")).toBeVisible();

    expect(document.body.textContent).not.toContain("Required");
  });

  it.each(triggerPlacements)(
    "fills the read-only field with the muted surface and keeps the popover closed, trigger at the %s",
    async (triggerPlacement) => {
      renderPicker(
        <DatePicker label="Invoice date" isReadOnly value={july14} triggerPlacement={triggerPlacement} />
      );
      const group = groupNamed("Invoice date");
      const glyph = group.querySelector("svg");
      if (!(glyph instanceof SVGElement)) {
        throw new Error("expected the trigger glyph");
      }

      // The FieldGroup's own `isReadOnly` axis paints the fill, exactly once. The glyph is
      // deliberately untinted: `bg-muted` on the `<svg>` never belonged there and went with
      // the picker recipe's duplicate arm.
      expect(getComputedStyle(group).backgroundColor).toBe(cssVarColor(group, "--muted"));
      expect(group.getAttribute("data-readonly")).toBe("true");
      expect(getComputedStyle(glyph).backgroundColor).not.toBe(cssVarColor(group, "--muted"));
      expect(trigger()).toBeDisabled();

      await userEvent.click(trigger(), { force: true });
      expect(page.getByRole("dialog").query()).toBeNull();
    }
  );
});

describe("DatePicker trigger placement", () => {
  it("keeps the trigger after the segments by default", async () => {
    renderPicker(<DatePicker label="Invoice date" defaultValue={july14} />);
    await expect.element(segmentLocator("year")).toBeVisible();

    expect(groupNamed("Invoice date").lastElementChild).toBe(trigger());
    expect(trigger().getBoundingClientRect().left).toBeGreaterThanOrEqual(
      segmentNamed("year").getBoundingClientRect().right
    );
  });

  it("leads the field box with the trigger in DOM, tab and visual order", async () => {
    renderPicker(
      <>
        <button type="button">Before</button>
        <DatePicker label="Start-up date" defaultValue={july14} triggerPlacement="start" />
      </>
    );
    const group = groupNamed("Start-up date");

    expect(group.firstElementChild).toBe(trigger());
    expect(trigger().getBoundingClientRect().right).toBeLessThanOrEqual(
      segmentNamed("month").getBoundingClientRect().left
    );

    buttonNamed("Before").focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger());
    await userEvent.tab();
    expect(document.activeElement).toBe(segmentNamed("month"));

    // RAC's label click focuses the group's first focusable part, now the trigger.
    await userEvent.click(page.getByText("Start-up date", { exact: true }));
    expect(document.activeElement).toBe(trigger());
  });

  it("mirrors the trailing trigger's inset and the segment row's padding", async () => {
    renderPicker(
      <>
        <DatePicker label="Trailing" defaultValue={july14} />
        <DatePicker label="Leading" defaultValue={july14} triggerPlacement="start" />
      </>
    );
    await expect.element(groupNamed("Leading")).toBeVisible();
    // Unit: the leading layout. Oracle: the trailing layout, mirrored. The trailing
    // trigger's inset and the segment row's padding are the established field box, so
    // the leading trigger has to sit as far from the start edge as that one sits from
    // the end edge, with the row's paddings swapped.
    const triggerIn = (name: string): DOMRect =>
      roleNamed("button", `Calendar ${name}`).getBoundingClientRect();
    const trailing = groupNamed("Trailing").getBoundingClientRect();
    const leading = groupNamed("Leading").getBoundingClientRect();

    expect(triggerIn("Leading").left - leading.left).toBeCloseTo(
      trailing.right - triggerIn("Trailing").right
    );
    expect(getComputedStyle(dateInputRow("Leading")).paddingInlineStart).toBe(
      getComputedStyle(dateInputRow("Trailing")).paddingInlineEnd
    );
    expect(getComputedStyle(dateInputRow("Leading")).paddingInlineEnd).toBe(
      getComputedStyle(dateInputRow("Trailing")).paddingInlineStart
    );
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
    // The name is the visible copy — never English synthesised from `value`.
    expect(page.getByRole("radio", { name: /preset option/i }).query()).toBeNull();
    expect(presetTargetNamed("Today").getAttribute("data-slot")).toBe("date-picker-preset-item");
    expect(pickerDialog().contains(radiogroup)).toBe(true);
    expect(pickerDialog().contains(calendarGrid())).toBe(true);
  });

  it("lets an explicit aria-label win over label", async () => {
    renderPicker(
      <DatePicker
        label="Invoice date"
        value={march10}
        presetGroup={
          <DatePickerPresetGroup label="Shortcuts" aria-label="Quick dates">
            <DatePickerPresetItem value="today">Today</DatePickerPresetItem>
            <DatePickerPresetItem value="in-a-week">In a week</DatePickerPresetItem>
          </DatePickerPresetGroup>
        }
      />
    );
    await openPicker();

    await expect.element(page.getByRole("radiogroup", { name: "Quick dates", exact: true })).toBeVisible();
    expect(page.getByRole("radiogroup", { name: "Shortcuts", exact: true }).query()).toBeNull();
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

  it("forwards label to the group name", async () => {
    renderThemed(
      withLocale(
        "nb-NO",
        <DatePickerPresetGroup label="Hurtigvalg">
          <DatePickerPresetItem value="today">I dag</DatePickerPresetItem>
        </DatePickerPresetGroup>
      )
    );

    await expect.element(page.getByRole("radiogroup", { name: "Hurtigvalg", exact: true })).toBeVisible();
  });
});

/**
 * The layers of a computed `box-shadow` that paint, judged by their colour's alpha.
 * Tailwind's `shadow-none` keeps its ring and inset layers in the cascade, so Chromium
 * reports fully transparent layers rather than `none`; a shadow that paints nothing has
 * no other kind. Chromium writes each layer's colour first, then its lengths and `inset`.
 * A colour the parser rejects throws, so an unknown notation never passes as transparent.
 */
function paintedShadowLayers(boxShadow: string): string[] {
  return shadowLayers(boxShadow).filter((layer) => {
    const colour = layer.replace(/(?:\s+(?:-?[\d.]+px|inset))+$/u, "");
    return getOrThrow(CssColor.parse(colour)).alpha > 0;
  });
}

describe("DatePicker preset pane geometry", () => {
  afterEach(async () => {
    await page.viewport(STACKED_VIEWPORT.width, STACKED_VIEWPORT.height);
  });

  it("runs the row divider from the dialog's top edge to its bottom edge", async () => {
    await page.viewport(ROW_VIEWPORT.width, ROW_VIEWPORT.height);
    renderPicker(<DatePicker label="Invoice date" value={march10} presetGroup={presets()} />);
    const inner = paddingBox(await openPicker());
    const column = roleNamed("radiogroup", "Date presets");
    const divider = column.getBoundingClientRect();

    expect(px(getComputedStyle(column).borderRightWidth)).toBeGreaterThan(0);
    expect(Math.abs(divider.top - inner.top)).toBeLessThanOrEqual(SUBPIXEL);
    expect(Math.abs(divider.bottom - inner.bottom)).toBeLessThanOrEqual(SUBPIXEL);
    expect(Math.abs(divider.left - inner.left)).toBeLessThanOrEqual(SUBPIXEL);
  });

  it("runs the stacked divider from the dialog's start edge to its end edge", async () => {
    await page.viewport(STACKED_VIEWPORT.width, STACKED_VIEWPORT.height);
    renderPicker(<DatePicker label="Invoice date" value={march10} presetGroup={presets()} />);
    const inner = paddingBox(await openPicker());
    const column = roleNamed("radiogroup", "Date presets");
    const divider = column.getBoundingClientRect();

    expect(px(getComputedStyle(column).borderBottomWidth)).toBeGreaterThan(0);
    expect(Math.abs(divider.left - inner.left)).toBeLessThanOrEqual(SUBPIXEL);
    expect(Math.abs(divider.right - inner.right)).toBeLessThanOrEqual(SUBPIXEL);
    expect(Math.abs(divider.top - inner.top)).toBeLessThanOrEqual(SUBPIXEL);
  });

  it.each([
    ["row", ROW_VIEWPORT],
    ["stacked", STACKED_VIEWPORT],
  ])(
    "insets the presets by at least the 4px small surface tier on every side of their column (%s)",
    async (_layout, viewport) => {
      await page.viewport(viewport.width, viewport.height);
      renderPicker(<DatePicker label="Invoice date" value={march10} presetGroup={presets()} />);
      await openPicker();
      const items = unionBox([presetTargetNamed("Today"), presetTargetNamed("In a week")]);
      const insets = insetsWithin(paddingBox(roleNamed("radiogroup", "Date presets")), items);

      expect(insets.top).toBeGreaterThanOrEqual(4 - SUBPIXEL);
      expect(insets.right).toBeGreaterThanOrEqual(4 - SUBPIXEL);
      expect(insets.bottom).toBeGreaterThanOrEqual(4 - SUBPIXEL);
      expect(insets.left).toBeGreaterThanOrEqual(4 - SUBPIXEL);
    }
  );

  it.each([
    ["with presets", true],
    ["without presets", false],
  ])("leaves the card chrome to the popover: no calendar shadow or fill (%s)", async (_case, withPresets) => {
    await page.viewport(ROW_VIEWPORT.width, ROW_VIEWPORT.height);
    renderPicker(
      <DatePicker label="Invoice date" value={march10} {...(withPresets && { presetGroup: presets() })} />
    );
    await openPicker();
    const style = getComputedStyle(calendarRoot());

    expect(paintedShadowLayers(style.boxShadow)).toEqual([]);
    expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
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
    // a lone calendar must not get the two-pane divider.
    await userEvent.click(buttonNamed("Guard off"));
    await openPicker();
    expect(paneAroundCalendar().className).toBe("");
    expect(page.getByRole("radiogroup").query()).toBeNull();
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(buttonNamed("Add presets"));
    await openPicker();
    expect(getComputedStyle(paneAroundCalendar()).display).toBe("flex");
    await expect.element(page.getByRole("radiogroup", { name: "Date presets" })).toBeVisible();
    // Vitest's default viewport sits below `sm`, so the panes stack under a bottom divider.
    expect(px(getComputedStyle(roleNamed("radiogroup", "Date presets")).borderBottomWidth)).toBeGreaterThan(
      0
    );
  });
});
