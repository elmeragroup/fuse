import type { ReactNode } from "react";

import { CalendarDate } from "@internationalized/date";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { dayNamed, navButtonNamed, outsideMonthBands } from "../../../test/rac-calendar-testing";
import { cssVarColor, renderThemed } from "../../../test/themed-browser-render";
import { UiProviders } from "../ui-providers/ui-providers";
import { Calendar } from "./calendar";

function renderCalendar(node: ReactNode) {
  return renderThemed(
    <UiProviders locale="en-US" navigate={() => undefined}>
      {node}
    </UiProviders>
  );
}

const july14 = new CalendarDate(2026, 7, 14);

describe("Calendar", () => {
  it("hides the neighbouring months' days, which stay pickable from their own month", async () => {
    const onChange = vi.fn();
    renderCalendar(<Calendar defaultValue={july14} onChange={onChange} />);
    await expect.element(page.getByRole("grid")).toBeVisible();

    // July 2026 opens on a Wednesday, so its first week carries June 28–30.
    const outside = outsideMonthBands();
    expect(outside.map((band) => band.textContent.trim())).toEqual(
      expect.arrayContaining(["28", "29", "30"])
    );
    for (const band of outside) {
      expect(getComputedStyle(band).visibility, band.textContent).toBe("hidden");
    }
    expect(page.getByRole("button", { name: /June 30, 2026/ }).query()).toBeNull();

    await userEvent.click(navButtonNamed(/previous/i));
    await userEvent.click(dayNamed(/June 30, 2026/));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ year: 2026, month: 6, day: 30 })
    );
  });

  it("renders a ReactNode error and references it through aria-describedby when invalid", async () => {
    renderCalendar(
      <Calendar
        defaultValue={july14}
        isInvalid
        errorMessage={
          <span role="status" aria-label="Calendar error details">
            That day is closed.
          </span>
        }
      />
    );
    const error = page.getByRole("status", { name: "Calendar error details" });
    await expect.element(error).toBeVisible();
    const errorNode = error.element();
    if (!(errorNode instanceof HTMLElement)) {
      throw new Error("expected error node");
    }

    const textHost = errorNode.parentElement;
    if (!(textHost instanceof HTMLElement)) {
      throw new Error("expected the RAC Text host");
    }
    expect(textHost.getAttribute("data-slot")).toBe("text");
    expect(textHost.getAttribute("slot")).toBe("errorMessage");
    expect(textHost.textContent).toBe("That day is closed.");
    expect(getComputedStyle(textHost).color).toBe(cssVarColor(textHost, "--error"));

    // RAC wires the errorMessage slot to the invalid selected day, not to the root:
    // `useCalendarBase` hands the id to `useCalendarCell`, which is where an AT reading
    // the day hears why it cannot be used.
    const describedBy = dayNamed(/Tuesday, July 14, 2026/i).getAttribute("aria-describedby");
    expect(describedBy, "the invalid day must reference the errorMessage").toBeTruthy();
    expect(describedBy?.split(/\s+/)).toContain(textHost.id);
  });
});
