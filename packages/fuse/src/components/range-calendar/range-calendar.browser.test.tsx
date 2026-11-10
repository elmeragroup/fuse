/**
 * Unit under test: RangeCalendar's Root over Calendar's parts in Chromium, through roles, names
 * and data attributes. Oracles: the React Aria interim tier's behaviour (keyboard anchoring and its one-day
 * focus step, Escape, range-end names), React Aria's `useRangeCalendarState` and
 * `useRangeCalendar` rules (swap, narrowing around the anchor, commit on blur and outside press)
 * worked out by hand, and printed 2026 calendars. Every scenario runs under a clock frozen at
 * local noon on June 15, 2030, outside every month the scenarios show.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { expectRenderTypeError } from "../../../test/caught-error";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import "../../temporal-polyfill";
import { RangeCalendar } from "./index";
import type { RangeCalendarRootProps } from "./range-calendar";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2030-06-15T12:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

function Parts(props: RangeCalendarRootProps): ReactElement {
  return (
    <RangeCalendar.Root aria-label="Stay" {...props}>
      <RangeCalendar.Header>
        <RangeCalendar.DecrementMonth />
        <RangeCalendar.VisibleRangeHeading />
        <RangeCalendar.IncrementMonth />
      </RangeCalendar.Header>
      <RangeCalendar.Months />
    </RangeCalendar.Root>
  );
}

/** A range calendar printing each range it reports, with the reason and validation error. */
function Harness({
  cancel,
  ...props
}: RangeCalendarRootProps & { cancel?: (reason: string) => boolean }): ReactElement {
  const [value, setValue] = useState("unchanged");
  return (
    <>
      <button type="button">Before</button>
      <Parts
        {...props}
        onValueChange={(next, details) => {
          if (cancel?.(details.reason) === true) {
            details.cancel();
          }
          setValue(
            `${next.start.toString()}..${next.end.toString()} ${details.reason} ${String(details.getValidationError())}`
          );
        }}
      />
      <button type="button">After</button>
      <p>Outside text</p>
      <p onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
        Text that stops presses
      </p>
      <output aria-label="Committed value">{value}</output>
    </>
  );
}

function mount(node: ReactElement): ReturnType<typeof renderThemed> {
  return renderThemed(withLocale("en-US", node));
}

const committed = () => page.getByRole("status", { name: "Committed value" });

async function expectFocusOnDay(name: string): Promise<void> {
  await expect.element(page.getByRole("button", { name, exact: true })).toHaveFocus();
}

/** Put keyboard focus on one day without a pointer over the grid, which would move the highlight. */
async function focusDay(name: string): Promise<void> {
  await userEvent.hover(roleNamed("button", "Before"));
  roleNamed("button", name).focus();
  await expectFocusOnDay(name);
}

/** The day numbers whose gridcell is `aria-selected`, in document order. */
function selectedDays(): string[] {
  return page
    .getByRole("gridcell")
    .elements()
    .filter((cell) => cell.getAttribute("aria-selected") === "true")
    .map((cell) => cell.textContent);
}

describe("RangeCalendar parity with the interim tier", () => {
  it("anchors on Enter, moves focus a day, follows focus, drops the anchor on Escape and completes", async () => {
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
      />
    );
    expect(selectedDays()).toEqual(["5", "6", "7", "8", "9"]);
    await focusDay("Monday, October 12, 2026");

    await userEvent.keyboard("{Enter}");
    await expectFocusOnDay("Tuesday, October 13, 2026 selected");
    expect(selectedDays()).toEqual(["12", "13"]);
    await userEvent.keyboard("{ArrowRight}");
    await expectFocusOnDay("Wednesday, October 14, 2026 selected");
    expect(selectedDays()).toEqual(["12", "13", "14"]);
    await expect.element(committed()).toHaveTextContent("unchanged");

    await userEvent.keyboard("{Escape}");
    expect(selectedDays()).toEqual(["5", "6", "7", "8", "9"]);
    await expectFocusOnDay("Wednesday, October 14, 2026");

    await userEvent.keyboard("{Enter}{ArrowRight}{Enter}");
    await expect.element(committed()).toHaveTextContent("2026-10-14..2026-10-16 keyboard null");
    expect(selectedDays()).toEqual(["14", "15", "16"]);
  });
});

describe("RangeCalendar committing an open range", () => {
  it("selects to the focused day when focus leaves the calendar", async () => {
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
      />
    );
    await focusDay("Monday, October 12, 2026");
    await userEvent.keyboard("{Enter}{ArrowRight}");
    await userEvent.keyboard("{Tab}");
    await expect.element(roleNamed("button", "After")).toHaveFocus();
    await expect.element(committed()).toHaveTextContent("2026-10-12..2026-10-14 focus-out null");
  });

  it("reports focus-out for a mouse press on an outside button, which takes focus first", async () => {
    const reported: string[] = [];
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
        cancel={(reason) => {
          reported.push(reason);
          return false;
        }}
      />
    );
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    await userEvent.hover(roleNamed("button", "Thursday, October 15, 2026"));
    await userEvent.click(roleNamed("button", "After"));
    await expect.element(roleNamed("button", "After")).toHaveFocus();
    await expect.element(committed()).toHaveTextContent("2026-10-12..2026-10-15 focus-out null");
    expect(reported).toEqual(["focus-out"]);
  });

  it("keeps an open range while focus moves to a month button inside the calendar", async () => {
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
      />
    );
    await focusDay("Monday, October 12, 2026");
    await userEvent.keyboard("{Enter}");
    roleNamed("button", "Next").focus();
    await expect.element(roleNamed("button", "Next")).toHaveFocus();
    await expect.element(committed()).toHaveTextContent("unchanged");
    expect(roleNamed("group", "Stay")).toHaveAttribute("data-selecting");
  });

  it("selects to the hovered day on a press outside the calendar", async () => {
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
      />
    );
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    await userEvent.hover(roleNamed("button", "Thursday, October 15, 2026"));
    await userEvent.click(page.getByText("Outside text"));
    await expect.element(committed()).toHaveTextContent("2026-10-12..2026-10-15 outside-press null");
    expect(selectedDays()).toEqual(["12", "13", "14", "15"]);
  });
});

describe("RangeCalendar cancelable change details", () => {
  it("keeps the value and drops the anchor when a focus-out commit is canceled", async () => {
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
        cancel={(reason) => reason === "focus-out"}
      />
    );
    await focusDay("Monday, October 12, 2026");
    await userEvent.keyboard("{Enter}");
    roleNamed("button", "After").focus();
    await expect.element(committed()).toHaveTextContent("2026-10-12..2026-10-13 focus-out null");
    expect(selectedDays()).toEqual(["5", "6", "7", "8", "9"]);
    expect(roleNamed("group", "Stay")).not.toHaveAttribute("data-selecting");
  });
});

describe("RangeCalendar read-only and disabled", () => {
  it("anchors nothing while read-only", async () => {
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
        readOnly
      />
    );
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    await userEvent.hover(roleNamed("button", "Thursday, October 15, 2026"));
    expect(selectedDays()).toEqual(["5", "6", "7", "8", "9"]);
    expect(roleNamed("group", "Stay")).not.toHaveAttribute("data-selecting");
  });
});

describe("RangeCalendar made read-only or disabled while a range is open", () => {
  it.each([
    ["readOnly", "outside press"],
    ["readOnly", "focus-out"],
    ["disabled", "outside press"],
    ["disabled", "focus-out"],
  ] as const)("selects nothing once %s, on an %s", async (prop, settle) => {
    const props = {
      defaultValue: {
        start: Temporal.PlainDate.from("2026-10-05"),
        end: Temporal.PlainDate.from("2026-10-09"),
      },
    };
    const view = mount(<Harness {...props} />);
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    await userEvent.hover(roleNamed("button", "Thursday, October 15, 2026"));
    expect(roleNamed("group", "Stay")).toHaveAttribute("data-selecting");

    view.rerender(withLocale("en-US", <Harness {...props} {...{ [prop]: true }} />));
    if (settle === "outside press") {
      await userEvent.click(page.getByText("Outside text"));
    } else {
      roleNamed("button", "After").focus();
      await expect.element(roleNamed("button", "After")).toHaveFocus();
    }

    await expect.element(committed()).toHaveTextContent("unchanged");
    expect(roleNamed("group", "Stay")).not.toHaveAttribute("data-selecting");
    // Back to editable, the range is the one it had: nothing was completed in the meantime.
    view.rerender(withLocale("en-US", <Harness {...props} />));
    expect(selectedDays()).toEqual(["5", "6", "7", "8", "9"]);
  });
});

describe("RangeCalendar outside presses, regardless of the pressed element and the Root's element", () => {
  it.each(["select", "reset"] as const)(
    "settles a range when the pressed element stops the press's propagation (%s)",
    async (commitBehavior) => {
      mount(
        <Harness
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}
          commitBehavior={commitBehavior}
        />
      );
      await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
      await userEvent.hover(roleNamed("button", "Thursday, October 15, 2026"));
      expect(roleNamed("group", "Stay")).toHaveAttribute("data-selecting");

      await userEvent.click(page.getByText("Text that stops presses"));

      expect(roleNamed("group", "Stay")).not.toHaveAttribute("data-selecting");
      if (commitBehavior === "select") {
        await expect.element(committed()).toHaveTextContent("2026-10-12..2026-10-15 outside-press null");
        expect(selectedDays()).toEqual(["12", "13", "14", "15"]);
      } else {
        await expect.element(committed()).toHaveTextContent("unchanged");
        expect(selectedDays()).toEqual(["5", "6", "7", "8", "9"]);
      }
    }
  );
});

describe("date props past the types", () => {
  it("throws for ISO text in a range end after the equal Temporal value, whatever rendered before", () => {
    const start = Temporal.PlainDate.from("2026-10-05");
    expectRenderTypeError(
      'RangeCalendar.Root value.end: received the string "2026-10-09"',
      <RangeCalendar.Root aria-label="Stay" value={{ start, end: Temporal.PlainDate.from("2026-10-09") }} />,
      <RangeCalendar.Root
        aria-label="Stay"
        value={{
          start,
          // @ts-expect-error -- the equal ISO text, past the types, after a Temporal value
          end: "2026-10-09",
        }}
      />
    );
  });

  it("throws for ISO text in a default range end beside a controlled value", () => {
    expectRenderTypeError(
      'RangeCalendar.Root defaultValue.end: received the string "2026-10-09"',
      <RangeCalendar.Root
        aria-label="Stay"
        value={null}
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          // @ts-expect-error -- text reaches the prop past the types
          end: "2026-10-09",
        }}
      />
    );
  });

  it("throws for ISO text in a default range end after the equal Temporal value, whatever rendered before", () => {
    const start = Temporal.PlainDate.from("2026-10-05");
    expectRenderTypeError(
      'RangeCalendar.Root defaultValue.end: received the string "2026-10-09"',
      <RangeCalendar.Root
        aria-label="Stay"
        defaultValue={{ start, end: Temporal.PlainDate.from("2026-10-09") }}
      />,
      <RangeCalendar.Root
        aria-label="Stay"
        defaultValue={{
          start,
          // @ts-expect-error -- the equal ISO text, past the types, after a Temporal value
          end: "2026-10-09",
        }}
      />
    );
  });
  it("throws a TypeError naming the end for a range value with a null end", () => {
    expectRenderTypeError(
      "RangeCalendar.Root value.end: received no day",
      <RangeCalendar.Root
        aria-label="Stay"
        value={{
          start: Temporal.PlainDate.from("2026-10-05"),
          // @ts-expect-error -- plain JavaScript passes a range missing its end
          end: null,
        }}
      />
    );
  });

  it("throws for a range value missing its start after a whole range rendered", () => {
    const end = Temporal.PlainDate.from("2026-10-09");
    expectRenderTypeError(
      "RangeCalendar.Root value.start: received no day",
      <RangeCalendar.Root aria-label="Stay" value={{ start: Temporal.PlainDate.from("2026-10-05"), end }} />,
      // @ts-expect-error -- plain JavaScript passes a range without its start
      <RangeCalendar.Root aria-label="Stay" value={{ end }} />
    );
  });

  it("throws for a default range missing its end", () => {
    expectRenderTypeError(
      "RangeCalendar.Root defaultValue.end: received no day",
      // @ts-expect-error -- plain JavaScript passes a range without its end
      <RangeCalendar.Root aria-label="Stay" defaultValue={{ start: Temporal.PlainDate.from("2026-10-05") }} />
    );
  });

  it("throws for a default range with a null end after a whole default rendered, beside a controlled value", () => {
    const start = Temporal.PlainDate.from("2026-10-05");
    expectRenderTypeError(
      "RangeCalendar.Root defaultValue.end: received no day",
      <RangeCalendar.Root
        aria-label="Stay"
        value={null}
        defaultValue={{ start, end: Temporal.PlainDate.from("2026-10-09") }}
      />,
      <RangeCalendar.Root
        aria-label="Stay"
        value={null}
        defaultValue={{
          start,
          // @ts-expect-error -- plain JavaScript passes a range missing its end
          end: null,
        }}
      />
    );
  });
});
