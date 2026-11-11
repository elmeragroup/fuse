import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimelineList } from "./timeline-list";

describe("TimelineList.Time", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function dateTimeOf(date: string | Date): string | undefined {
    const html = renderToStaticMarkup(createElement(TimelineList.Time, { date }, "x"));
    return /dateTime="([^"]*)"/.exec(html)?.[1];
  }

  it("normalizes a Date to its ISO instant", () => {
    expect(dateTimeOf(new Date("2024-06-15T12:00:00.000Z"))).toBe("2024-06-15T12:00:00.000Z");
  });

  it("passes an HTML date or date-time string through unchanged, so the machine-readable value never shifts by time zone", () => {
    expect(dateTimeOf("2026-10-20")).toBe("2026-10-20");
    expect(dateTimeOf("2024-06-15T12:00:00+02:00")).toBe("2024-06-15T12:00:00+02:00");
    expect(dateTimeOf("2026-10-20T10:00Z")).toBe("2026-10-20T10:00Z");
  });

  it("normalizes any other parseable string to its ISO instant", () => {
    expect(dateTimeOf("Sat, 15 Jun 2024 12:00:00 GMT")).toBe("2024-06-15T12:00:00.000Z");
    // The JavaScript parser reads an offset-less non-HTML string as local time.
    vi.stubEnv("TZ", "America/New_York");
    expect(dateTimeOf("June 15, 2024")).toBe("2024-06-15T04:00:00.000Z");
    expect(dateTimeOf("2024/06/15")).toBe("2024-06-15T04:00:00.000Z");
  });

  it("normalizes a grammar-shaped string HTML rejects, and passes a leap day through", () => {
    expect(dateTimeOf("2024-06-15T24:00Z")).toBe("2024-06-16T00:00:00.000Z");
    expect(dateTimeOf("2024-02-30")).toBe("2024-03-01T00:00:00.000Z");
    expect(dateTimeOf("2024-04-31")).toBe("2024-05-01T00:00:00.000Z");
    expect(dateTimeOf("2026-10-20T10:00z")).toBe("2026-10-20T10:00:00.000Z");
    expect(dateTimeOf("2024-02-29")).toBe("2024-02-29");
  });

  it("warns in development about a date-time string without an offset, and passes it through", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(dateTimeOf("2026-10-20T10:00")).toBe("2026-10-20T10:00");
    expect(warn.mock.calls).toEqual([
      [
        'TimelineList.Time: "2026-10-20T10:00" has no time-zone offset, so it names a different instant in each time zone. Add an offset such as "Z" or "+02:00", or pass a Date.',
      ],
    ]);

    warn.mockClear();
    dateTimeOf("2026-10-20");
    dateTimeOf("2024-06-15T12:00:00+02:00");
    expect(warn.mock.calls).toEqual([]);

    vi.stubEnv("NODE_ENV", "production");
    dateTimeOf("2026-10-20T10:00");
    expect(warn.mock.calls).toEqual([]);
  });

  it("throws an environment-independent RangeError for invalid dates", () => {
    const invalid = ["not-a-date", "", new Date(Number.NaN)] as const;
    for (const date of invalid) {
      expect(
        () => renderToStaticMarkup(createElement(TimelineList.Time, { date }, "x")),
        String(date)
      ).toThrowError(RangeError);
      expect(
        () => renderToStaticMarkup(createElement(TimelineList.Time, { date }, "x")),
        String(date)
      ).toThrowError("TimelineList.Time received an invalid date");
    }
  });

  it("applies the generated dateTime after remaining props so an untyped dateTime cannot win", () => {
    const html = renderToStaticMarkup(
      createElement(
        TimelineList.Time,
        // SAFETY: dateTime is omitted from the public type; this assertion feeds the runtime override contract.
        { date: new Date("2024-01-01T00:00:00.000Z"), dateTime: "not-this" } as never,
        "1 January"
      )
    );
    expect(html).toContain('dateTime="2024-01-01T00:00:00.000Z"');
    expect(html).not.toContain("not-this");
  });
});
