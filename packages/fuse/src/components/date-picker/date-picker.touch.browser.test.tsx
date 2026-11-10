/**
 * Unit under test: the date pickers under real taps on Playwright's touchscreen in Chromium. Oracle:
 * React Aria's picker on touch: a tap on the trigger opens the calendar dialog, a tapped day commits
 * and closes it, and a tap on a segment focuses that segment without opening anything.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { PickersWithOpenLog } from "../../../test/picker-open-log";
import "../../../test/pointer-press";
import { waitForPopupSettled } from "../../../test/popup-settled";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { expectStableBoxes } from "../../../test/stable-boxes";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { tapCenter } from "../../../test/touch-emulation";
import "../../temporal-polyfill";
import { DateRangePickerField } from "../date-range-picker";
import { DatePickerField } from "./index";

beforeAll(() => emulateReducedMotion("reduce"));
afterAll(() => emulateReducedMotion("no-preference"));

function committed() {
  return page.getByRole("status", { name: "Committed value" });
}

function Single(): ReactElement {
  const [value, setValue] = useState("unchanged");
  return withLocale(
    "en-US",
    <>
      <DatePickerField
        label="Start date"
        defaultValue="2026-10-05"
        onChange={(next) => setValue(String(next))}
      />
      <output aria-label="Committed value">{value}</output>
    </>
  );
}

function Range(): ReactElement {
  const [value, setValue] = useState("unchanged");
  return withLocale(
    "en-US",
    <>
      <DateRangePickerField
        label="Stay"
        defaultValue={{ start: "2026-10-05", end: "2026-10-09" }}
        onChange={(next) =>
          setValue(next === null ? "null" : `${next.start.toString()}..${next.end.toString()}`)
        }
      />
      <output aria-label="Committed value">{value}</output>
    </>
  );
}

describe("DatePicker taps", () => {
  it("opens on a tapped trigger and commits a tapped day", async () => {
    renderThemed(<Single />);
    await tapCenter(roleNamed("button", "Calendar Start date"));
    await waitForPopupSettled();
    await expect
      .element(page.getByRole("dialog", { name: "Calendar Start date", exact: true }))
      .toBeVisible();

    await tapCenter(roleNamed("button", "Monday, October 12, 2026"));
    await expect.element(committed()).toHaveTextContent("2026-10-12");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });

  it("focuses a tapped segment and leaves the popup closed", async () => {
    renderThemed(<Single />);
    await tapCenter(roleNamed("spinbutton", "day, Start date"));
    await expect
      .element(page.getByRole("spinbutton", { name: "day, Start date", exact: true }))
      .toHaveFocus();
    expect(page.getByRole("dialog").query()).toBeNull();
  });
});

describe("DateRangePicker taps", () => {
  it("anchors on the first tapped day and commits the range on the second", async () => {
    renderThemed(<Range />);
    await tapCenter(roleNamed("button", "Calendar Stay"));
    await waitForPopupSettled();
    await expect.element(page.getByRole("dialog")).toBeVisible();

    await tapCenter(roleNamed("button", "Tuesday, October 20, 2026"));
    await expect.element(committed()).toHaveTextContent("unchanged");
    await tapCenter(roleNamed("button", "Thursday, October 22, 2026"));
    await expect.element(committed()).toHaveTextContent("2026-10-20..2026-10-22");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Pickers opened by a tap", () => {
  it.for([
    ["Start date", "Calendar Start date"],
    ["Stay", "Calendar Stay"],
  ] as const)(
    "stays open after a tap on %s's trigger, with one open change",
    async ([label, trigger], { signal }) => {
      renderThemed(<PickersWithOpenLog />);
      await tapCenter(roleNamed("button", trigger));
      const popup = await waitForPopupSettled({ signal });
      await expectStableBoxes({ popup }, { frames: 5, signal });
      expect(popup).toHaveAttribute("data-open");
      await expect
        .element(page.getByRole("log", { name: `${label} opens` }))
        .toHaveTextContent("true:trigger-press");
      expect(roleNamed("log", `${label} opens`).textContent).toBe("true:trigger-press");
    }
  );
});
