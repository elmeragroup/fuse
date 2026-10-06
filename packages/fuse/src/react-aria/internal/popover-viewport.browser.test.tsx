import { CalendarDate } from "@internationalized/date";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

// The consumer styles give the dialog `max-h-[inherit]` and its own scroll, the clamp that
// hid the calendar's natural height from the side measurement.
import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { render } from "../../../test/browser-render";
import { fkasPrivate as theme } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { DatePicker } from "../date-picker/date-picker";
import { UiProviders } from "../ui-providers/ui-providers";

async function animationFrames(count: number): Promise<void> {
  for (let frame = 0; frame < count; frame += 1) {
    await new Promise<number>((resolve) => requestAnimationFrame(resolve));
  }
}

/** A border-box ThemeScope exactly as tall as the viewport, clipping, with the field 500px down. */
function ViewportScope() {
  return (
    <ThemeScope
      theme={theme}
      style={{
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        height: "100vh",
        paddingTop: 500,
      }}>
      <UiProviders locale="en-US" navigate={() => undefined}>
        <DatePicker label="Date" defaultValue={new CalendarDate(2026, 7, 14)} />
      </UiProviders>
    </ThemeScope>
  );
}

describe("react-aria popover in a viewport-sized clipping scope", () => {
  // React Aria and Fuse both answer the resize, and which of them runs first varies from one
  // mount to the next. When React Aria runs first it limits the popover's height to the little
  // room below the field before Fuse measures, so each round mounts the picker afresh.
  it("moves the open calendar to the side with room as the viewport shrinks and grows", async () => {
    for (let round = 0; round < 5; round += 1) {
      await page.viewport(800, 1000);
      const { unmount } = render(<ViewportScope />);
      await userEvent.click(page.getByRole("button", { name: /^calendar/i }));
      const dialog = page.getByRole("dialog");
      await expect.element(dialog).toBeVisible();
      const calendar = dialog.element();
      const field = page.getByRole("group", { name: "Date" }).element();
      await vi.waitFor(() => {
        expect(calendar.closest("[data-placement]")?.getAnimations() ?? []).toHaveLength(0);
      });
      expect(calendar.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        field.getBoundingClientRect().bottom
      );

      // The field sits about 520px down; 700px leaves under 180px below it, too little for the
      // calendar, and about 500px above it, enough.
      await page.viewport(800, 700);

      // Oracle: the viewport's bottom edge, which the border-box scope now shares, and the
      // calendar's last week (July 26 to August 1, 2026), which must show without scrolling.
      const lastWeekDay = page.getByRole("button", { name: /July 31, 2026/ }).element();
      const expectWholeAboveField = (height: number) => {
        const box = calendar.getBoundingClientRect();
        const scope = calendar.closest("[data-theme-brand]")?.getBoundingClientRect();
        const viewportBottom = document.documentElement.clientHeight;
        expect(viewportBottom).toBe(height);
        expect(scope?.bottom).toBe(viewportBottom);
        expect(box.bottom).toBeLessThanOrEqual(field.getBoundingClientRect().top);
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.bottom).toBeLessThanOrEqual(viewportBottom);
        expect(calendar.scrollHeight).toBeLessThanOrEqual(calendar.clientHeight);
        expect(lastWeekDay.getBoundingClientRect().bottom).toBeLessThanOrEqual(box.bottom);
      };
      await vi.waitFor(() => expectWholeAboveField(700));
      // The resize observers measure again on later frames; the calendar must stay whole.
      await animationFrames(10);
      expectWholeAboveField(700);

      // 950px leaves about 390px below the field, room for the whole calendar, so the open
      // calendar returns below it, where the picker opens at that size.
      await page.viewport(800, 950);
      const expectWholeBelowField = () => {
        const box = calendar.getBoundingClientRect();
        expect(document.documentElement.clientHeight).toBe(950);
        expect(box.top).toBeGreaterThanOrEqual(field.getBoundingClientRect().bottom);
        expect(box.bottom).toBeLessThanOrEqual(950);
        expect(calendar.scrollHeight).toBeLessThanOrEqual(calendar.clientHeight);
        expect(lastWeekDay.getBoundingClientRect().bottom).toBeLessThanOrEqual(box.bottom);
      };
      await vi.waitFor(expectWholeBelowField);
      await animationFrames(10);
      expectWholeBelowField();

      // 910px leaves 350px below the field: room for the calendar's 338px and the 8px offset,
      // but not for React Aria's 12px gutter, which would clamp the calendar to 329px there.
      await page.viewport(800, 910);
      await vi.waitFor(() => expectWholeAboveField(910));
      await animationFrames(10);
      expectWholeAboveField(910);
      unmount();
    }
  });
});
