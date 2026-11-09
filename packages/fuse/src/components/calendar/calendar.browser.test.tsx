/**
 * Unit under test: the Calendar parts in Chromium, through their roles and names. Oracles: the
 * React Aria interim tier as `src/internal/date-tier-parity.browser.test.tsx` pins it (day names,
 * grid names, keyboard targets, bound naming and clamping, today naming), React Aria's
 * `react-stately` paging rules worked out by hand for the multi-month cases, and printed 2026
 * calendars. Every scenario runs under a clock frozen at local noon on June 15, 2030, outside
 * every month the scenarios show, except where a scenario names today itself.
 */
import { Suspense, use, useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { withLocale } from "../../../test/locale-matrix";
import { cssVarColor, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { definedProps } from "../../internal/defined-props";
import "../../temporal-polyfill";
import type { CalendarRootProps } from "./calendar";
import { CalendarRootContext, createSelectionOwner, dayFlags, NO_DAY_FLAGS } from "./calendar-context";
import type { CalendarRootContextValue, CalendarSettings } from "./calendar-context";
import { createCalendarStore } from "./calendar-store";
import { Calendar } from "./index";
import { initialSharedState } from "./use-calendar-navigation";

const TODAY = "2030-06-15";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});

afterEach(() => {
  vi.useRealTimers();
});

/** The anatomy a host composes: the month buttons around the heading, then the visible months. */
function Parts(props: CalendarRootProps): ReactElement {
  return (
    <Calendar.Root aria-label="Delivery" {...props}>
      <Calendar.Header>
        <Calendar.DecrementMonth />
        <Calendar.VisibleRangeHeading />
        <Calendar.IncrementMonth />
      </Calendar.Header>
      <Calendar.Months>
        {(month) => (
          <Calendar.Month key={month.toString()} value={month}>
            <Calendar.MonthHeading />
            <Calendar.DayGrid>
              <Calendar.DayGridHeader />
              <Calendar.DayGridBody />
            </Calendar.DayGrid>
          </Calendar.Month>
        )}
      </Calendar.Months>
    </Calendar.Root>
  );
}

/**
 * A calendar printing what its callbacks report: the last committed value, and every reason
 * `onVisibleRangeChange` reported with its first month.
 */
function Harness({
  cancelValue = false,
  cancelVisible = false,
  ...props
}: CalendarRootProps & { cancelValue?: boolean; cancelVisible?: boolean }): ReactElement {
  const [value, setValue] = useState("unchanged");
  const [visible, setVisible] = useState<string[]>([]);
  return (
    <>
      <button type="button">Before</button>
      <Parts
        {...props}
        onValueChange={(next, details) => {
          if (cancelValue) {
            details.cancel();
          }
          setValue(`${next.toString()} ${details.reason} ${String(details.getValidationError())}`);
        }}
        onVisibleRangeChange={(start, details) => {
          if (cancelVisible) {
            details.cancel();
          }
          setVisible((log) => [...log, `${start.toString()} ${details.reason}`]);
        }}
      />
      <output aria-label="Committed value">{value}</output>
      <output aria-label="Visible changes">{visible.join(", ")}</output>
    </>
  );
}

function mount(node: ReactElement): void {
  renderThemed(withLocale("en-US", node));
}

const committed = () => page.getByRole("status", { name: "Committed value" });
const visibleChanges = () => page.getByRole("status", { name: "Visible changes" });

async function expectFocusOnDay(name: string): Promise<void> {
  await expect.element(page.getByRole("button", { name, exact: true })).toHaveFocus();
}

/** Put keyboard focus on one day without a pointer, which would select it. */
async function focusDay(name: string): Promise<void> {
  roleNamed("button", name).focus();
  await expectFocusOnDay(name);
}

function gridNames(): string[] {
  // DOM audit: every grid's name in document order, which a role query cannot list in order.
  return [...document.querySelectorAll("[role=grid]")].map((grid) => grid.getAttribute("aria-label") ?? "");
}

describe("Calendar parity with the interim tier", () => {
  it.each([
    ["{Home}", "Thursday, October 1, 2026", "Delivery, October 2026"],
    ["{End}", "Saturday, October 31, 2026", "Delivery, October 2026"],
    ["{PageUp}", "Monday, September 14, 2026", "Delivery, September 2026"],
    ["{PageDown}", "Saturday, November 14, 2026", "Delivery, November 2026"],
    ["{Shift>}{PageUp}{/Shift}", "Tuesday, October 14, 2025", "Delivery, October 2025"],
    ["{Shift>}{PageDown}{/Shift}", "Thursday, October 14, 2027", "Delivery, October 2027"],
    ["{End}{PageUp}", "Wednesday, September 30, 2026", "Delivery, September 2026"],
    ["{ArrowDown}{ArrowDown}{ArrowDown}", "Wednesday, November 4, 2026", "Delivery, November 2026"],
  ])("moves focus from October 14, 2026 with %s", async (keys, day, grid) => {
    mount(<Harness defaultValue="2026-10-14" />);
    await focusDay("Wednesday, October 14, 2026 selected");

    await userEvent.keyboard(keys);

    await expectFocusOnDay(day);
    await expect.element(page.getByRole("grid", { name: grid, exact: true })).toBeVisible();
    await expect.element(committed()).toHaveTextContent("unchanged");
  });

  it("lets an unavailable date take focus but never selection", async () => {
    mount(
      <Harness defaultValue="2026-10-14" isDateUnavailable={(date) => date.toString() === "2026-10-15"} />
    );
    await focusDay("Wednesday, October 14, 2026 selected");

    await userEvent.keyboard("{ArrowRight}");
    await expectFocusOnDay("Thursday, October 15, 2026");
    expect(roleNamed("button", "Thursday, October 15, 2026")).toHaveAttribute("aria-disabled", "true");

    await userEvent.keyboard("{Enter}");
    await userEvent.click(roleNamed("button", "Thursday, October 15, 2026"), { force: true });
    await expect.element(committed()).toHaveTextContent("unchanged");

    await userEvent.keyboard("{ArrowRight}{Enter}");
    await expect.element(committed()).toHaveTextContent("2026-10-16 keyboard null");
  });

  it("names the first and last available dates, clamps Home, End and PageUp to them, and never focuses beyond", async () => {
    mount(<Harness defaultValue="2026-10-14" minValue="2026-10-10" maxValue="2026-10-20" />);
    expect(roleNamed("button", "Friday, October 9, 2026")).toHaveAttribute("aria-disabled", "true");
    expect(roleNamed("button", "Wednesday, October 21, 2026")).toHaveAttribute("aria-disabled", "true");
    await focusDay("Wednesday, October 14, 2026 selected");

    await userEvent.keyboard("{Home}");
    await expectFocusOnDay("Saturday, October 10, 2026, First available date");
    await userEvent.keyboard("{ArrowLeft}");
    await expectFocusOnDay("Saturday, October 10, 2026, First available date");
    await userEvent.keyboard("{End}");
    await expectFocusOnDay("Tuesday, October 20, 2026, Last available date");
    await userEvent.keyboard("{ArrowRight}");
    await expectFocusOnDay("Tuesday, October 20, 2026, Last available date");
    await userEvent.keyboard("{PageUp}");
    await expectFocusOnDay("Saturday, October 10, 2026, First available date");

    await userEvent.click(roleNamed("button", "Friday, October 9, 2026"), { force: true });
    await expect.element(committed()).toHaveTextContent("unchanged");
  });

  it("prefixes today's day name with Today and leaves the other days plain", async () => {
    mount(<Harness defaultValue="2030-06-10" />);

    await expect
      .element(page.getByRole("button", { name: "Today, Saturday, June 15, 2030", exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Sunday, June 16, 2030", exact: true }))
      .toBeVisible();
  });

  it("names the month buttons Previous and Next", async () => {
    mount(<Harness defaultValue="2026-10-14" />);

    await expect.element(page.getByRole("button", { name: "Previous", exact: true })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
  });
});

describe("Calendar selection", () => {
  it("selects a pressed day, marks its gridcell selected and reports a day-press", async () => {
    mount(<Harness defaultValue="2026-10-14" />);

    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));

    await expect.element(committed()).toHaveTextContent("2026-10-12 day-press null");
    const day = roleNamed("button", "Monday, October 12, 2026 selected");
    expect(day.closest("[role=gridcell]")).toHaveAttribute("aria-selected", "true");
    expect(day).toHaveAttribute("data-selected", "");
    expect(day).not.toHaveAttribute("aria-selected");
    expect(roleNamed("button", "Wednesday, October 14, 2026").closest("[role=gridcell]")).not.toHaveAttribute(
      "aria-selected"
    );
  });

  it("selects with Space and reports keyboard", async () => {
    mount(<Harness defaultValue="2026-10-14" />);
    await focusDay("Wednesday, October 14, 2026 selected");

    await userEvent.keyboard("{ArrowLeft}{ }");

    await expect.element(committed()).toHaveTextContent("2026-10-13 keyboard null");
    await expectFocusOnDay("Tuesday, October 13, 2026 selected");
  });

  it("selects once while Enter is held, though every repeat is still default-prevented", async () => {
    const changes: string[] = [];
    mount(<Parts defaultValue="2026-10-14" onValueChange={(next) => changes.push(next.toString())} />);
    await focusDay("Wednesday, October 14, 2026 selected");
    await userEvent.keyboard("{ArrowRight}");
    const day = roleNamed("button", "Thursday, October 15, 2026");
    await expectFocusOnDay("Thursday, October 15, 2026");

    const first = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    const repeat = new KeyboardEvent("keydown", {
      key: "Enter",
      repeat: true,
      bubbles: true,
      cancelable: true,
    });
    day.dispatchEvent(first);
    day.dispatchEvent(repeat);

    await expectFocusOnDay("Thursday, October 15, 2026 selected");
    expect(changes).toEqual(["2026-10-15"]);
    expect(first.defaultPrevented).toBe(true);
    expect(repeat.defaultPrevented).toBe(true);
  });

  it.each([
    ["Alt+Arrow Left", { key: "ArrowLeft", altKey: true }],
    ["Control+Arrow Left", { key: "ArrowLeft", ctrlKey: true }],
    ["Meta+Arrow Left", { key: "ArrowLeft", metaKey: true }],
    ["Control+Home", { key: "Home", ctrlKey: true }],
    ["Shift+Arrow Right", { key: "ArrowRight", shiftKey: true }],
    ["Control+Enter", { key: "Enter", ctrlKey: true }],
    ["Meta+Space", { key: " ", metaKey: true }],
  ] as const)("leaves %s to the browser: no move, no selection, no preventDefault", async (_keys, init) => {
    const changes: string[] = [];
    mount(<Parts defaultValue="2026-10-14" onValueChange={(next) => changes.push(next.toString())} />);
    await focusDay("Wednesday, October 14, 2026 selected");
    await userEvent.keyboard("{ArrowRight}");
    await expectFocusOnDay("Thursday, October 15, 2026");

    const event = new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true });
    roleNamed("button", "Thursday, October 15, 2026").dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    await expectFocusOnDay("Thursday, October 15, 2026");
    expect(changes).toEqual([]);
  });

  it("follows a controlled value from its parent without moving the view", async () => {
    function Controlled(): ReactElement {
      const [value, setValue] = useState<Temporal.PlainDate | string | null>("2026-10-14");
      return (
        <>
          <button type="button" onClick={() => setValue(Temporal.PlainDate.from("2026-10-20"))}>
            Choose the 20th
          </button>
          <Parts value={value} onValueChange={(next) => setValue(next)} />
        </>
      );
    }
    mount(<Controlled />);

    await userEvent.click(roleNamed("button", "Choose the 20th"));
    await expect
      .element(page.getByRole("button", { name: "Tuesday, October 20, 2026 selected", exact: true }))
      .toBeVisible();

    await userEvent.click(roleNamed("button", "Thursday, October 1, 2026"));
    await expect
      .element(page.getByRole("button", { name: "Thursday, October 1, 2026 selected", exact: true }))
      .toBeVisible();
  });

  it("marks an unavailable value invalid on its day and its Root", () => {
    mount(
      <Harness defaultValue="2026-10-15" isDateUnavailable={(date) => date.toString() === "2026-10-15"} />
    );

    const day = roleNamed("button", "Thursday, October 15, 2026 selected");
    expect(day).toHaveAttribute("aria-invalid", "true");
    expect(day.closest("[role=gridcell]")).toHaveAttribute("aria-selected", "true");
    expect(roleNamed("group", "Delivery")).toHaveAttribute("data-invalid");
  });

  it("selects nothing while read-only, though focus still moves", async () => {
    mount(<Harness defaultValue="2026-10-14" readOnly />);
    await focusDay("Wednesday, October 14, 2026 selected");

    await userEvent.keyboard("{ArrowRight}{Enter}");
    await userEvent.click(roleNamed("button", "Friday, October 16, 2026"));

    await expectFocusOnDay("Friday, October 16, 2026");
    await expect.element(committed()).toHaveTextContent("unchanged");
    expect(roleNamed("grid", "Delivery, October 2026")).toHaveAttribute("aria-readonly", "true");
  });

  it("disables every day and both month buttons while disabled", () => {
    mount(<Harness defaultValue="2026-10-14" disabled />);

    expect(roleNamed("button", "Wednesday, October 14, 2026")).toBeDisabled();
    expect(roleNamed("button", "Previous")).toHaveAttribute("aria-disabled", "true");
    expect(roleNamed("button", "Next")).toHaveAttribute("aria-disabled", "true");
  });
});

describe("Calendar cancelable change details", () => {
  it.each([
    [
      "a pointer press",
      "day-press",
      () => userEvent.click(roleNamed("button", "Thursday, October 15, 2026")),
    ],
    ["Enter", "keyboard", () => userEvent.keyboard("{Enter}")],
    ["Space", "keyboard", () => userEvent.keyboard("{ }")],
  ] as const)(
    "keeps the value, and focus on the day, when %s is canceled",
    async (_gesture, reason, press) => {
      mount(<Harness defaultValue="2026-10-14" cancelValue />);
      await focusDay("Wednesday, October 14, 2026 selected");
      await userEvent.keyboard("{ArrowRight}");
      await expectFocusOnDay("Thursday, October 15, 2026");

      await press();

      await expect.element(committed()).toHaveTextContent(`2026-10-15 ${reason} null`);
      await expectFocusOnDay("Thursday, October 15, 2026");
      expect(
        roleNamed("button", "Thursday, October 15, 2026").closest("[role=gridcell]")
      ).not.toHaveAttribute("aria-selected");
      await expect
        .element(page.getByRole("button", { name: "Wednesday, October 14, 2026 selected", exact: true }))
        .toBeVisible();
    }
  );

  it("keeps the months when a month button press is canceled", async () => {
    mount(<Harness defaultValue="2026-10-14" cancelVisible />);

    await userEvent.click(roleNamed("button", "Next"));

    await expect.element(visibleChanges()).toHaveTextContent("2026-11 increment-press");
    await expect.element(page.getByRole("heading", { name: "October 2026" })).toBeVisible();
    expect(gridNames()).toEqual(["Delivery, October 2026"]);
  });

  it("keeps focus on its day when a key that would page is canceled", async () => {
    mount(<Harness defaultValue="2026-10-14" cancelVisible />);
    await focusDay("Wednesday, October 14, 2026 selected");

    await userEvent.keyboard("{PageDown}");

    await expect.element(visibleChanges()).toHaveTextContent("2026-11 keyboard");
    await expectFocusOnDay("Wednesday, October 14, 2026 selected");
    expect(gridNames()).toEqual(["Delivery, October 2026"]);
  });
});

describe("Calendar month buttons", () => {
  it("pages one month and reports each press", async () => {
    mount(<Harness defaultValue="2026-10-14" />);

    await userEvent.click(roleNamed("button", "Next"));
    await userEvent.click(roleNamed("button", "Next"));
    await userEvent.click(roleNamed("button", "Previous"));

    await expect
      .element(visibleChanges())
      .toHaveTextContent("2026-11 increment-press, 2026-12 increment-press, 2026-11 decrement-press");
    expect(gridNames()).toEqual(["Delivery, November 2026"]);
    expect(roleNamed("button", "Previous")).toHaveFocus();
  });

  it("disables a month button whose page holds no selectable day and keeps it focusable", async () => {
    mount(
      <Harness defaultValue="2026-10-14" minValue="2026-09-20" maxValue="2026-11-05" visibleMonths={2} />
    );

    expect(gridNames()).toEqual(["Delivery, October 2026", "Delivery, November 2026"]);
    expect(roleNamed("button", "Next")).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(roleNamed("button", "Previous"));

    expect(gridNames()).toEqual(["Delivery, September 2026", "Delivery, October 2026"]);
    expect(roleNamed("button", "Previous")).toHaveAttribute("aria-disabled", "true");
    expect(roleNamed("button", "Previous")).toHaveFocus();
    expect(roleNamed("button", "Next")).toHaveAttribute("aria-disabled", "false");
  });

  it("announces a page politely from the one visible-range heading, quiet until the first page and while a day has focus", async () => {
    mount(<Harness defaultValue="2026-10-14" visibleMonths={3} />);

    const heading = page.getByRole("heading", { level: 2 });
    await expect.element(heading).toHaveAttribute("aria-live", "off");
    // DOM audit: the calendar writes exactly one live region, which no role query can count.
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(1);

    await userEvent.click(roleNamed("button", "Next"));
    await expect.element(heading).toHaveAttribute("aria-live", "polite");

    await focusDay("Thursday, January 14, 2027");
    await expect.element(heading).toHaveAttribute("aria-live", "off");

    await userEvent.click(roleNamed("button", "Previous"));
    await expect.element(heading).toHaveAttribute("aria-live", "polite");
  });

  it("stays quiet while a host widens the view after mounting, until the user pages by key", async () => {
    /** A host that picks the month count after mounting, as one reading the viewport does. */
    function Widening({ onReady }: { onReady: (set: (months: number) => void) => void }): ReactElement {
      const [months, setMonths] = useState(1);
      useEffect(() => {
        onReady(setMonths);
      }, [onReady]);
      return <Harness defaultValue="2026-10-14" visibleMonths={months} />;
    }
    let widen: ((months: number) => void) | undefined;
    mount(<Widening onReady={(set) => (widen = set)} />);
    const heading = page.getByRole("heading", { level: 2 });
    await expect.element(page.getByRole("heading", { level: 2, name: "October 2026" })).toBeVisible();

    widen?.(2);

    await expect
      .element(page.getByRole("heading", { level: 2, name: "October – November 2026" }))
      .toHaveAttribute("aria-live", "off");

    await focusDay("Wednesday, October 14, 2026 selected");
    await userEvent.keyboard("{PageDown}{PageDown}");
    await expectFocusOnDay("Monday, December 14, 2026");
    await userEvent.click(page.getByRole("heading", { level: 2 }));

    await expect.element(heading).toHaveAttribute("aria-live", "polite");
  });
});

describe("Calendar across months", () => {
  it("shows three months around the value and names each grid by its month", () => {
    mount(<Harness defaultValue="2026-10-14" visibleMonths={3} />);

    expect(gridNames()).toEqual([
      "Delivery, September 2026",
      "Delivery, October 2026",
      "Delivery, November 2026",
    ]);
  });

  it("moves focus into the next grid without paging", async () => {
    mount(<Harness defaultValue="2026-10-31" visibleMonths={3} />);
    await focusDay("Saturday, October 31, 2026 selected");

    await userEvent.keyboard("{ArrowRight}");

    await expectFocusOnDay("Sunday, November 1, 2026");
    expect(document.activeElement?.closest("[role=grid]")).toHaveAttribute(
      "aria-label",
      "Delivery, November 2026"
    );
    await expect.element(visibleChanges()).toHaveTextContent("");
  });

  it.each([
    ["visible", "2026-12 keyboard", ["December 2026", "January 2027", "February 2027"]],
    ["single", "2026-10 keyboard", ["October 2026", "November 2026", "December 2026"]],
  ] as const)("pages by %s when focus leaves the last month", async (pageBehavior, reported, shown) => {
    mount(<Harness defaultValue="2026-10-14" visibleMonths={3} pageBehavior={pageBehavior} />);
    await focusDay("Wednesday, October 14, 2026 selected");

    await userEvent.keyboard("{PageDown}");
    await expectFocusOnDay("Saturday, November 14, 2026");
    await expect.element(visibleChanges()).toHaveTextContent("");
    await userEvent.keyboard("{PageDown}");

    await expectFocusOnDay("Monday, December 14, 2026");
    await expect.element(visibleChanges()).toHaveTextContent(reported);
    expect(gridNames()).toEqual(shown.map((month) => `Delivery, ${month}`));
  });

  it.each([
    ["visible", "2026-12 increment-press", ["December 2026", "January 2027", "February 2027"]],
    ["single", "2026-10 increment-press", ["October 2026", "November 2026", "December 2026"]],
  ] as const)("pages the month buttons by %s", async (pageBehavior, reported, shown) => {
    mount(<Harness defaultValue="2026-10-14" visibleMonths={3} pageBehavior={pageBehavior} />);

    await userEvent.click(roleNamed("button", "Next"));

    await expect.element(visibleChanges()).toHaveTextContent(reported);
    expect(gridNames()).toEqual(shown.map((month) => `Delivery, ${month}`));
  });

  it("keeps the view inside the bounds and clamps focus to them on each page", async () => {
    mount(
      <Harness defaultValue="2026-10-14" visibleMonths={2} minValue="2026-08-10" maxValue="2026-12-20" />
    );
    await focusDay("Wednesday, October 14, 2026 selected");

    await userEvent.keyboard("{Shift>}{PageDown}{/Shift}");
    await expectFocusOnDay("Sunday, December 20, 2026, Last available date");
    expect(gridNames()).toEqual(["Delivery, November 2026", "Delivery, December 2026"]);

    await userEvent.keyboard("{Shift>}{PageUp}{/Shift}");
    await expectFocusOnDay("Monday, August 10, 2026, First available date");
    expect(gridNames()).toEqual(["Delivery, August 2026", "Delivery, September 2026"]);
  });

  it("keeps one tab stop across every grid", () => {
    mount(<Harness defaultValue="2026-10-14" visibleMonths={3} />);

    // DOM audit: every day button's tab index across the three grids, outside days included.
    const stops = [...document.querySelectorAll("[data-slot=calendar-day-button]")].filter(
      (button) => button.getAttribute("tabindex") === "0"
    );
    expect(stops.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Wednesday, October 14, 2026 selected",
    ]);
  });

  it("renders only the two days focus leaves and reaches in a three-month view", async () => {
    const renders: string[] = [];
    function Counted(): ReactElement {
      return (
        <Calendar.Root aria-label="Delivery" defaultValue="2026-10-14" visibleMonths={3}>
          <Calendar.Months>
            {(month) => (
              <Calendar.Month key={month.toString()} value={month}>
                <Calendar.DayGrid>
                  <Calendar.DayGridBody>
                    {(week) => (
                      <Calendar.DayGridRow key={week.toString()} value={week}>
                        {(day) => (
                          <Calendar.DayGridCell key={day.toString()} value={day}>
                            <Calendar.DayButton
                              render={(props) => {
                                renders.push(day.toString());
                                return <button {...props} />;
                              }}
                            />
                          </Calendar.DayGridCell>
                        )}
                      </Calendar.DayGridRow>
                    )}
                  </Calendar.DayGridBody>
                </Calendar.DayGrid>
              </Calendar.Month>
            )}
          </Calendar.Months>
        </Calendar.Root>
      );
    }
    mount(<Counted />);
    await focusDay("Wednesday, October 14, 2026 selected");
    renders.length = 0;

    await userEvent.keyboard("{ArrowRight}");

    await expectFocusOnDay("Thursday, October 15, 2026");
    expect(renders.toSorted()).toEqual(["2026-10-14", "2026-10-15"]);
  });
});

describe("Calendar today", () => {
  it("moves the today marking when the page becomes visible on a new day", async () => {
    mount(<Harness defaultValue="2030-06-10" />);
    await expect
      .element(page.getByRole("button", { name: "Today, Saturday, June 15, 2030", exact: true }))
      .toBeVisible();

    vi.setSystemTime(new Date("2030-06-16T00:30:00"));
    document.dispatchEvent(new Event("visibilitychange"));

    await expect
      .element(page.getByRole("button", { name: "Today, Sunday, June 16, 2030", exact: true }))
      .toBeVisible();
    expect(roleNamed("button", "Saturday, June 15, 2030")).not.toHaveAttribute("data-current");
  });

  it("opens on today's month when it has no value", async () => {
    mount(<Harness />);

    await expect.element(page.getByRole("grid", { name: "Delivery, June 2030", exact: true })).toBeVisible();
    expect(roleNamed("button", "Today, Saturday, June 15, 2030")).toHaveAttribute("tabindex", "0");
  });
});

describe("Calendar server rendering", () => {
  it("renders no today on the server and marks it after hydrating without a mismatch", async () => {
    const element = withLocale("en-US", <Parts defaultValue="2030-06-10" visibleMonths={2} />);
    const host = document.createElement("div");
    host.innerHTML = renderToString(element);
    document.body.append(host);
    const recover = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      expect(host.querySelector("[data-current]")).toBeNull();
      expect(host.querySelector("[aria-label='Saturday, June 15, 2030']")).not.toBeNull();
      expect(host.querySelector("h2")?.textContent).toBe("June\u00a0–\u00a0July\u00a02030");
      expect(host.querySelector("h2")).toHaveAttribute("aria-live", "off");

      root = hydrateRoot(host, element, { onRecoverableError: recover });

      await expect
        .element(page.getByRole("button", { name: "Today, Saturday, June 15, 2030", exact: true }))
        .toHaveAttribute("data-current");
      expect(recover).not.toHaveBeenCalled();
      expect(host.querySelector("h2")).toHaveAttribute("aria-live", "off");
    } finally {
      root?.unmount();
      host.remove();
    }
  });
});

describe("Calendar focus when the bounds change", () => {
  /** The harness's minimum setter, which a test calls without moving focus to a button. */
  type SetMinimum = (min: string) => void;

  /** A calendar that hands its minimum's setter to `onReady` once mounted. */
  function BoundsHarness({ onReady }: { onReady: (set: SetMinimum) => void }): ReactElement {
    const [minValue, setMinValue] = useState<string | undefined>(undefined);
    useEffect(() => {
      onReady(setMinValue);
    }, [onReady]);
    return (
      <>
        <button type="button">Outside</button>
        <p>Blank space</p>
        <Parts defaultValue="2026-10-14" {...definedProps({ minValue })} />
      </>
    );
  }

  it("moves keyboard focus to the clamped day when the focused day falls out of bounds", async () => {
    let setMinimum: SetMinimum | undefined;
    mount(<BoundsHarness onReady={(set) => (setMinimum = set)} />);
    await focusDay("Wednesday, October 14, 2026 selected");

    setMinimum?.("2026-10-20");

    await expectFocusOnDay("Tuesday, October 20, 2026, First available date");
    expect(roleNamed("button", "Wednesday, October 14, 2026")).toBeDisabled();
  });

  it("leaves focus outside the calendar where it is", async () => {
    let setMinimum: SetMinimum | undefined;
    mount(<BoundsHarness onReady={(set) => (setMinimum = set)} />);
    await focusDay("Wednesday, October 14, 2026 selected");
    roleNamed("button", "Outside").focus();

    setMinimum?.("2026-10-20");

    await expect
      .element(
        page.getByRole("button", { name: "Tuesday, October 20, 2026, First available date", exact: true })
      )
      .toHaveAttribute("tabindex", "0");
    expect(roleNamed("button", "Outside")).toHaveFocus();
  });

  it("leaves focus outside the calendar where it is after a click on blank space dropped it from a day", async () => {
    let setMinimum: SetMinimum | undefined;
    mount(<BoundsHarness onReady={(set) => (setMinimum = set)} />);
    await focusDay("Wednesday, October 14, 2026 selected");
    await userEvent.keyboard("{ArrowRight}");
    await expectFocusOnDay("Thursday, October 15, 2026");
    await userEvent.click(page.getByText("Blank space"));
    expect(roleNamed("button", "Thursday, October 15, 2026")).not.toHaveFocus();
    roleNamed("button", "Outside").focus();

    setMinimum?.("2026-10-20");

    await expect
      .element(
        page.getByRole("button", { name: "Tuesday, October 20, 2026, First available date", exact: true })
      )
      .toHaveAttribute("tabindex", "0");
    expect(roleNamed("button", "Outside")).toHaveFocus();
  });

  it("leaves focus outside the calendar where it is when the bounds change in the task that dropped it from a day", async () => {
    let setMinimum: SetMinimum | undefined;
    mount(<BoundsHarness onReady={(set) => (setMinimum = set)} />);
    await focusDay("Wednesday, October 14, 2026 selected");
    await userEvent.keyboard("{ArrowRight}");
    await expectFocusOnDay("Thursday, October 15, 2026");

    // Focus drops to nothing, a script focuses another control and tightens the bounds, all
    // before the calendar's next frame can see where focus went.
    roleNamed("button", "Thursday, October 15, 2026").blur();
    roleNamed("button", "Outside").focus();
    setMinimum?.("2026-10-20");

    await expect
      .element(
        page.getByRole("button", { name: "Tuesday, October 20, 2026, First available date", exact: true })
      )
      .toHaveAttribute("tabindex", "0");
    expect(roleNamed("button", "Outside")).toHaveFocus();
  });

  it("lets the live region speak again once a click on blank space took focus off the days", async () => {
    mount(<BoundsHarness onReady={() => undefined} />);
    const heading = page.getByRole("heading", { level: 2 });
    await userEvent.click(roleNamed("button", "Next"));
    await focusDay("Saturday, November 14, 2026");
    await expect.element(heading).toHaveAttribute("aria-live", "off");

    await userEvent.click(page.getByText("Blank space"));

    await expect.element(heading).toHaveAttribute("aria-live", "polite");
  });
});

describe("Calendar grid names", () => {
  /** How a test gives the heading an id: none, directly, or on the element it renders. */
  type HeadingIdForm = "none" | "direct" | "render";

  function Heading({ form }: { form: HeadingIdForm }): ReactElement {
    switch (form) {
      case "none":
        return <Calendar.MonthHeading />;
      case "direct":
        return <Calendar.MonthHeading id="october-heading" />;
      case "render":
        return <Calendar.MonthHeading render={<h3 id="october-heading" />} />;
    }
  }

  function Named({ root, form }: { root: Partial<CalendarRootProps>; form: HeadingIdForm }): ReactElement {
    return withLocale(
      "en-US",
      <>
        <p id="window-label">Delivery window</p>
        <Calendar.Root defaultValue="2026-10-14" {...root}>
          <Calendar.Months>
            {(month) => (
              <Calendar.Month key={month.toString()} value={month}>
                <Heading form={form} />
                <Calendar.DayGrid>
                  <Calendar.DayGridBody />
                </Calendar.DayGrid>
              </Calendar.Month>
            )}
          </Calendar.Months>
        </Calendar.Root>
      </>
    );
  }

  const CASES = [
    ["an unnamed Root", {}, "none", "October 2026"],
    ["an unnamed Root and a heading id passed directly", {}, "direct", "October 2026"],
    ["an unnamed Root and a heading id on its render element", {}, "render", "October 2026"],
    [
      "a Root named by aria-labelledby",
      { "aria-labelledby": "window-label" },
      "none",
      "Delivery window October 2026",
    ],
    [
      "a Root named by aria-labelledby and a heading id passed directly",
      { "aria-labelledby": "window-label" },
      "direct",
      "Delivery window October 2026",
    ],
    [
      "a Root named by aria-labelledby and a heading id on its render element",
      { "aria-labelledby": "window-label" },
      "render",
      "Delivery window October 2026",
    ],
    ["a Root named by aria-label", { "aria-label": "Delivery" }, "render", "Delivery, October 2026"],
  ] as const;

  it.each(CASES)("names the grid of %s", async (_case, root, form, name) => {
    renderThemed(<Named root={root} form={form} />);

    await expect.element(page.getByRole("grid", { name, exact: true })).toBeVisible();
    if (form !== "none") {
      // DOM audit: the heading keeps the consumer's id, which no role query reads.
      expect(document.querySelector("#october-heading")?.textContent).toBe("October 2026");
    }
  });

  it.each(CASES.filter(([, root]) => !("aria-label" in root)))(
    "writes the heading's name and the grid's reference with one id on the server, for %s",
    (_case, root, form) => {
      const host = document.createElement("div");
      host.innerHTML = renderToString(<Named root={root} form={form} />);
      try {
        // DOM audit: the server HTML before any script, which a role query of the live page cannot read.
        const grid = host.querySelector("[role=grid]");
        const ids = (grid?.getAttribute("aria-labelledby") ?? "")
          .split(" ")
          .filter((id) => id !== "window-label");
        expect(ids).toHaveLength(1);
        const named = host.querySelector(`[id="${ids[0] ?? ""}"]`);
        expect(named?.textContent).toBe("October 2026");
        expect(named?.closest("[data-slot=calendar-month-heading]")).not.toBeNull();
        if (form !== "none") {
          expect(host.querySelector("#october-heading")?.getAttribute("data-slot")).toBe(
            "calendar-month-heading"
          );
        }
      } finally {
        host.remove();
      }
    }
  );
});

describe("Calendar visibleMonths", () => {
  it.each([
    [0, ["Delivery, October 2026"]],
    [-2, ["Delivery, October 2026"]],
    [Number.NaN, ["Delivery, October 2026"]],
    [1.5, ["Delivery, October 2026"]],
    [2.9, ["Delivery, October 2026", "Delivery, November 2026"]],
  ])("shows a whole number of months from 1 for %d, and warns", (requested, grids) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      mount(<Harness defaultValue="2026-10-14" visibleMonths={requested} />);

      expect(gridNames()).toEqual(grids);
      expect(warn).toHaveBeenCalledWith(
        `Calendar.Root: visibleMonths ${String(requested)} is not a whole number from 1, so it shows ${String(grids.length)}.`
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("warns once while the same value stays, however often the Root renders", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      mount(<Harness defaultValue="2026-10-14" visibleMonths={0} />);
      await userEvent.click(roleNamed("button", "Next"));
      await userEvent.click(roleNamed("button", "Next"));

      await expect
        .element(visibleChanges())
        .toHaveTextContent("2026-11 increment-press, 2026-12 increment-press");
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("Calendar selection owner", () => {
  /**
   * A range-shaped owner a later Root could supply: fixed flags per day, and every hover and
   * press input it receives recorded. The parts must render the flags and forward the inputs.
   */
  function OwnedCalendar({
    inputs,
    rules = {},
  }: {
    inputs: string[];
    rules?: Partial<Pick<CalendarSettings, "isDateUnavailable" | "readOnly">>;
  }): ReactElement {
    const settings: CalendarSettings = {
      locale: "en-US",
      bounds: { min: undefined, max: undefined },
      isDateUnavailable: undefined,
      disabled: false,
      readOnly: false,
      firstDay: 7,
      visibleMonths: 1,
      pageBehavior: "visible",
      ariaLabel: "Stay",
      ariaLabelledBy: undefined,
      ...rules,
    };
    const [context] = useState((): CalendarRootContextValue => {
      const store = createCalendarStore(initialSharedState(Temporal.PlainDate.from("2026-10-12"), settings));
      const flags = new Map([
        ["2026-10-12", dayFlags(["selected", "selection-start", "in-range"])],
        ["2026-10-13", dayFlags(["selected", "in-range", "highlighted"])],
        ["2026-10-14", dayFlags(["selected", "selection-end", "in-range", "invalid"])],
      ]);
      return {
        store,
        settings,
        actions: {
          focusDay: () => undefined,
          blurTo: () => undefined,
          move: () => undefined,
          page: () => undefined,
        },
        selection: createSelectionOwner(store, {
          dayFlags: (_state, _date, iso) => flags.get(iso) ?? NO_DAY_FLAGS,
          select: (date, reason) => inputs.push(`select ${date.toString()} ${reason}`),
          hover: (date, event) => inputs.push(`hover ${date.toString()} ${event.pointerType}`),
        }),
      };
    });
    return (
      <CalendarRootContext value={context}>
        <Calendar.Months />
      </CalendarRootContext>
    );
  }

  /** A day's data attributes other than its slot, as `name=value`. */
  function dayAttributes(name: string): string[] {
    const day = roleNamed("button", name);
    return day
      .getAttributeNames()
      .filter((attribute) => attribute.startsWith("data-") && attribute !== "data-slot")
      .map((attribute) => `${attribute}=${day.getAttribute(attribute) ?? ""}`)
      .toSorted();
  }

  it("writes the owner's flags on each day and aria-selected on its gridcell", () => {
    mount(<OwnedCalendar inputs={[]} />);

    expect(dayAttributes("Monday, October 12, 2026 selected")).toEqual([
      "data-in-range=",
      "data-selected=",
      "data-selection-start=",
    ]);
    expect(dayAttributes("Tuesday, October 13, 2026 selected")).toEqual([
      "data-highlighted=",
      "data-in-range=",
      "data-selected=",
    ]);
    expect(dayAttributes("Wednesday, October 14, 2026 selected")).toEqual([
      "data-in-range=",
      "data-invalid=",
      "data-selected=",
      "data-selection-end=",
    ]);
    expect(roleNamed("button", "Wednesday, October 14, 2026 selected")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(dayAttributes("Thursday, October 15, 2026")).toEqual([]);
    for (const name of ["Monday, October 12, 2026 selected", "Wednesday, October 14, 2026 selected"]) {
      expect(roleNamed("button", name).closest("[role=gridcell]")).toHaveAttribute("aria-selected", "true");
    }
    expect(roleNamed("button", "Thursday, October 15, 2026").closest("[role=gridcell]")).not.toHaveAttribute(
      "aria-selected"
    );
  });

  it("hands the owner pointer and press inputs", async () => {
    const inputs: string[] = [];
    mount(<OwnedCalendar inputs={inputs} />);

    await userEvent.hover(roleNamed("button", "Tuesday, October 20, 2026"));
    await userEvent.click(roleNamed("button", "Tuesday, October 20, 2026"));
    await userEvent.keyboard("{Enter}");
    await userEvent.unhover(roleNamed("button", "Tuesday, October 20, 2026"));

    // The pointer may cross other days on its way; only its inputs on the 20th are under test.
    expect(inputs.filter((input) => !input.startsWith("hover") || input.includes("2026-10-20"))).toEqual([
      "hover 2026-10-20 mouse",
      "select 2026-10-20 day-press",
      "select 2026-10-20 keyboard",
    ]);
  });

  it.each([
    ["an unavailable day", { isDateUnavailable: (date: Temporal.PlainDate) => date.day === 20 }],
    ["a read-only calendar", { readOnly: true }],
  ])("hands the owner no press of %s", async (_case, rules) => {
    const inputs: string[] = [];
    mount(<OwnedCalendar inputs={inputs} rules={rules} />);

    // An unavailable day is aria-disabled, which the pointer must press through.
    await userEvent.click(roleNamed("button", "Tuesday, October 20, 2026"), { force: true });
    await userEvent.keyboard("{Enter}{ }");
    await userEvent.click(roleNamed("button", "Monday, October 19, 2026"));

    expect(inputs.filter((input) => input.startsWith("select"))).toEqual(
      "readOnly" in rules ? [] : ["select 2026-10-19 day-press"]
    );
  });
});

describe("Calendar hydrating late", () => {
  /** A Suspense gate that holds its children back on the client until released. */
  function createGate() {
    const { promise, resolve } = Promise.withResolvers<void>();
    return { held: false, promise, release: () => resolve() };
  }

  function Gate({ gate, children }: { gate: ReturnType<typeof createGate>; children: ReactNode }): ReactNode {
    if (gate.held) {
      use(gate.promise);
    }
    return children;
  }

  it.each([
    ["with a value", { defaultValue: "2030-06-10" }],
    ["without a value", {}],
  ] as const)("hydrates its months after the Root's effects ran, %s", async (_case, value) => {
    const gate = createGate();
    const element = withLocale(
      "en-US",
      <Calendar.Root aria-label="Delivery" {...value}>
        <Calendar.Header>
          <Calendar.VisibleRangeHeading />
        </Calendar.Header>
        <Suspense fallback={null}>
          <Gate gate={gate}>
            <Calendar.Months />
          </Gate>
        </Suspense>
      </Calendar.Root>
    );
    const host = document.createElement("div");
    host.innerHTML = renderToString(element);
    document.body.append(host);
    const recover = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      gate.held = true;
      root = hydrateRoot(host, element, { onRecoverableError: recover });
      // The Root hydrates and reads today while the months wait behind the gate. Opening on
      // today's month is not the user's page, so the live region stays quiet.
      await expect.element(page.getByRole("heading", { name: "June 2030" })).toBeVisible();
      await expect
        .element(page.getByRole("heading", { name: "June 2030" }))
        .toHaveAttribute("aria-live", "off");

      gate.release();

      await expect
        .element(page.getByRole("button", { name: /^Today, Saturday, June 15, 2030/ }))
        .toHaveAttribute("data-current");
      await expect
        .element(page.getByRole("grid", { name: "Delivery, June 2030", exact: true }))
        .toBeVisible();
      expect(recover).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
      root?.unmount();
      host.remove();
    }
  });
});

describe("Calendar selected day face", () => {
  /** A day button's painted fill and text colour. */
  function face(name: string) {
    const style = getComputedStyle(roleNamed("button", name));
    return { fill: style.backgroundColor, text: style.color };
  }

  it("paints the selected day with the primary pair and leaves an unselected day unfilled", () => {
    mount(<Harness defaultValue="2026-10-14" />);
    const selected = roleNamed("button", "Wednesday, October 14, 2026 selected");

    expect(face("Wednesday, October 14, 2026 selected")).toEqual({
      fill: cssVarColor(selected, "--primary"),
      text: cssVarColor(selected, "--primary-foreground"),
    });
    expect(face("Thursday, October 15, 2026")).toEqual({
      fill: "rgba(0, 0, 0, 0)",
      text: cssVarColor(selected, "--foreground"),
    });
  });

  it("paints a selected day that fails validation with the error pair", () => {
    mount(
      <Harness defaultValue="2026-10-15" isDateUnavailable={(date) => date.toString() === "2026-10-15"} />
    );
    const invalid = roleNamed("button", "Thursday, October 15, 2026 selected");

    expect(face("Thursday, October 15, 2026 selected")).toEqual({
      fill: cssVarColor(invalid, "--error"),
      text: cssVarColor(invalid, "--error-foreground"),
    });
  });
});
