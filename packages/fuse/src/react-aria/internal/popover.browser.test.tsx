import type { CSSProperties } from "react";

import { CalendarDate } from "@internationalized/date";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { render } from "../../../test/browser-render";
import { fkasPrivate as theme } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { DatePicker } from "../date-picker/date-picker";
import { UiProviders } from "../ui-providers/ui-providers";

/**
 * A positioned scope that clips its overflow, 200px down the page so its page offset
 * differs from its viewport offset. The viewport has room on both sides of the field, so
 * only the scope's edges can decide the side.
 */
function ClippedScope({ fieldAt }: { fieldAt: CSSProperties["justifyContent"] }) {
  return (
    <div style={{ paddingTop: 200 }}>
      <ThemeScope
        theme={theme}
        style={{
          position: "relative",
          overflow: "hidden",
          height: 480,
          display: "flex",
          flexDirection: "column",
          justifyContent: fieldAt,
        }}>
        <UiProviders locale="en-US" navigate={() => undefined}>
          <DatePicker label="Date" defaultValue={new CalendarDate(2026, 7, 14)} />
        </UiProviders>
      </ThemeScope>
    </div>
  );
}

async function openedCalendar(): Promise<{ calendar: DOMRect; field: DOMRect; scope: DOMRect }> {
  await userEvent.click(page.getByRole("button", { name: /^calendar/i }));
  const dialog = page.getByRole("dialog");
  await expect.element(dialog).toBeVisible();
  const calendar = dialog.element();
  // The entrance slide shifts the popover until it settles in place.
  await vi.waitFor(() => {
    expect(calendar.closest("[data-placement]")?.getAnimations() ?? []).toHaveLength(0);
  });
  const scope = calendar.closest("[data-theme-brand]");
  const field = page.getByRole("group", { name: "Date" }).element();
  if (scope === null) {
    throw new Error("expected the calendar inside the ThemeScope");
  }
  return {
    calendar: calendar.getBoundingClientRect(),
    field: field.getBoundingClientRect(),
    scope: scope.getBoundingClientRect(),
  };
}

describe("react-aria popover in a clipping scope", () => {
  beforeEach(async () => {
    await page.viewport(800, 1000);
  });

  // Oracle: the scope's own box. A calendar that crosses its edge is cut off.
  it("opens the calendar upward, fully inside the scope, when the field sits at its bottom", async () => {
    render(<ClippedScope fieldAt="flex-end" />);
    const { calendar, field, scope } = await openedCalendar();

    expect(calendar.bottom).toBeLessThanOrEqual(field.top);
    expect(calendar.top).toBeGreaterThanOrEqual(scope.top);
    expect(calendar.bottom).toBeLessThanOrEqual(scope.bottom);
  });

  it("opens the calendar downward, fully inside the scope, when the field sits at its top", async () => {
    render(<ClippedScope fieldAt="flex-start" />);
    const { calendar, field, scope } = await openedCalendar();

    expect(calendar.top).toBeGreaterThanOrEqual(field.bottom);
    expect(calendar.top).toBeGreaterThanOrEqual(scope.top);
    expect(calendar.bottom).toBeLessThanOrEqual(scope.bottom);
  });
});

describe("react-aria popover after its clipping container is removed", () => {
  beforeEach(async () => {
    await page.viewport(800, 1000);
  });

  function FieldNearTop({ container }: { container?: HTMLElement }) {
    return (
      <div style={{ paddingTop: 40 }}>
        <UiProviders locale="en-US" navigate={() => undefined}>
          <DatePicker label="Date" defaultValue={new CalendarDate(2026, 7, 14)} container={container} />
        </UiProviders>
      </div>
    );
  }

  it("lets React Aria flip the calendar downward once it portals to the body", async () => {
    // A clipping container that ends at the field's top leaves no room below the field, so
    // Fuse forces the calendar upward inside it.
    const clipping = document.createElement("div");
    clipping.style.cssText = "position: fixed; top: 0; left: 0; width: 800px; height: 40px; overflow: hidden";
    document.body.append(clipping);
    try {
      const { rerender } = render(<FieldNearTop container={clipping} />);
      await userEvent.click(page.getByRole("button", { name: /^calendar/i }));
      await expect.element(page.getByRole("dialog")).toBeInTheDocument();
      expect(clipping.contains(page.getByRole("dialog").element())).toBe(true);
      await userEvent.keyboard("{Escape}");
      await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();

      rerender(<FieldNearTop />);
      await userEvent.click(page.getByRole("button", { name: /^calendar/i }));
      const dialog = page.getByRole("dialog");
      await expect.element(dialog).toBeVisible();
      const calendar = dialog.element();
      await vi.waitFor(() => {
        expect(calendar.closest("[data-placement]")?.getAnimations() ?? []).toHaveLength(0);
      });

      // Oracle: 40px above the field cannot hold the calendar and the viewport below can, so
      // React Aria's own flip against the viewport opens it downward.
      const field = page.getByRole("group", { name: "Date" }).element().getBoundingClientRect();
      expect(clipping.contains(calendar)).toBe(false);
      expect(calendar.getBoundingClientRect().top).toBeGreaterThanOrEqual(field.bottom);
    } finally {
      clipping.remove();
    }
  });
});
