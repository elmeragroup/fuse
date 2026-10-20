import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { TimelineList } from "./timeline-list";
import { timelineListVariants } from "./timeline-list-variants";

describe("timelineListVariants", () => {
  it("resolves root, item, dot, title, time, and description with the reviewed layout values", () => {
    const slots = timelineListVariants();
    expect(slots.root()).toContain("m-0");
    expect(slots.root()).toContain("list-none");
    expect(slots.root()).toContain("p-0");
    expect(slots.item()).toContain("relative");
    expect(slots.item()).toContain("mb-10");
    expect(slots.item()).toContain("ml-6");
    expect(slots.item()).toContain("pl-6");
    expect(slots.item()).toContain("last:mb-0");
    expect(slots.dot()).toContain("absolute");
    expect(slots.dot()).toContain("left-0");
    expect(slots.dot()).toContain("top-2");
    expect(slots.dot()).toContain("size-[8.75px]");
    expect(slots.dot()).toContain("rounded-full");
    expect(slots.time()).toContain("block");
    expect(slots.time()).toContain("text-sm");
  });

  it("draws the connector only on non-last items and uses tokens instead of raw palette", () => {
    const slots = timelineListVariants();
    expect(slots.item()).toContain("not-last:before:absolute");
    expect(slots.item()).toContain("not-last:before:top-8");
    expect(slots.item()).toContain("not-last:before:left-[4px]");
    expect(slots.item()).toContain("not-last:before:h-full");
    expect(slots.item()).toContain("not-last:before:w-px");
    expect(slots.item()).toContain("not-last:before:bg-border");
    // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
    expect(slots.item()).not.toContain("not-last:before:bg-zinc-600");
    expect(slots.dot()).toContain("bg-foreground");
    expect(slots.dot()).not.toContain("bg-on-surface");
    expect(slots.time()).toContain("text-foreground");
    const resolved = [
      slots.root(),
      slots.item(),
      slots.dot(),
      slots.title(),
      slots.time(),
      slots.description(),
    ].join(" ");
    expect(resolved).not.toContain("dark:");
    expect(resolved).not.toContain("destructive");
    expect(resolved).not.toMatch(RAW_PALETTE_RE);
  });
});

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

  it("passes a valid string through unchanged, so the machine-readable value never shifts by time zone", () => {
    vi.stubEnv("TZ", "America/New_York");
    expect(dateTimeOf("2026-10-20")).toBe("2026-10-20");
    expect(dateTimeOf("2024-06-15T12:00:00+02:00")).toBe("2024-06-15T12:00:00+02:00");
    expect(dateTimeOf("2026-10-20T10:00Z")).toBe("2026-10-20T10:00Z");
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
