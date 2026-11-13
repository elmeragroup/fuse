/**
 * Unit under test: the Calendar parts in Chromium, through their roles and names. Oracles: the
 * React Aria Calendar's behaviour (day names, grid names, keyboard targets, bound naming and
 * clamping, today naming), React Aria's
 * `react-stately` paging rules worked out by hand for the multi-month cases, and printed 2026
 * calendars. Every scenario runs under a clock frozen at local noon on June 15, 2030, outside
 * every month the scenarios show, except where a scenario names today itself.
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Suspense, use } from "react";
import type { ReactNode } from "react";

import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { expectRenderTypeError } from "../../../test/caught-error";
import { withLocale } from "../../../test/locale-matrix";
import { cssVarColor, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { definedProps } from "../../internal/defined-props";
import "../../temporal-polyfill";
import type { CalendarRootProps } from "./calendar";
import { Calendar } from "./index";

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
  // Every grid's name in document order, which a role query cannot list in order.
  return [...document.querySelectorAll("[role=grid]")].map((grid) => grid.getAttribute("aria-label") ?? "");
}

describe("Calendar parity with React Aria", () => {
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
    mount(<Harness defaultValue={Temporal.PlainDate.from("2026-10-14")} />);
    await focusDay("Wednesday, October 14, 2026 selected");

    await userEvent.keyboard(keys);

    await expectFocusOnDay(day);
    await expect.element(page.getByRole("grid", { name: grid, exact: true })).toBeVisible();
    await expect.element(committed()).toHaveTextContent("unchanged");
  });

  it("lets an unavailable date take focus but never selection", async () => {
    mount(
      <Harness
        defaultValue={Temporal.PlainDate.from("2026-10-14")}
        isDateUnavailable={(date) => date.toString() === "2026-10-15"}
      />
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
    mount(
      <Harness
        defaultValue={Temporal.PlainDate.from("2026-10-14")}
        minValue={Temporal.PlainDate.from("2026-10-10")}
        maxValue={Temporal.PlainDate.from("2026-10-20")}
      />
    );
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

  it("names the month buttons Previous and Next", async () => {
    mount(<Harness defaultValue={Temporal.PlainDate.from("2026-10-14")} />);

    await expect.element(page.getByRole("button", { name: "Previous", exact: true })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
  });

  it("prefixes today's day name with Today and leaves the other days plain", async () => {
    mount(<Harness defaultValue={Temporal.PlainDate.from("2030-06-10")} />);

    await expect
      .element(page.getByRole("button", { name: "Today, Saturday, June 15, 2030", exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Sunday, June 16, 2030", exact: true }))
      .toBeVisible();
  });
});

describe("Calendar selection", () => {
  it("selects a pressed day, marks its gridcell selected and reports a day-press", async () => {
    mount(<Harness defaultValue={Temporal.PlainDate.from("2026-10-14")} />);

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
    mount(<Harness defaultValue={Temporal.PlainDate.from("2026-10-14")} />);
    await focusDay("Wednesday, October 14, 2026 selected");

    await userEvent.keyboard("{ArrowLeft}{ }");

    await expect.element(committed()).toHaveTextContent("2026-10-13 keyboard null");
    await expectFocusOnDay("Tuesday, October 13, 2026 selected");
  });

  it("selects once while Enter is held, though every repeat is still default-prevented", async () => {
    const changes: string[] = [];
    mount(
      <Parts
        defaultValue={Temporal.PlainDate.from("2026-10-14")}
        onValueChange={(next) => changes.push(next.toString())}
      />
    );
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

  it("follows a controlled value from its parent without moving the view", async () => {
    function Controlled(): ReactElement {
      const [value, setValue] = useState<Temporal.PlainDate | null>(Temporal.PlainDate.from("2026-10-14"));
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
      <Harness
        defaultValue={Temporal.PlainDate.from("2026-10-15")}
        isDateUnavailable={(date) => date.toString() === "2026-10-15"}
      />
    );

    const day = roleNamed("button", "Thursday, October 15, 2026 selected");
    expect(day).toHaveAttribute("aria-invalid", "true");
    expect(day.closest("[role=gridcell]")).toHaveAttribute("aria-selected", "true");
    expect(roleNamed("group", "Delivery")).toHaveAttribute("data-invalid");
  });

  it("selects nothing while read-only, though focus still moves", async () => {
    mount(<Harness defaultValue={Temporal.PlainDate.from("2026-10-14")} readOnly />);
    await focusDay("Wednesday, October 14, 2026 selected");

    await userEvent.keyboard("{ArrowRight}{Enter}");
    await userEvent.click(roleNamed("button", "Friday, October 16, 2026"));

    await expectFocusOnDay("Friday, October 16, 2026");
    await expect.element(committed()).toHaveTextContent("unchanged");
    expect(roleNamed("grid", "Delivery, October 2026")).toHaveAttribute("aria-readonly", "true");
  });

  it("disables every day and both month buttons while disabled", () => {
    mount(<Harness defaultValue={Temporal.PlainDate.from("2026-10-14")} disabled />);

    expect(roleNamed("button", "Wednesday, October 14, 2026")).toBeDisabled();
    expect(roleNamed("button", "Previous")).toHaveAttribute("aria-disabled", "true");
    expect(roleNamed("button", "Next")).toHaveAttribute("aria-disabled", "true");
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
    mount(
      <Parts
        defaultValue={Temporal.PlainDate.from("2026-10-14")}
        onValueChange={(next) => changes.push(next.toString())}
      />
    );
    await focusDay("Wednesday, October 14, 2026 selected");
    await userEvent.keyboard("{ArrowRight}");
    await expectFocusOnDay("Thursday, October 15, 2026");

    const event = new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true });
    roleNamed("button", "Thursday, October 15, 2026").dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    await expectFocusOnDay("Thursday, October 15, 2026");
    expect(changes).toEqual([]);
  });
});

describe("Calendar cancelable change details", () => {
  it("keeps focus on its day when a key that would page is canceled", async () => {
    mount(<Harness defaultValue={Temporal.PlainDate.from("2026-10-14")} cancelVisible />);
    await focusDay("Wednesday, October 14, 2026 selected");

    await userEvent.keyboard("{PageDown}");

    await expect.element(visibleChanges()).toHaveTextContent("2026-11 keyboard");
    await expectFocusOnDay("Wednesday, October 14, 2026 selected");
    expect(gridNames()).toEqual(["Delivery, October 2026"]);
  });

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
      mount(<Harness defaultValue={Temporal.PlainDate.from("2026-10-14")} cancelValue />);
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
    mount(<Harness defaultValue={Temporal.PlainDate.from("2026-10-14")} cancelVisible />);

    await userEvent.click(roleNamed("button", "Next"));

    await expect.element(visibleChanges()).toHaveTextContent("2026-11 increment-press");
    await expect.element(page.getByRole("heading", { name: "October 2026" })).toBeVisible();
    expect(gridNames()).toEqual(["Delivery, October 2026"]);
  });
});

describe("Calendar across months", () => {
  it("keeps one tab stop across every grid", () => {
    mount(<Harness defaultValue={Temporal.PlainDate.from("2026-10-14")} visibleMonths={3} />);

    // Every day button's tab index across the three grids, outside days included.
    const stops = [...document.querySelectorAll("[data-slot=calendar-day-button]")].filter(
      (button) => button.getAttribute("tabindex") === "0"
    );
    expect(stops.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Wednesday, October 14, 2026 selected",
    ]);
  });

  it("shows three months around the value and names each grid by its month", () => {
    mount(<Harness defaultValue={Temporal.PlainDate.from("2026-10-14")} visibleMonths={3} />);

    expect(gridNames()).toEqual([
      "Delivery, September 2026",
      "Delivery, October 2026",
      "Delivery, November 2026",
    ]);
  });

  it("moves focus into the next grid without paging", async () => {
    mount(<Harness defaultValue={Temporal.PlainDate.from("2026-10-31")} visibleMonths={3} />);
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
    mount(
      <Harness
        defaultValue={Temporal.PlainDate.from("2026-10-14")}
        visibleMonths={3}
        pageBehavior={pageBehavior}
      />
    );
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
    mount(
      <Harness
        defaultValue={Temporal.PlainDate.from("2026-10-14")}
        visibleMonths={3}
        pageBehavior={pageBehavior}
      />
    );

    await userEvent.click(roleNamed("button", "Next"));

    await expect.element(visibleChanges()).toHaveTextContent(reported);
    expect(gridNames()).toEqual(shown.map((month) => `Delivery, ${month}`));
  });

  it("keeps the view inside the bounds and clamps focus to them on each page", async () => {
    mount(
      <Harness
        defaultValue={Temporal.PlainDate.from("2026-10-14")}
        visibleMonths={2}
        minValue={Temporal.PlainDate.from("2026-08-10")}
        maxValue={Temporal.PlainDate.from("2026-12-20")}
      />
    );
    await focusDay("Wednesday, October 14, 2026 selected");

    await userEvent.keyboard("{Shift>}{PageDown}{/Shift}");
    await expectFocusOnDay("Sunday, December 20, 2026, Last available date");
    expect(gridNames()).toEqual(["Delivery, November 2026", "Delivery, December 2026"]);

    await userEvent.keyboard("{Shift>}{PageUp}{/Shift}");
    await expectFocusOnDay("Monday, August 10, 2026, First available date");
    expect(gridNames()).toEqual(["Delivery, August 2026", "Delivery, September 2026"]);
  });
});

describe("Calendar today", () => {
  it("opens on today's month when it has no value", async () => {
    mount(<Harness />);

    await expect.element(page.getByRole("grid", { name: "Delivery, June 2030", exact: true })).toBeVisible();
    expect(roleNamed("button", "Today, Saturday, June 15, 2030")).toHaveAttribute("tabindex", "0");
  });

  it("moves the today marking when the page becomes visible on a new day", async () => {
    mount(<Harness defaultValue={Temporal.PlainDate.from("2030-06-10")} />);
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
});

describe("Calendar server rendering", () => {
  it("renders no today on the server and marks it after hydrating without a mismatch", async () => {
    const element = withLocale(
      "en-US",
      <Parts defaultValue={Temporal.PlainDate.from("2030-06-10")} visibleMonths={2} />
    );
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

describe("Calendar server rendering without a value", () => {
  /** The weekday labels of each placeholder month the server writes: hidden grids with no days. */
  function placeholderWeekdays(host: HTMLElement): string[][] {
    // The server HTML before any script, which a role query of the live page cannot read.
    const grids = [...host.querySelectorAll('[data-slot="calendar-month"][aria-hidden="true"] table')];
    return grids.map((grid) => [...grid.querySelectorAll("th")].map((cell) => cell.textContent));
  }

  // The month is today's, which only the client's first effect reads, so the server writes each
  // visible month's frame with no days in it, then hydration fills in today's months.
  it.each([
    ["en-US", 1, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]],
    ["nb-NO", 2, ["man.", "tir.", "ons.", "tor.", "fre.", "lør.", "søn."]],
  ] as const)(
    "writes %s weekday headers for %i month(s) on the server and hydrates them without a mismatch",
    async (locale, visibleMonths, weekdays) => {
      const element = withLocale(locale, <Parts visibleMonths={visibleMonths} />);
      const host = document.createElement("div");
      host.innerHTML = renderToString(element);
      document.body.append(host);
      const recover = vi.fn();
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        expect(placeholderWeekdays(host)).toEqual(Array.from({ length: visibleMonths }, () => weekdays));
        // No day of an unknown month: the server writes no day button.
        expect(host.querySelector("button[data-slot='calendar-day-button']")).toBeNull();

        root = hydrateRoot(host, element, { onRecoverableError: recover });

        // Today, the frozen June 15, 2030, marked once the first effect has read the clock.
        await expect.poll(() => host.querySelector("button[data-current]")?.textContent).toBe("15");
        expect(placeholderWeekdays(host)).toEqual([]);
        expect(recover).not.toHaveBeenCalled();
      } finally {
        root?.unmount();
        host.remove();
      }
    }
  );
});

describe("Calendar focus when the bounds change", () => {
  /** The harness's minimum setter, which a test calls without moving focus to a button. */
  type SetMinimum = (min: Temporal.PlainDate) => void;

  /** A calendar that hands its minimum's setter to `onReady` once mounted. */
  function BoundsHarness({ onReady }: { onReady: (set: SetMinimum) => void }): ReactElement {
    const [minValue, setMinValue] = useState<Temporal.PlainDate | undefined>(undefined);
    useEffect(() => {
      onReady(setMinValue);
    }, [onReady]);
    return (
      <>
        <button type="button">Outside</button>
        <p>Blank space</p>
        <Parts defaultValue={Temporal.PlainDate.from("2026-10-14")} {...definedProps({ minValue })} />
      </>
    );
  }

  it("moves keyboard focus to the clamped day when the focused day falls out of bounds", async () => {
    let setMinimum: SetMinimum | undefined;
    mount(<BoundsHarness onReady={(set) => (setMinimum = set)} />);
    await focusDay("Wednesday, October 14, 2026 selected");

    setMinimum?.(Temporal.PlainDate.from("2026-10-20"));

    await expectFocusOnDay("Tuesday, October 20, 2026, First available date");
    expect(roleNamed("button", "Wednesday, October 14, 2026")).toBeDisabled();
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

    setMinimum?.(Temporal.PlainDate.from("2026-10-20"));

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

  it("leaves focus outside the calendar where it is", async () => {
    let setMinimum: SetMinimum | undefined;
    mount(<BoundsHarness onReady={(set) => (setMinimum = set)} />);
    await focusDay("Wednesday, October 14, 2026 selected");
    roleNamed("button", "Outside").focus();

    setMinimum?.(Temporal.PlainDate.from("2026-10-20"));

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
    setMinimum?.(Temporal.PlainDate.from("2026-10-20"));

    await expect
      .element(
        page.getByRole("button", { name: "Tuesday, October 20, 2026, First available date", exact: true })
      )
      .toHaveAttribute("tabindex", "0");
    expect(roleNamed("button", "Outside")).toHaveFocus();
  });
});

describe("Calendar visibleMonths", () => {
  it("warns once while the same value stays, however often the Root renders", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      mount(<Harness defaultValue={Temporal.PlainDate.from("2026-10-14")} visibleMonths={0} />);
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

  it.each([
    [0, ["Delivery, October 2026"]],
    [-2, ["Delivery, October 2026"]],
    [Number.NaN, ["Delivery, October 2026"]],
    [1.5, ["Delivery, October 2026"]],
    [2.9, ["Delivery, October 2026", "Delivery, November 2026"]],
  ])("shows a whole number of months from 1 for %d, and warns", (requested, grids) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      mount(<Harness defaultValue={Temporal.PlainDate.from("2026-10-14")} visibleMonths={requested} />);

      expect(gridNames()).toEqual(grids);
      expect(warn).toHaveBeenCalledWith(
        `Calendar.Root: visibleMonths ${String(requested)} is not a whole number from 1, so it shows ${String(grids.length)}.`
      );
    } finally {
      warn.mockRestore();
    }
  });
});

describe("Calendar selected day face", () => {
  /** A day button's painted fill and text colour. */
  function face(name: string) {
    const style = getComputedStyle(roleNamed("button", name));
    return { fill: style.backgroundColor, text: style.color };
  }

  it("paints a selected day that fails validation with the error pair", () => {
    mount(
      <Harness
        defaultValue={Temporal.PlainDate.from("2026-10-15")}
        isDateUnavailable={(date) => date.toString() === "2026-10-15"}
      />
    );
    const invalid = roleNamed("button", "Thursday, October 15, 2026 selected");

    expect(face("Thursday, October 15, 2026 selected")).toEqual({
      fill: cssVarColor(invalid, "--error"),
      text: cssVarColor(invalid, "--error-foreground"),
    });
  });
});

describe("date props past the types", () => {
  it("throws a TypeError naming the Root, the prop and the string for ISO text", () => {
    expectRenderTypeError(
      'Calendar.Root value: received the string "2026-10-14"',
      <Calendar.Root
        aria-label="Delivery"
        // @ts-expect-error -- text reaches the prop past the types: from plain JavaScript, or as the ISO text a server component's Temporal object crosses as
        value="2026-10-14"
      />
    );
  });

  it("throws for ISO text in value after the equal Temporal value, whatever rendered before", () => {
    expectRenderTypeError(
      'Calendar.Root value: received the string "2026-10-14"',
      <Calendar.Root aria-label="Delivery" value={Temporal.PlainDate.from("2026-10-14")} />,
      <Calendar.Root
        aria-label="Delivery"
        // @ts-expect-error -- the equal ISO text, past the types, after a Temporal value
        value="2026-10-14"
      />
    );
  });

  it("throws for ISO text in a bound after the equal Temporal value, whatever rendered before", () => {
    expectRenderTypeError(
      'Calendar.Root minValue: received the string "2026-10-01"',
      <Calendar.Root aria-label="Delivery" minValue={Temporal.PlainDate.from("2026-10-01")} />,
      <Calendar.Root
        aria-label="Delivery"
        // @ts-expect-error -- the equal ISO text, past the types, after a Temporal value
        minValue="2026-10-01"
      />
    );
  });

  it("throws for ISO text in defaultValue beside a controlled value", () => {
    expectRenderTypeError(
      'Calendar.Root defaultValue: received the string "2026-10-14"',
      <Calendar.Root
        aria-label="Delivery"
        value={null}
        // @ts-expect-error -- text reaches the prop past the types
        defaultValue="2026-10-14"
      />
    );
  });

  it("throws for ISO text in defaultValue after the equal Temporal value, whatever rendered before", () => {
    expectRenderTypeError(
      'Calendar.Root defaultValue: received the string "2026-10-14"',
      <Calendar.Root aria-label="Delivery" defaultValue={Temporal.PlainDate.from("2026-10-14")} />,
      <Calendar.Root
        aria-label="Delivery"
        // @ts-expect-error -- the equal ISO text, past the types, after a Temporal value
        defaultValue="2026-10-14"
      />
    );
  });
});

describe("Calendar month buttons", () => {
  it("pages one month and reports each press", async () => {
    mount(<Harness defaultValue={Temporal.PlainDate.from("2026-10-14")} />);

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
      <Harness
        defaultValue={Temporal.PlainDate.from("2026-10-14")}
        minValue={Temporal.PlainDate.from("2026-09-20")}
        maxValue={Temporal.PlainDate.from("2026-11-05")}
        visibleMonths={2}
      />
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
    mount(<Harness defaultValue={Temporal.PlainDate.from("2026-10-14")} visibleMonths={3} />);

    const heading = page.getByRole("heading", { level: 2 });
    await expect.element(heading).toHaveAttribute("aria-live", "off");
    // The calendar writes exactly one live region, which no role query can count.
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
      return <Harness defaultValue={Temporal.PlainDate.from("2026-10-14")} visibleMonths={months} />;
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
        <Calendar.Root defaultValue={Temporal.PlainDate.from("2026-10-14")} {...root}>
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
      // The heading keeps the consumer's id, which no role query reads.
      expect(document.querySelector("#october-heading")?.textContent).toBe("October 2026");
    }
  });

  it.each(CASES.filter(([, root]) => !("aria-label" in root)))(
    "writes the heading's name and the grid's reference with one id on the server, for %s",
    (_case, root, form) => {
      const host = document.createElement("div");
      host.innerHTML = renderToString(<Named root={root} form={form} />);
      try {
        // The server HTML before any script, which a role query of the live page cannot read.
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
    ["with a value", { defaultValue: Temporal.PlainDate.from("2030-06-10") }],
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
