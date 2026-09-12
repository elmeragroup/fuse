import { useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { CalendarDate, isSameDay } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";
import type { ValidationResult } from "react-aria-components";
import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertStateFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import {
  anchorAndExtend,
  calendarGrid,
  calendarRoot,
  cellNumbered,
  dayNumbered,
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
import { DateRangePicker } from "./date-range-picker";

function renderPicker(node: ReactNode) {
  return renderThemed(
    <UiProviders locale="en-US" navigate={() => undefined}>
      {node}
    </UiProviders>
  );
}

/**
 * The trigger. RAC's `useDateRangePicker` owns the name — "Calendar" plus the field
 * label — so the composite never invents copy for it.
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

/**
 * One segment of one row. RAC prefixes every segment's own name with the row it belongs
 * to — "month, Start Date" / "month, End Date" — which is how the two rows stay tellable
 * apart in the accessibility tree. The rows' own wrappers are deliberately
 * `role="presentation"`: RAC drops them from the tree because the picker's single group
 * and these segment names already carry everything, and announcing them again would
 * double up.
 */
function segment(name: string): HTMLElement {
  // Substring match on purpose: RAC appends the picker's own label to every segment's
  // name, and the "<part>, <row>" prefix is the part that identifies the segment.
  const element = page.getByRole("spinbutton", { name, exact: false }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected spinbutton ${name}`);
  }
  return element;
}

/** The two `role="presentation"` segment rows inside the field box, in reading order. */
function segmentRows(label: string): HTMLElement[] {
  return [...groupNamed(label).querySelectorAll('[role="presentation"]')].filter(
    (element): element is HTMLElement => element instanceof HTMLElement
  );
}

/** The `aria-hidden` en-dash between the rows. */
function separator(label: string): HTMLElement {
  // Scoped to a direct child: the segment rows carry `aria-hidden` literals of their
  // own (the "/" between month and day), and those belong to DateField, not the range separator.
  const element = groupNamed(label).querySelector(':scope > [aria-hidden="true"]');
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected the en-dash separator");
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

async function openPicker(): Promise<HTMLElement> {
  await userEvent.click(trigger());
  await expect.element(page.getByRole("dialog")).toBeVisible();
  return pickerDialog();
}

/** One `name`/value pair a form submit carried, read back off its FormData. */
type SubmittedEntry = [string, FormDataEntryValue | null];

/** The shape RAC hands `onChange` — a RangeValue of the picker's own date type. */
type CommittedRange = { start: DateValue; end: DateValue };
type RangeChangeSpy = Mock<(value: CommittedRange | null) => void>;

function rangeChangeSpy(): RangeChangeSpy {
  return vi.fn<(value: CommittedRange | null) => void>();
}

/** The range a spy was called with, first call, asserted to exist. */
function committedRange(onChange: RangeChangeSpy): CommittedRange {
  return rangeFromCall(onChange, 0);
}

/**
 * The range a spy was called with on its last call. Typing a four-digit year commits a
 * valid range on every digit ("2", "20", "202", "2026"), so a typed range is judged by
 * where it landed, not by how many times RAC reported progress.
 */
function lastCommittedRange(onChange: RangeChangeSpy): CommittedRange {
  return rangeFromCall(onChange, onChange.mock.calls.length - 1);
}

function rangeFromCall(onChange: RangeChangeSpy, index: number): CommittedRange {
  const committed = onChange.mock.calls[index]?.[0];
  if (committed === undefined || committed === null) {
    throw new Error(`expected onChange call ${index} to have received a range`);
  }
  return committed;
}

const july4 = new CalendarDate(2026, 7, 4);
const july9 = new CalendarDate(2026, 7, 9);
const july14 = new CalendarDate(2026, 7, 14);
const july17 = new CalendarDate(2026, 7, 17);
const july18 = new CalendarDate(2026, 7, 18);
const july20 = new CalendarDate(2026, 7, 20);
const july24 = new CalendarDate(2026, 7, 24);
const julyWeek = { start: july14, end: july17 };

describe("DateRangePicker", () => {
  it("names the field group from the label, exposes both rows' spinbuttons and a named collapsed trigger", async () => {
    renderPicker(
      <DateRangePicker label="Delivery window" description="When we may deliver." defaultValue={julyWeek} />
    );
    const group = groupNamed("Delivery window");

    expect(group.getAttribute("data-slot")).toBe("field-group");
    for (const row of ["Start Date", "End Date"] as const) {
      for (const part of ["month", "day", "year"] as const) {
        await expect
          .element(page.getByRole("spinbutton", { name: `${part}, ${row}`, exact: false }))
          .toBeVisible();
      }
    }
    expect(describedTextsFor(group)).toContain("When we may deliver.");

    // Both rows live in the one field box, split by the decorative en dash.
    const rows = segmentRows("Delivery window");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.contains(segment("month, Start Date"))).toBe(true);
    expect(rows[1]?.contains(segment("month, End Date"))).toBe(true);
    expect(separator("Delivery window").textContent.trim()).toBe("–");

    const trigger_ = trigger();
    expect(trigger_).toHaveAttribute("aria-expanded", "false");
    expect(trigger_).toHaveAttribute("aria-haspopup", "dialog");
    expect(page.getByRole("dialog").query()).toBeNull();
    // The glyph is decoration; the button's own name carries the meaning.
    expect(trigger_.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("reports a range only once both rows are complete", async () => {
    const onChange = rangeChangeSpy();
    renderPicker(<DateRangePicker label="Delivery window" onChange={onChange} />);
    await expect
      .element(page.getByRole("spinbutton", { name: "month, Start Date", exact: false }))
      .toBeVisible();

    await userEvent.click(segment("month, Start Date"));
    await userEvent.keyboard("07142026");
    expect(segment("day, Start Date").textContent).toBe("14");
    // A half-filled range is not a range: RAC holds `onChange` until both ends exist.
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(segment("month, End Date"));
    await userEvent.keyboard("0717");
    expect(segment("day, End Date").textContent).toBe("17");
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.keyboard("2026");
    expect(onChange).toHaveBeenCalled();
    // Every value RAC reports is a whole range — never a lone endpoint.
    for (const [reported] of onChange.mock.calls) {
      expect(reported?.start).toBeDefined();
      expect(reported?.end).toBeDefined();
    }
    const committed = lastCommittedRange(onChange);
    expect(isSameDay(committed.start, july14)).toBe(true);
    expect(isSameDay(committed.end, july17)).toBe(true);
    expect(committed).not.toBeInstanceOf(Event);
  });

  it("renders leading zeros on day and month in both rows by default", async () => {
    renderPicker(<DateRangePicker label="Delivery window" defaultValue={{ start: july4, end: july9 }} />);
    await expect
      .element(page.getByRole("spinbutton", { name: "month, Start Date", exact: false }))
      .toBeVisible();

    expect(segment("month, Start Date").textContent).toBe("07");
    expect(segment("day, Start Date").textContent).toBe("04");
    expect(segment("month, End Date").textContent).toBe("07");
    expect(segment("day, End Date").textContent).toBe("09");
  });

  it("drops the leading zeros when a caller turns them off", async () => {
    renderPicker(
      <DateRangePicker
        label="Delivery window"
        defaultValue={{ start: july4, end: july9 }}
        shouldForceLeadingZeros={false}
      />
    );
    await expect
      .element(page.getByRole("spinbutton", { name: "month, Start Date", exact: false }))
      .toBeVisible();

    expect(segment("month, Start Date").textContent).toBe("7");
    expect(segment("day, Start Date").textContent).toBe("4");
    expect(segment("day, End Date").textContent).toBe("9");
  });

  it("opens a named dialog holding the range grid and commits two clicked endpoints", async () => {
    const onChange = rangeChangeSpy();
    renderPicker(<DateRangePicker label="Delivery window" defaultValue={julyWeek} onChange={onChange} />);
    const dialog = await openPicker();

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    await expect.element(page.getByRole("grid")).toBeVisible();
    expect(dialog.contains(calendarGrid())).toBe(true);
    // The dialog keeps RAC's own name; an unnamed overlay would be an AT dead end.
    await expect.element(page.getByRole("dialog", { name: /calendar/i })).toBeVisible();
    expect(calendarGrid().getAttribute("aria-label")).toMatch(/July\s+2026/i);
    expect(cellNumbered(14)).toHaveAttribute("aria-selected", "true");
    expect(cellNumbered(17)).toHaveAttribute("aria-selected", "true");

    // Anchor, then commit: only the second click makes a range.
    await userEvent.click(dayNumbered(20));
    expect(onChange).not.toHaveBeenCalled();
    await expect.element(page.getByRole("dialog")).toBeVisible();

    await userEvent.click(dayNumbered(24));
    expect(onChange).toHaveBeenCalledTimes(1);
    const committed = committedRange(onChange);
    expect(isSameDay(committed.start, july20)).toBe(true);
    expect(isSameDay(committed.end, july24)).toBe(true);
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(segment("day, Start Date").textContent).toBe("20");
    expect(segment("day, End Date").textContent).toBe("24");
  });

  it("anchors and commits a range from the keyboard", async () => {
    const onChange = rangeChangeSpy();
    renderPicker(<DateRangePicker label="Delivery window" defaultValue={julyWeek} onChange={onChange} />);
    await openPicker();
    // RAC opens the grid with the range's start focused, so Enter anchors there.
    expect(document.activeElement).toBe(dayNumbered(14));

    // Anchoring auto-advances the focused day, so the arrows extend from the day after.
    await anchorAndExtend({ anchor: 14, arrows: 3, landsOn: 18 });
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    const committed = committedRange(onChange);
    expect(isSameDay(committed.start, july14)).toBe(true);
    expect(isSameDay(committed.end, july18)).toBe(true);
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancels an in-progress selection on Escape and returns focus to the trigger", async () => {
    const onChange = rangeChangeSpy();
    renderPicker(<DateRangePicker label="Delivery window" defaultValue={julyWeek} onChange={onChange} />);
    await openPicker();

    // Anchor a new range, then abandon it: the same Escape cancels the anchor and
    // dismisses the popover, so the committed range is untouched.
    await userEvent.click(dayNumbered(20));
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    // Focus restoration lands after the dismissal commits; under full-gate load the
    // synchronous read can observe the frame before it.
    await expect.poll(() => document.activeElement).toBe(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(segment("day, Start Date").textContent).toBe("14");
    expect(segment("day, End Date").textContent).toBe("17");
  });

  it("marks a reversed range invalid and associates a string errorMessage", async () => {
    const errorCopy = "The end date cannot precede the start date.";
    renderPicker(
      <DateRangePicker
        label="Delivery window"
        defaultValue={{ start: july17, end: july14 }}
        validationBehavior="aria"
        errorMessage={errorCopy}
      />
    );
    await expect
      .element(page.getByRole("spinbutton", { name: "month, Start Date", exact: false }))
      .toBeVisible();
    const group = groupNamed("Delivery window");
    const root = group.parentElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error("expected the DateRangePicker root");
    }

    expect(root).toHaveAttribute("data-invalid");
    expect(describedTextsFor(group)).toContain(errorCopy);
  });

  it("renders a function errorMessage from the ValidationResult and associates it", async () => {
    let seen: ValidationResult | undefined;
    renderPicker(
      <DateRangePicker
        label="Delivery window"
        defaultValue={{ start: july17, end: july14 }}
        validationBehavior="aria"
        errorMessage={(validation) => {
          seen = validation;
          return (
            <span role="status" aria-label="Delivery window error details">
              {validation.validationErrors.join(" ")}
            </span>
          );
        }}
      />
    );
    const error = page.getByRole("status", { name: "Delivery window error details" });
    await expect.element(error).toBeVisible();
    const errorNode = error.element();
    if (!(errorNode instanceof HTMLElement)) {
      throw new Error("expected the error node");
    }

    expect(seen?.isInvalid).toBe(true);
    expect(seen?.validationErrors.length).toBeGreaterThan(0);
    expect(errorNode.textContent).not.toBe("");
    expect(describedTextsFor(groupNamed("Delivery window"))).toContain(errorNode.textContent);
  });

  it("renders no error node while the range is valid", async () => {
    renderPicker(
      <DateRangePicker label="Delivery window" defaultValue={julyWeek} errorMessage={<span>Required</span>} />
    );
    await expect
      .element(page.getByRole("spinbutton", { name: "month, Start Date", exact: false }))
      .toBeVisible();

    expect(document.body.textContent).not.toContain("Required");
  });

  it("keeps a read-only picker inert: muted field, no editing, no popover", async () => {
    renderPicker(<DateRangePicker label="Delivery window" isReadOnly defaultValue={julyWeek} />);
    const group = groupNamed("Delivery window");
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

    await userEvent.click(segment("day, Start Date"));
    await userEvent.keyboard("09");
    expect(segment("day, Start Date").textContent).toBe("14");

    await userEvent.click(trigger(), { force: true });
    expect(page.getByRole("dialog").query()).toBeNull();
  });

  it("submits both endpoints as ISO strings under startName and endName", async () => {
    const onSubmit = vi.fn<(entries: SubmittedEntry[]) => void>();
    renderPicker(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onSubmit([...data.keys()].map((key) => [key, data.get(key)]));
        }}>
        <DateRangePicker
          label="Delivery window"
          defaultValue={julyWeek}
          startName="deliverFrom"
          endName="deliverTo"
        />
        <button type="submit">Save</button>
      </form>
    );
    await expect
      .element(page.getByRole("spinbutton", { name: "month, Start Date", exact: false }))
      .toBeVisible();

    await userEvent.click(buttonNamed("Save"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // Exactly two fields, both ISO — the hidden inputs RAC keeps for the two rows.
    expect(onSubmit.mock.calls[0]?.[0]).toEqual([
      ["deliverFrom", "2026-07-14"],
      ["deliverTo", "2026-07-17"],
    ]);
  });
});

describe("DateRangePicker overlay containment", () => {
  it("portals the popover into the enclosing ThemeScope instead of the document body", async () => {
    const { host } = renderPicker(<DateRangePicker label="Delivery window" defaultValue={julyWeek} />);
    const scope = host.querySelector("[data-theme-brand]");
    const dialog = await openPicker();

    expect(scope).not.toBeNull();
    expect(scope?.contains(dialog)).toBe(true);
    expect([...document.body.children].includes(dialog)).toBe(false);
  });

  it("stays inside a nested ThemeScope so the overlay keeps that scope's theme", async () => {
    renderPicker(
      <ThemeScope theme={fkasExternal}>
        <DateRangePicker label="Delivery window" defaultValue={julyWeek} />
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
          <DateRangePicker container={container} label="Delivery window" defaultValue={julyWeek} />
          <div data-explicit-container="" ref={container} />
        </>
      );
    }
    renderPicker(<WithContainer />);
    const dialog = await openPicker();

    expect(dialog.closest("[data-explicit-container]")).not.toBeNull();
  });

  it("keeps a host Dialog open while the user picks both endpoints in the popover", async () => {
    const onOpenChange = vi.fn();
    function ControlledPicker(): ReactElement {
      const [value, setValue] = useState<{ start: CalendarDate; end: CalendarDate } | null>(julyWeek);
      return <DateRangePicker label="Delivery window" onChange={setValue} value={value} />;
    }
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

    // The anchoring click is the seam's real test: it lands in a portalled popover and
    // must not read as an interaction outside the host dialog.
    await userEvent.click(dayNumbered(3));
    await expect.element(page.getByRole("dialog", { name: /calendar/i })).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalled();

    // Committing dismisses the picker's own popover — and nothing else.
    await userEvent.click(dayNumbered(6));
    await expect.element(page.getByRole("dialog", { name: /calendar/i })).not.toBeInTheDocument();
    expect(segment("month, Start Date").textContent).toBe("08");
    expect(segment("day, Start Date").textContent).toBe("03");
    expect(segment("day, End Date").textContent).toBe("06");
    expect(onOpenChange).not.toHaveBeenCalled();
    await expect.element(page.getByRole("dialog", { name: "Order" })).toBeVisible();
  });

  it("paints the shared state ring on the field group for keyboard focus at both densities", async () => {
    renderPicker(
      <>
        <button type="button">Before</button>
        <DateRangePicker label="Meter" defaultValue={julyWeek} />
      </>
    );
    await expect.element(page.getByRole("spinbutton", { name: /month, Start Date/ })).toBeVisible();

    await assertStateFocusRingAtBothDensities(
      buttonNamed("Before"),
      segment("month, Start Date"),
      groupNamed("Meter")
    );
  });
});

describe("DateRangePicker density metrics", () => {
  it("pins the field box to the signed md rung at both densities and does not rescope", () => {
    const { rerender } = renderPicker(<DateRangePicker label="Meter" defaultValue={julyWeek} />);
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      expect(px(getComputedStyle(groupNamed("Meter")).height)).toBe(CONTROL_MD[density].height);
      const row = segment("month, Start Date").parentElement;
      if (!(row instanceof HTMLElement)) {
        throw new Error("expected the start DateInput");
      }
      const inputStyle = getComputedStyle(row);
      expect(px(inputStyle.paddingInlineStart)).toBe(CONTROL_MD[density].px);
      expect(px(inputStyle.fontSize)).toBe(CONTROL_MD[density].font);
      expect(px(inputStyle.lineHeight)).toBe(CONTROL_MD[density].leading);
    }

    stampDensity("dense");
    rerender(
      <ThemeScope theme={fkasExternal}>
        <UiProviders locale="en-US" navigate={() => undefined}>
          <div data-density="comfortable">
            <DateRangePicker label="Meter" defaultValue={julyWeek} />
          </div>
        </UiProviders>
      </ThemeScope>
    );
    expect(px(getComputedStyle(groupNamed("Meter")).height)).toBe(CONTROL_MD.dense.height);
  });
});

describe("DateRangePicker composition surface", () => {
  it("keeps a caller className on the root over the recipe's column layout", async () => {
    renderPicker(
      <DateRangePicker
        label="Delivery window"
        defaultValue={julyWeek}
        className={(renderProps) => (renderProps.isOpen ? "gap-4" : "gap-2")}
      />
    );
    const root = groupNamed("Delivery window").parentElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error("expected the DateRangePicker root");
    }

    expect(getComputedStyle(root).display).toBe("flex");
    expect(getComputedStyle(root).flexDirection).toBe("column");
    expect(px(getComputedStyle(root).rowGap)).toBe(8);
    await openPicker();
    expect(px(getComputedStyle(root).rowGap)).toBe(16);
  });

  it("floors the field box width and lets only the end row absorb the slack", async () => {
    renderPicker(<DateRangePicker label="Delivery window" defaultValue={julyWeek} />);
    const group = groupNamed("Delivery window");
    await expect
      .element(page.getByRole("spinbutton", { name: "month, Start Date", exact: false }))
      .toBeVisible();
    const [startRow, endRow] = segmentRows("Delivery window");
    if (startRow === undefined || endRow === undefined) {
      throw new Error("expected both segment rows");
    }

    expect(px(getComputedStyle(group).width)).toBeGreaterThanOrEqual(208);
    // The end row carries `flex-1`, so it is the wider of two identically formatted rows.
    expect(px(getComputedStyle(endRow).width)).toBeGreaterThan(px(getComputedStyle(startRow).width));
  });

  it("wears the styled dialog chrome without its close button, and pads the calendar itself", async () => {
    renderPicker(<DateRangePicker label="Delivery window" defaultValue={julyWeek} />);
    const dialog = await openPicker();
    const root = calendarRoot();

    expect(dialog.getAttribute("data-slot")).toBe("dialog");
    // No `title` ⇒ no header row at all: an empty heading would take the dialog's
    // accessible name from RAC and spend one 16 px `gap-4` on nothing
    // (react-aria/internal/dialog.tsx).
    expect(page.getByRole("button", { name: /close/i }).query()).toBeNull();
    expect(root.closest('[role="dialog"]')).toBe(dialog);
    // `closeButton={false}`: the popover is dismissed by Escape or an outside click, so
    // the dialog chrome renders no dismiss affordance of its own.
    expect(page.getByRole("button", { name: /close/i }).query()).toBeNull();
    expect(getComputedStyle(dialog).paddingTop).toBe("0px");
    expect(getComputedStyle(dialog).paddingLeft).toBe("0px");
    // RangeCalendar's root is bare by design, so the inset is the recipe's own.
    expect(getComputedStyle(root).paddingTop).toBe("8px");
    expect(getComputedStyle(root).borderTopWidth).toBe("0px");
  });

  it("sizes the trigger glyph from the recipe rather than the Button's fallback", async () => {
    renderPicker(<DateRangePicker label="Delivery window" defaultValue={julyWeek} />);
    await expect
      .element(page.getByRole("spinbutton", { name: "month, Start Date", exact: false }))
      .toBeVisible();
    const glyph = trigger().querySelector("svg");
    if (!(glyph instanceof SVGElement)) {
      throw new Error("expected the trigger glyph");
    }

    expect(px(getComputedStyle(glyph).width)).toBe(16);
    expect(px(getComputedStyle(glyph).height)).toBe(16);
  });
});
