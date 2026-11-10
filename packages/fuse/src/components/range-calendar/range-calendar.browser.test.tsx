/**
 * Unit under test: RangeCalendar's Root over Calendar's parts in Chromium, through roles, names
 * and data attributes. Oracles: the React Aria interim tier as
 * `src/internal/date-tier-parity.browser.test.tsx` pins it (keyboard anchoring and its one-day
 * focus step, Escape, range-end names), React Aria's `useRangeCalendarState` and
 * `useRangeCalendar` rules (swap, narrowing around the anchor, commit on blur and outside press)
 * worked out by hand, and printed 2026 calendars. Every scenario runs under a clock frozen at
 * local noon on June 15, 2030, outside every month the scenarios show.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { createPortal } from "react-dom";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { expectRenderTypeError } from "../../../test/caught-error";
import { emulateForcedColors, systemColor } from "../../../test/forced-colors";
import { withLocale } from "../../../test/locale-matrix";
import { cssVarColor, renderThemed, roleNamed } from "../../../test/themed-browser-render";
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

/** The ISO days whose cell carries a data attribute, in document order. */
function daysWith(attribute: string): string[] {
  // DOM audit: data attributes are the styling contract, which no role query reads.
  return [...document.querySelectorAll(`[data-slot=calendar-day-grid-cell][${attribute}]`)].map(
    (cell) => cell.querySelector("button")?.getAttribute("aria-label") ?? ""
  );
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

  it("names the range ends with the whole selected range, and a one-day range with its date", async () => {
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
      />
    );
    for (const name of [
      "Selected Range: Monday, October 5 to Friday, October 9, 2026, Monday, October 5, 2026 selected",
      "Tuesday, October 6, 2026 selected",
      "Selected Range: Monday, October 5 to Friday, October 9, 2026, Friday, October 9, 2026 selected",
    ]) {
      await expect.element(page.getByRole("button", { name, exact: true })).toBeVisible();
    }

    await userEvent.click(roleNamed("button", "Tuesday, October 20, 2026"));
    await userEvent.click(roleNamed("button", "Tuesday, October 20, 2026 selected"));
    await expect
      .element(
        page.getByRole("button", {
          name: "Selected Date: Tuesday, October 20, 2026, Tuesday, October 20, 2026 selected",
          exact: true,
        })
      )
      .toBeVisible();
  });

  it("describes the tab-stop day by what selecting it does", async () => {
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
      />
    );
    await focusDay(
      "Selected Range: Monday, October 5 to Friday, October 9, 2026, Monday, October 5, 2026 selected"
    );
    await expect
      .element(page.getByRole("button", { name: /October 5, 2026 selected$/ }))
      .toHaveAccessibleDescription("Click to start selecting date range");

    await userEvent.keyboard("{Enter}");
    await expect
      .element(page.getByRole("button", { name: "Tuesday, October 6, 2026 selected", exact: true }))
      .toHaveAccessibleDescription("Click to finish selecting date range");
    expect(roleNamed("button", "Wednesday, October 7, 2026")).not.toHaveAttribute("aria-describedby");
  });
});

describe("RangeCalendar pointer selection", () => {
  it("anchors on a press, highlights to the hovered day, and completes earlier day first", async () => {
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
      />
    );
    await userEvent.click(roleNamed("button", "Thursday, October 22, 2026"));
    await expect.element(committed()).toHaveTextContent("unchanged");

    await userEvent.hover(roleNamed("button", "Monday, October 19, 2026"));
    expect(selectedDays()).toEqual(["19", "20", "21", "22"]);
    expect(daysWith("data-highlighted")).toHaveLength(4);
    expect(daysWith("data-selection-start")).toEqual(["Monday, October 19, 2026 selected"]);
    expect(daysWith("data-selection-end")).toEqual(["Thursday, October 22, 2026 selected"]);

    await userEvent.click(roleNamed("button", "Monday, October 19, 2026 selected"));
    await expect.element(committed()).toHaveTextContent("2026-10-19..2026-10-22 day-press null");
    expect(daysWith("data-highlighted")).toEqual([]);
    expect(daysWith("data-in-range")).toHaveLength(4);
    expect(roleNamed("group", "Stay")).not.toHaveAttribute("data-selecting");
  });

  it("marks the Root selecting while a range is open", async () => {
    mount(<Harness />);
    await expect.element(page.getByRole("grid", { name: "Stay, June 2030" })).toBeVisible();
    await userEvent.click(roleNamed("button", "Monday, June 10, 2030"));
    expect(roleNamed("group", "Stay")).toHaveAttribute("data-selecting");
  });

  it("highlights a range across the visible months' grids", async () => {
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-01"),
          end: Temporal.PlainDate.from("2026-10-02"),
        }}
        visibleMonths={3}
      />
    );
    await userEvent.click(roleNamed("button", "Wednesday, October 28, 2026"));
    await userEvent.hover(roleNamed("button", "Tuesday, November 3, 2026"));

    expect(daysWith("data-highlighted")).toEqual([
      "Wednesday, October 28, 2026 selected",
      "Thursday, October 29, 2026 selected",
      "Friday, October 30, 2026 selected",
      "Saturday, October 31, 2026 selected",
      "Sunday, November 1, 2026 selected",
      "Monday, November 2, 2026 selected",
      "Tuesday, November 3, 2026 selected",
    ]);
    await userEvent.click(roleNamed("button", "Tuesday, November 3, 2026 selected"));
    await expect.element(committed()).toHaveTextContent("2026-10-28..2026-11-03 day-press null");
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

  it("drops the anchor and keeps the range with commitBehavior reset", async () => {
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
        commitBehavior="reset"
      />
    );
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    await userEvent.hover(roleNamed("button", "Thursday, October 15, 2026"));
    await userEvent.click(page.getByText("Outside text"));
    await expect.element(committed()).toHaveTextContent("unchanged");
    expect(selectedDays()).toEqual(["5", "6", "7", "8", "9"]);
  });

  it("stops Escape that drops an anchor from reaching the page, and lets it through otherwise", async () => {
    const escapes = vi.fn<() => void>();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        escapes();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    try {
      mount(
        <Harness
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}
        />
      );
      await focusDay("Monday, October 12, 2026");
      await userEvent.keyboard("{Enter}{Escape}");
      expect(escapes).not.toHaveBeenCalled();
      await userEvent.keyboard("{Escape}");
      expect(escapes).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener("keydown", onKeyDown);
    }
  });
});

describe("RangeCalendar unavailable days", () => {
  const saturdays = (date: Temporal.PlainDate) => date.dayOfWeek === 6;

  it("narrows an anchored range to the available days around the anchor and disables the rest", async () => {
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
        isDateUnavailable={saturdays}
      />
    );
    await focusDay("Tuesday, October 13, 2026");
    await userEvent.keyboard("{Enter}");
    await expectFocusOnDay("Wednesday, October 14, 2026 selected");

    expect(roleNamed("button", "Monday, October 19, 2026")).toBeDisabled();
    expect(roleNamed("button", "Thursday, October 8, 2026")).toBeDisabled();
    expect(roleNamed("button", "Sunday, October 11, 2026, First available date")).not.toBeDisabled();
    await userEvent.keyboard("{End}");
    await expectFocusOnDay("Friday, October 16, 2026 selected, Last available date");
    await userEvent.keyboard("{Enter}");

    await expect.element(committed()).toHaveTextContent("2026-10-13..2026-10-16 keyboard null");
    expect(roleNamed("button", "Monday, October 19, 2026")).not.toBeDisabled();
  });

  it("asks isDateUnavailable with the anchor while a range is open", async () => {
    // Only days more than two days from the anchor are unavailable.
    const near = (date: Temporal.PlainDate, anchor: Temporal.PlainDate | null) =>
      anchor !== null && Math.abs(anchor.until(date).days) > 2;
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
        isDateUnavailable={near}
      />
    );
    await userEvent.click(roleNamed("button", "Tuesday, October 20, 2026"));

    // October 23 is the nearest unavailable day, so the range can reach October 22 at most.
    expect(roleNamed("button", "Friday, October 23, 2026")).toBeDisabled();
    expect(roleNamed("button", "Thursday, October 22, 2026, Last available date")).not.toBeDisabled();
    await userEvent.click(roleNamed("button", "Thursday, October 22, 2026, Last available date"));
    await expect.element(committed()).toHaveTextContent("2026-10-20..2026-10-22 day-press null");
    expect(roleNamed("button", "Friday, October 23, 2026")).not.toHaveAttribute("data-unavailable");
  });

  it("marks a range with an unavailable end invalid on its days and its Root", () => {
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-12"),
          end: Temporal.PlainDate.from("2026-10-17"),
        }}
        isDateUnavailable={saturdays}
      />
    );
    expect(roleNamed("group", "Stay")).toHaveAttribute("data-invalid");
    expect(daysWith("data-invalid")).toHaveLength(6);
    expect(
      page.getByRole("button", { name: /Saturday, October 17, 2026 selected$/ }).element()
    ).toHaveAttribute("aria-invalid", "true");
  });
});

describe("RangeCalendar cancelable change details", () => {
  it("keeps the value and the anchor when a completing day press is canceled", async () => {
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
        cancel={(reason) => reason === "day-press"}
      />
    );
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    await userEvent.hover(roleNamed("button", "Wednesday, October 14, 2026"));
    await userEvent.click(roleNamed("button", "Wednesday, October 14, 2026 selected"));
    await expect.element(committed()).toHaveTextContent("2026-10-12..2026-10-14 day-press null");
    // The anchor stands: hovering another end still highlights from October 12.
    await userEvent.hover(roleNamed("button", "Thursday, October 15, 2026"));
    expect(selectedDays()).toEqual(["12", "13", "14", "15"]);
    // Dropping the anchor shows the value, which the canceled press left as it was.
    await userEvent.keyboard("{Escape}");
    expect(selectedDays()).toEqual(["5", "6", "7", "8", "9"]);
  });

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

  it("keeps the range a controlled parent holds until it accepts a new one", async () => {
    function Controlled(): ReactElement {
      const [value, setValue] = useState({
        start: Temporal.PlainDate.from("2026-10-05"),
        end: Temporal.PlainDate.from("2026-10-09"),
      });
      return (
        <>
          <Parts value={value} onValueChange={(next) => setValue(next)} />
          <button
            type="button"
            onClick={() =>
              setValue({
                start: Temporal.PlainDate.from("2026-10-26"),
                end: Temporal.PlainDate.from("2026-10-28"),
              })
            }>
            Late October
          </button>
        </>
      );
    }
    mount(<Controlled />);
    await userEvent.click(roleNamed("button", "Late October"));
    expect(selectedDays()).toEqual(["26", "27", "28"]);
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026 selected"));
    expect(selectedDays()).toEqual(["12"]);
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

describe("RangeCalendar renders", () => {
  it("renders only the days whose state changes as the hover moves over a three-month view", async () => {
    const renders: string[] = [];
    function Counted(): ReactElement {
      return (
        <RangeCalendar.Root
          aria-label="Stay"
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}
          visibleMonths={3}>
          <RangeCalendar.Months>
            {(month) => (
              <RangeCalendar.Month key={month.toString()} value={month}>
                <RangeCalendar.DayGrid>
                  <RangeCalendar.DayGridBody>
                    {(week) => (
                      <RangeCalendar.DayGridRow key={week.toString()} value={week}>
                        {(day) => (
                          <RangeCalendar.DayGridCell key={day.toString()} value={day}>
                            <RangeCalendar.DayButton
                              render={(props) => {
                                renders.push(day.toString());
                                return <button {...props} />;
                              }}
                            />
                          </RangeCalendar.DayGridCell>
                        )}
                      </RangeCalendar.DayGridRow>
                    )}
                  </RangeCalendar.DayGridBody>
                </RangeCalendar.DayGrid>
              </RangeCalendar.Month>
            )}
          </RangeCalendar.Months>
        </RangeCalendar.Root>
      );
    }
    mount(<Counted />);
    await userEvent.click(roleNamed("button", "Wednesday, October 28, 2026"));
    await userEvent.hover(roleNamed("button", "Monday, November 2, 2026"));
    renders.length = 0;

    await userEvent.hover(roleNamed("button", "Wednesday, November 4, 2026"));

    // The range end moves from November 2 to November 4: November 2 becomes a middle day,
    // November 3 and 4 join the range, and the tab stop moves from November 2 to November 4.
    expect(renders.toSorted()).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
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

describe("RangeCalendar grid semantics", () => {
  it("marks every grid multiselectable, default and composed, where Calendar's grid is not", () => {
    mount(
      <>
        <Parts
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}
          visibleMonths={2}
        />
        <RangeCalendar.Root
          aria-label="Composed"
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}>
          <RangeCalendar.Months>
            {(month) => (
              <RangeCalendar.Month key={month.toString()} value={month}>
                <RangeCalendar.DayGrid>
                  <RangeCalendar.DayGridBody />
                </RangeCalendar.DayGrid>
              </RangeCalendar.Month>
            )}
          </RangeCalendar.Months>
        </RangeCalendar.Root>
      </>
    );
    const grids = page.getByRole("grid").elements();
    expect(grids.map((grid) => grid.getAttribute("aria-label"))).toEqual([
      "Stay, October 2026",
      "Stay, November 2026",
      "Composed, October 2026",
    ]);
    for (const grid of grids) {
      expect(grid).toHaveAttribute("aria-multiselectable", "true");
    }
  });

  it("writes aria-multiselectable in the server render", () => {
    const html = renderToString(
      withLocale(
        "en-US",
        <Parts
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}
        />
      )
    );
    const host = document.createElement("div");
    host.innerHTML = html;
    expect(host.querySelector("[role=grid]")?.getAttribute("aria-multiselectable")).toBe("true");
  });
});

describe("RangeCalendar in a same-origin frame", () => {
  it("drops the anchor on Escape and settles an open range on a press inside the frame", async () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    try {
      const frameDocument = frame.contentDocument;
      // SAFETY: a same-origin frame's window has this window's globals, from its own realm.
      const frameWindow = frame.contentWindow as (Window & typeof globalThis) | null;
      if (frameDocument === null || frameWindow === null) {
        throw new Error("expected a same-origin frame");
      }
      const reported: string[] = [];
      mount(
        createPortal(
          <Parts
            defaultValue={{
              start: Temporal.PlainDate.from("2026-10-05"),
              end: Temporal.PlainDate.from("2026-10-09"),
            }}
            onValueChange={(next, details) => {
              reported.push(`${next.start.toString()}..${next.end.toString()} ${details.reason}`);
            }}
          />,
          frameDocument.body
        )
      );
      const day = (name: string) => {
        // DOM audit: the frame's nodes are out of the page locator's reach.
        const button = frameDocument.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
        if (button === null) {
          throw new Error(`expected the day ${name} in the frame`);
        }
        return button;
      };
      const root = () => frameDocument.querySelector("[data-slot=range-calendar]");
      await expect.poll(() => root()).not.toBeNull();
      // The premise: the frame's nodes are not this window's Elements.
      expect(day("Monday, October 12, 2026") instanceof Element).toBe(false);

      day("Monday, October 12, 2026").click();
      await expect.poll(() => root()?.hasAttribute("data-selecting")).toBe(true);
      day("Monday, October 12, 2026 selected").dispatchEvent(
        new frameWindow.KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
      await expect.poll(() => root()?.hasAttribute("data-selecting")).toBe(false);

      day("Monday, October 12, 2026").click();
      await expect.poll(() => root()?.hasAttribute("data-selecting")).toBe(true);
      frameDocument.body.dispatchEvent(new frameWindow.PointerEvent("pointerdown", { bubbles: true }));
      frameDocument.body.dispatchEvent(new frameWindow.PointerEvent("pointerup", { bubbles: true }));
      await expect.poll(() => reported).toEqual(["2026-10-12..2026-10-12 outside-press"]);
    } finally {
      frame.remove();
    }
  });
});

describe("RangeCalendar styles", () => {
  const TRANSPARENT = "rgba(0, 0, 0, 0)";

  /** A day's button and its gridcell. */
  type DayParts = { readonly button: HTMLElement; readonly cell: HTMLElement };

  /** A day's button and gridcell, by the day's whole accessible name or a pattern for it. */
  function dayParts(name: string | RegExp): DayParts {
    const exact = !(name instanceof RegExp);
    const button = page.getByRole("button", { name, exact }).element();
    const cell = button.closest("td");
    if (!(button instanceof HTMLElement) || !(cell instanceof HTMLElement)) {
      throw new Error(`expected the day ${String(name)} in a gridcell`);
    }
    return { button, cell };
  }

  it("fills the range's ends, bands its days and leaves the days outside it plain", async () => {
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
      />
    );
    await expect.element(page.getByRole("grid")).toBeVisible();
    const start = dayParts(/Monday, October 5, 2026 selected$/);
    const middle = dayParts("Wednesday, October 7, 2026 selected");
    const end = dayParts(/Friday, October 9, 2026 selected$/);
    const outside = dayParts("Monday, October 12, 2026");
    const primary = cssVarColor(start.button, "--primary");
    const onPrimary = cssVarColor(start.button, "--primary-foreground");
    const foreground = cssVarColor(outside.button, "--foreground");

    for (const cap of [start, end]) {
      expect(getComputedStyle(cap.button).backgroundColor).toBe(primary);
      expect(getComputedStyle(cap.button).color).toBe(onPrimary);
    }
    expect(getComputedStyle(middle.button).backgroundColor).toBe(TRANSPARENT);
    expect(getComputedStyle(middle.button).color).toBe(foreground);
    expect(getComputedStyle(outside.button).backgroundColor).toBe(TRANSPARENT);
    expect(getComputedStyle(outside.button).color).toBe(foreground);

    // One translucent band behind every day of the range, none outside it.
    const band = getComputedStyle(middle.cell).backgroundColor;
    expect(band).not.toBe(TRANSPARENT);
    expect(band).not.toBe(primary);
    expect(getComputedStyle(start.cell).backgroundColor).toBe(band);
    expect(getComputedStyle(end.cell).backgroundColor).toBe(band);
    expect(getComputedStyle(outside.cell).backgroundColor).toBe(TRANSPARENT);
    // The band rounds on the range's outer sides only.
    expect(getComputedStyle(start.cell).borderTopLeftRadius).not.toBe("0px");
    expect(getComputedStyle(start.cell).borderTopRightRadius).toBe("0px");
    expect(getComputedStyle(end.cell).borderTopRightRadius).not.toBe("0px");
    expect(getComputedStyle(end.cell).borderTopLeftRadius).toBe("0px");
    expect(getComputedStyle(middle.cell).borderTopLeftRadius).toBe("0px");
  });

  it("paints a range being chosen the same way, from the anchor to the hovered day", async () => {
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
      />
    );
    await userEvent.click(roleNamed("button", "Tuesday, October 13, 2026"));
    await userEvent.hover(roleNamed("button", "Thursday, October 15, 2026"));
    const anchor = dayParts("Tuesday, October 13, 2026 selected");
    const middle = dayParts("Wednesday, October 14, 2026 selected");
    const formerMiddle = dayParts("Wednesday, October 7, 2026");
    const primary = cssVarColor(anchor.button, "--primary");

    expect(getComputedStyle(anchor.button).backgroundColor).toBe(primary);
    expect(getComputedStyle(middle.button).backgroundColor).toBe(TRANSPARENT);
    expect(getComputedStyle(middle.cell).backgroundColor).not.toBe(TRANSPARENT);
    // The value's days lose their band while another range is being chosen.
    expect(getComputedStyle(formerMiddle.cell).backgroundColor).toBe(TRANSPARENT);
  });
});

describe("RangeCalendar in a shadow root", () => {
  it.each([
    ["open", "select"],
    ["open", "reset"],
    ["closed", "select"],
    ["closed", "reset"],
  ] as const)(
    "takes presses on its days in a %s shadow root as its own, and settles presses beside it (%s)",
    async (mode, commitBehavior) => {
      const host = document.createElement("div");
      document.body.append(host);
      try {
        const shadow = host.attachShadow({ mode });
        const container = document.createElement("div");
        const beside = document.createElement("p");
        beside.textContent = "Beside the calendar";
        shadow.append(container, beside);
        const reported: string[] = [];
        mount(
          createPortal(
            <Parts
              defaultValue={{
                start: Temporal.PlainDate.from("2026-10-05"),
                end: Temporal.PlainDate.from("2026-10-09"),
              }}
              commitBehavior={commitBehavior}
              onValueChange={(next, details) => {
                reported.push(`${next.start.toString()}..${next.end.toString()} ${details.reason}`);
              }}
            />,
            container
          )
        );
        // DOM audit: page locators reach no closed shadow root, so the test presses the nodes itself.
        const day = (name: string) => {
          const button = shadow.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
          if (button === null) {
            throw new Error(`expected the day ${name} in the shadow root`);
          }
          return button;
        };
        /** A pointer press as the browser sends it: pointer down and up crossing the shadow boundary, then a click. */
        const press = (target: HTMLElement) => {
          target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
          target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, composed: true }));
          target.click();
        };
        const selecting = () =>
          shadow.querySelector("[data-slot=range-calendar]")?.hasAttribute("data-selecting");
        await expect.poll(() => shadow.querySelector("[role=grid]")).not.toBeNull();

        press(day("Monday, October 12, 2026"));
        await expect.poll(selecting).toBe(true);
        press(day("Thursday, October 15, 2026"));
        await expect.poll(() => reported).toEqual(["2026-10-12..2026-10-15 day-press"]);
        expect(selecting()).toBe(false);

        press(day("Tuesday, October 20, 2026"));
        await expect.poll(selecting).toBe(true);
        press(beside);
        await expect.poll(selecting).toBe(false);
        expect(reported).toEqual(
          commitBehavior === "select"
            ? ["2026-10-12..2026-10-15 day-press", "2026-10-20..2026-10-20 outside-press"]
            : ["2026-10-12..2026-10-15 day-press"]
        );
      } finally {
        host.remove();
      }
    }
  );
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

  it("keeps taking day presses as its own after render swaps the Root's element mid-range", async () => {
    const props = {
      defaultValue: {
        start: Temporal.PlainDate.from("2026-10-05"),
        end: Temporal.PlainDate.from("2026-10-09"),
      },
    };
    const view = mount(<Harness {...props} render={<div />} />);
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    expect(roleNamed("group", "Stay").tagName).toBe("DIV");

    view.rerender(withLocale("en-US", <Harness {...props} render={<section />} />));
    await expect.element(roleNamed("group", "Stay")).toHaveAttribute("data-selecting");
    expect(roleNamed("group", "Stay").tagName).toBe("SECTION");
    await userEvent.hover(roleNamed("button", "Thursday, October 15, 2026"));
    await userEvent.click(roleNamed("button", "Thursday, October 15, 2026 selected"));

    await expect.element(committed()).toHaveTextContent("2026-10-12..2026-10-15 day-press null");
    expect(roleNamed("group", "Stay")).not.toHaveAttribute("data-selecting");
    expect(selectedDays()).toEqual(["12", "13", "14", "15"]);
  });
});

describe("RangeCalendar's Root element", () => {
  it("is one node in its parent, with the selection prompt inside it before the consumer's parts", () => {
    mount(
      <div data-testid="stack">
        <Parts
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}
        />
      </div>
    );
    const root = roleNamed("group", "Stay");
    expect([...page.getByTestId("stack").element().children]).toEqual([root]);
    // DOM audit: `space-y-*` and `divide-y` on the Root count its last child, which must stay the
    // last part the consumer passed, `RangeCalendar.Months`.
    expect(root.lastElementChild?.getAttribute("data-slot")).toBe("calendar-months");
    // DOM audit: the prompt is hidden, so no role query reaches it; its id is what the tab-stop
    // day points at.
    const tabStop = page.getByRole("button", { name: /October 5, 2026 selected$/ }).element();
    const prompt = document.getElementById(tabStop.getAttribute("aria-describedby") ?? "");
    expect(prompt?.textContent).toBe("Click to start selecting date range");
    expect(root.contains(prompt)).toBe(true);
  });
});

describe("RangeCalendar keyboard anchor on the last visible day", () => {
  it("pages the view to show the day focus moves on to", async () => {
    const pages: string[] = [];
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
        onVisibleRangeChange={(start, details) => pages.push(`${start.toString()} ${details.reason}`)}
      />
    );
    await focusDay("Saturday, October 31, 2026");
    await userEvent.keyboard("{Enter}");

    await expectFocusOnDay("Sunday, November 1, 2026 selected");
    await expect.element(page.getByRole("grid", { name: "Stay, November 2026" })).toBeVisible();
    expect(pages).toEqual(["2026-11 keyboard"]);
    expect(roleNamed("group", "Stay")).toHaveAttribute("data-selecting");
  });

  it("keeps the view, the anchor and focus on the anchor when the page is canceled", async () => {
    const pages: string[] = [];
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
        onVisibleRangeChange={(start, details) => {
          pages.push(`${start.toString()} ${details.reason}`);
          details.cancel();
        }}
      />
    );
    await focusDay("Saturday, October 31, 2026");
    await userEvent.keyboard("{Enter}");

    expect(pages).toEqual(["2026-11 keyboard"]);
    await expectFocusOnDay("Saturday, October 31, 2026 selected");
    await expect.element(page.getByRole("grid", { name: "Stay, October 2026" })).toBeVisible();
    expect(roleNamed("group", "Stay")).toHaveAttribute("data-selecting");
    // The anchor stands: the next day completes a range from it.
    await userEvent.keyboard("{ArrowLeft}{Enter}");
    await expect.element(committed()).toHaveTextContent("2026-10-30..2026-10-31 keyboard null");
  });
});

describe("RangeCalendar's opening view", () => {
  it("opens a range longer than the centred view on its first month", () => {
    mount(
      <Parts
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-12"),
          end: Temporal.PlainDate.from("2026-12-03"),
        }}
        visibleMonths={3}
      />
    );
    expect(
      page
        .getByRole("grid")
        .elements()
        .map((grid) => grid.getAttribute("aria-label"))
    ).toEqual(["Stay, October 2026", "Stay, November 2026", "Stay, December 2026"]);
  });
});

describe("RangeCalendar visibleMonths", () => {
  it("warns once while the same value stays, however often the Root renders", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      mount(
        <Harness
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}
          visibleMonths={0}
        />
      );
      await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
      await userEvent.click(roleNamed("button", "Monday, October 12, 2026 selected"));
      await expect.element(committed()).toHaveTextContent("2026-10-12..2026-10-12 day-press null");

      expect(warn.mock.calls).toEqual([
        ["RangeCalendar.Root: visibleMonths 0 is not a whole number from 1, so it shows 1."],
      ]);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("RangeCalendar virtual presses", () => {
  it("leaves an open range to the day's own click when VoiceOver's zero-size press lands outside", async () => {
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
      />
    );
    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));
    const outside = page.getByText("Outside text").element();
    const virtual = { bubbles: true, composed: true, width: 0, height: 0 };
    outside.dispatchEvent(new PointerEvent("pointerdown", virtual));
    outside.dispatchEvent(new PointerEvent("pointerup", virtual));

    expect(roleNamed("group", "Stay")).toHaveAttribute("data-selecting");
    await expect.element(committed()).toHaveTextContent("unchanged");
    // A real press outside still settles the range.
    await userEvent.click(page.getByText("Outside text"));
    await expect.element(committed()).toHaveTextContent("2026-10-12..2026-10-12 outside-press null");
  });
});

describe("RangeCalendar renders on an anchor", () => {
  it("renders only the days whose state changes when a press anchors a range", async () => {
    const renders: string[] = [];
    function Counted(): ReactElement {
      return (
        <RangeCalendar.Root
          aria-label="Stay"
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}>
          <RangeCalendar.Months>
            {(month) => (
              <RangeCalendar.Month key={month.toString()} value={month}>
                <RangeCalendar.DayGrid>
                  <RangeCalendar.DayGridBody>
                    {(week) => (
                      <RangeCalendar.DayGridRow key={week.toString()} value={week}>
                        {(day) => (
                          <RangeCalendar.DayGridCell key={day.toString()} value={day}>
                            <RangeCalendar.DayButton
                              render={(props) => {
                                renders.push(day.toString());
                                return <button {...props} />;
                              }}
                            />
                          </RangeCalendar.DayGridCell>
                        )}
                      </RangeCalendar.DayGridRow>
                    )}
                  </RangeCalendar.DayGridBody>
                </RangeCalendar.DayGrid>
              </RangeCalendar.Month>
            )}
          </RangeCalendar.Months>
        </RangeCalendar.Root>
      );
    }
    mount(<Counted />);
    await userEvent.hover(roleNamed("button", "Monday, October 12, 2026"));
    renders.length = 0;

    await userEvent.click(roleNamed("button", "Monday, October 12, 2026"));

    // October 5 to 9 leave the value's band, and October 12 becomes the anchor and the tab stop,
    // which it takes from October 5.
    await expect.element(roleNamed("group", "Stay")).toHaveAttribute("data-selecting");
    expect([...new Set(renders)].toSorted()).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-12",
    ]);
  });
});

describe("RangeCalendar in forced colors", () => {
  afterEach(async () => {
    await emulateForcedColors("none");
  });

  it("fills the range's ends with the system's Highlight, not the theme's primary", async () => {
    await emulateForcedColors("active");
    mount(
      <Harness
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
      />
    );
    await expect.element(page.getByRole("grid")).toBeVisible();
    for (const name of [/Monday, October 5, 2026 selected$/, /Friday, October 9, 2026 selected$/]) {
      const button = page.getByRole("button", { name }).element();
      if (!(button instanceof HTMLElement)) {
        throw new Error(`expected the day ${String(name)}`);
      }
      const highlight = systemColor(button, "Highlight");
      // The premise: the system's Highlight is not the theme's primary.
      expect(highlight).not.toBe(cssVarColor(button, "--primary"));
      expect(getComputedStyle(button).backgroundColor).toBe(highlight);
      expect(getComputedStyle(button).color).toBe(systemColor(button, "HighlightText"));
    }
  });
});

describe("date props past the types", () => {
  it("throws a TypeError naming the Root, the prop and the string for ISO text", () => {
    expectRenderTypeError(
      'RangeCalendar.Root defaultValue.end: received the string "2026-10-09"',
      <RangeCalendar.Root
        aria-label="Stay"
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          // @ts-expect-error -- text reaches the prop past the types: from plain JavaScript, or as the ISO text a server component's Temporal object crosses as
          end: "2026-10-09",
        }}
      />
    );
  });

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
