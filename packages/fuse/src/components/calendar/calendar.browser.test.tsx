/**
 * Unit under test: the Calendar parts in Chromium, through their roles and names. Oracles: the
 * React Aria interim tier's behaviour (day names, grid names, keyboard targets, bound naming and
 * clamping, today naming), React Aria's
 * `react-stately` paging rules worked out by hand for the multi-month cases, and printed 2026
 * calendars. Every scenario runs under a clock frozen at local noon on June 15, 2030, outside
 * every month the scenarios show, except where a scenario names today itself.
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";

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
  // DOM audit: every grid's name in document order, which a role query cannot list in order.
  return [...document.querySelectorAll("[role=grid]")].map((grid) => grid.getAttribute("aria-label") ?? "");
}

describe("Calendar parity with the interim tier", () => {
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
});

describe("Calendar today", () => {
  it("opens on today's month when it has no value", async () => {
    mount(<Harness />);

    await expect.element(page.getByRole("grid", { name: "Delivery, June 2030", exact: true })).toBeVisible();
    expect(roleNamed("button", "Today, Saturday, June 15, 2030")).toHaveAttribute("tabindex", "0");
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
