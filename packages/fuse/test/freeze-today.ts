import { onTestFinished, vi } from "vitest";

/**
 * Pins the clock on a local date-time until the test ends, so today is a day the test chooses.
 *
 * @param localDateTime - The local date-time to pin the clock on, such as `2026-09-15T12:00:00`.
 */
export function freezeToday(localDateTime: string): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(localDateTime));
  onTestFinished(() => {
    vi.useRealTimers();
  });
}
