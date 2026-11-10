/**
 * Unit under test: RangeCalendar's outside-press settling under a finger, in Chromium with touch
 * on. Every touch goes through Chromium's touch input, so a swipe scrolls the page natively and ends
 * in `pointercancel`. Oracle: React Aria's `useRangeCalendar`, which commits an open range on the
 * window's `pointerup` and never on a gesture the browser takes over as a scroll, and a printed
 * October 2026 calendar.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";
import { commands, page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { withLocale } from "../../../test/locale-matrix";
import "../../../test/pointer-press";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import "../../temporal-polyfill";
import { RangeCalendar } from "./index";

function Fixture(): ReactElement {
  const [value, setValue] = useState("unchanged");
  return (
    // Taller than the frame, so a vertical swipe has a page to scroll.
    <div style={{ height: 3000 }}>
      <RangeCalendar.Root
        aria-label="Stay"
        defaultValue={{
          start: Temporal.PlainDate.from("2026-10-05"),
          end: Temporal.PlainDate.from("2026-10-09"),
        }}
        onValueChange={(next, details) => {
          setValue(`${next.start.toString()}..${next.end.toString()} ${details.reason}`);
        }}>
        <RangeCalendar.Months />
      </RangeCalendar.Root>
      <p style={{ height: 200, margin: 0 }}>Outside text</p>
      <output aria-label="Committed value">{value}</output>
    </div>
  );
}

/** Taps the middle of an element with a finger. */
async function tap(element: Element): Promise<void> {
  const box = element.getBoundingClientRect();
  await commands.tap(box.left + box.width / 2, box.top + box.height / 2);
}

describe("RangeCalendar under a finger", () => {
  it("keeps an open range through a swipe that starts off the days, and settles it on a tap there", async () => {
    renderThemed(withLocale("en-US", <Fixture />));
    const committed = page.getByRole("status", { name: "Committed value" });
    // A page mounted a moment ago may not have reached the compositor, which hit-tests a touch.
    await nextFrames(3);
    await tap(roleNamed("button", "Monday, October 12, 2026"));
    await expect.element(roleNamed("group", "Stay")).toHaveAttribute("data-selecting");

    const outside = page.getByText("Outside text").element().getBoundingClientRect();
    await commands.touchSwipe(outside.left + 40, outside.top + 150, 0, -120, 600);

    // The premise: the swipe scrolled the page, so the browser took the touch over.
    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    expect(roleNamed("group", "Stay")).toHaveAttribute("data-selecting");
    await expect.element(committed).toHaveTextContent("unchanged");

    await tap(page.getByText("Outside text").element());
    await expect.element(committed).toHaveTextContent("2026-10-12..2026-10-12 outside-press");
    expect(roleNamed("group", "Stay")).not.toHaveAttribute("data-selecting");
  });
});
