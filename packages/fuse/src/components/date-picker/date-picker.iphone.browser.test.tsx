/**
 * Unit under test: the date pickers on an iPhone (WebKit as an iPhone 15). Oracle: React Aria's
 * picker on iOS: the segments are textboxes (VoiceOver cannot focus a spinbutton), the group and the
 * trigger keep their names, and a tapped day commits. Every scenario first sets the platform a real
 * iPhone's Safari reports, as DateField's iPhone tests do.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commands, page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { PickersWithOpenLog } from "../../../test/picker-open-log";
import "../../../test/pointer-press";
import { waitForPopupSettled } from "../../../test/popup-settled";
import { expectStableBoxes } from "../../../test/stable-boxes";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import "../../temporal-polyfill";
import { DateRangePickerField } from "../date-range-picker";
import { DatePickerField } from "./index";

/**
 * The timeout of the tests here that open a popup. Every rendered frame of an open popup repaints
 * its blurred `shadow-md` and `ring-1` edge, which GPU-less WebKit paints in software at three
 * device pixels: "commits a tapped day" takes 3.6 s in Linux WebKit 26.6 limited to one
 * CPU, but timed out at the default 15 s on CI, whose one job runs every browser project at once.
 * Remove it when #541 makes the overlay edge cheap to paint.
 */
const POPUP_PAINT_TIMEOUT = 45_000;

beforeAll(() => {
  Object.defineProperty(navigator, "platform", { value: "iPhone", configurable: true });
});

afterAll(() => {
  // Drops the own property, so the prototype's getter answers again.
  Reflect.deleteProperty(navigator, "platform");
});

function Single(): ReactElement {
  const [value, setValue] = useState("unchanged");
  return withLocale(
    "en-US",
    <>
      <DatePickerField
        label="Start date"
        defaultValue={Temporal.PlainDate.from("2026-10-05")}
        onChange={(next) => setValue(String(next))}
      />
      <output aria-label="Committed value">{value}</output>
    </>
  );
}

describe("DatePicker on an iPhone", () => {
  it("names its textboxes, group and trigger", () => {
    renderThemed(<Single />);
    expect(page.getByRole("spinbutton").elements()).toHaveLength(0);
    for (const unit of ["month", "day", "year"]) {
      expect(roleNamed("textbox", `${unit}, Start date`)).toHaveAttribute("inputmode", "numeric");
    }
    expect(roleNamed("group", "Start date")).toHaveAttribute("data-slot", "field-group");
    expect(roleNamed("button", "Calendar Start date")).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("commits a tapped day", { timeout: POPUP_PAINT_TIMEOUT }, async ({ signal }) => {
    renderThemed(<Single />);
    // Taps throughout, an iPhone's input; stillness has its own test below.
    const trigger = roleNamed("button", "Calendar Start date").getBoundingClientRect();
    await commands.tap(trigger.left + trigger.width / 2, trigger.top + trigger.height / 2);
    const popup = await waitForPopupSettled({ signal });
    const day = roleNamed("button", "Monday, October 12, 2026");
    // Where the day rests: five frames, the least that shows a box at rest.
    const { day: box } = await expectStableBoxes({ popup, day }, { frames: 5, signal });
    if (box === undefined) throw new Error("expected the day's box");
    // A test that timed out must not tap into the next test's page, as a leftover tap at 0,0 once
    // closed the next test's popup.
    signal.throwIfAborted();
    expect(popup).toHaveAttribute("data-open");
    await commands.tap(box.left + box.width / 2, box.top + box.height / 2);
    await expect
      .element(page.getByRole("status", { name: "Committed value" }))
      .toHaveTextContent("2026-10-12");
  });

  it(
    "keeps the open popup and its days still: no repositioning, scrolling or zoom",
    { timeout: POPUP_PAINT_TIMEOUT },
    async ({ signal }) => {
      renderThemed(<Single />);
      const trigger = roleNamed("button", "Calendar Start date");
      await userEvent.click(trigger);
      const popup = await waitForPopupSettled({ signal });
      await expectStableBoxes(
        {
          popup,
          trigger,
          selected: roleNamed("button", "Monday, October 5, 2026 selected"),
          last: roleNamed("button", "Saturday, October 31, 2026"),
        },
        // Ten frames show any positioning loop; each frame repaints the popup's shadow, which CI's
        // GPU-less WebKit paints in software at three device pixels.
        { frames: 10, signal }
      );
    }
  );

  it.for([
    ["Start date", "Calendar Start date"],
    ["Stay", "Calendar Stay"],
  ] as const)(
    "stays open after a tap on %s's trigger, with one open change",
    { timeout: POPUP_PAINT_TIMEOUT },
    async ([label, trigger], { signal }) => {
      renderThemed(<PickersWithOpenLog />);
      const button = roleNamed("button", trigger);
      const box = button.getBoundingClientRect();
      await commands.tap(box.left + box.width / 2, box.top + box.height / 2);
      const popup = await waitForPopupSettled({ signal });
      await expectStableBoxes({ popup }, { frames: 5, signal });
      expect(popup).toHaveAttribute("data-open");
      await expect
        .element(page.getByRole("log", { name: `${label} opens` }))
        .toHaveTextContent("true:trigger-press");
      expect(roleNamed("log", `${label} opens`).textContent).toBe("true:trigger-press");
    }
  );

  it("names both range inputs' textboxes by their end and the label", () => {
    renderThemed(
      withLocale(
        "en-US",
        <DateRangePickerField
          label="Stay"
          defaultValue={{
            start: Temporal.PlainDate.from("2026-10-05"),
            end: Temporal.PlainDate.from("2026-10-09"),
          }}
        />
      )
    );
    for (const row of ["Start Date", "End Date"]) {
      for (const unit of ["month", "day", "year"]) {
        expect(roleNamed("textbox", `${unit}, ${row}, Stay`)).toHaveAttribute("enterkeyhint", "next");
      }
    }
  });
});
