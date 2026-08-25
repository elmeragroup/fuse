import { createElement } from "react";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { TimelineList } from "./timeline-list";
import { timelineListVariants } from "./timeline-list-variants";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "timeline-list.tsx"), "utf8");
const variantsSource = readFileSync(join(here, "timeline-list-variants.ts"), "utf8");
const facade = readFileSync(join(here, "..", "..", "timeline-list.ts"), "utf8");

describe("timelineListVariants", () => {
  it("resolves root, item, dot, title, time, and description with the spec geometry", () => {
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
    // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
    expect(variantsSource).not.toContain("bg-zinc-600");
    expect(variantsSource).not.toContain("bg-on-surface");
  });
});

describe("timeline-list source contract", () => {
  it("stays a server surface that emits data-slot before the props spread", () => {
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("forwardRef");
    expect(source).not.toContain('displayName = "Card"');
    expect(source).toContain('displayName = "TimelineList.Root"');
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("timelineListVariants");
    expect(facade).not.toContain("ListItemWithTimeline");
    for (const slot of [
      "timeline-list",
      "timeline-list-item",
      "timeline-list-title",
      "timeline-list-time",
      "timeline-list-description",
    ]) {
      const marker = `data-slot="${slot}"`;
      expect(source, marker).toContain(marker);
      expect(source.indexOf(marker), marker).toBeLessThan(
        source.indexOf("{...props}", source.indexOf(marker))
      );
    }
    expect(source).toContain('data-slot="timeline-list-dot"');
    expect(source).toContain('aria-hidden="true"');
  });
});

describe("TimelineList server boundary", () => {
  it("imports and renders the entry without a use client directive", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(false);
    const html = renderToStaticMarkup(
      createElement(
        TimelineList.Root,
        null,
        createElement(
          TimelineList.Item,
          null,
          createElement(TimelineList.Title, null, "Order placed"),
          createElement(TimelineList.Time, { date: "2024-03-03T10:00:00.000Z" }, "3 March 2024"),
          createElement(TimelineList.Description, null, "Confirmed at checkout.")
        )
      )
    );
    expect(html).toContain("<ol");
    expect(html).toContain("<li");
    expect(html).toContain("Order placed");
    expect(html).toContain("Confirmed at checkout.");
  });
});

describe("TimelineList.Time", () => {
  it("normalizes a Date and an offset-bearing string to ISO", () => {
    const fromDate = renderToStaticMarkup(
      createElement(TimelineList.Time, { date: new Date("2024-06-15T12:00:00.000Z") }, "15 June")
    );
    expect(fromDate).toContain('dateTime="2024-06-15T12:00:00.000Z"');

    const fromOffset = renderToStaticMarkup(
      createElement(TimelineList.Time, { date: "2024-06-15T12:00:00+02:00" }, "noon")
    );
    expect(fromOffset).toContain('dateTime="2024-06-15T10:00:00.000Z"');
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
        { date: "2024-01-01T00:00:00.000Z", dateTime: "not-this" } as never,
        "1 January"
      )
    );
    expect(html).toContain('dateTime="2024-01-01T00:00:00.000Z"');
    expect(html).not.toContain("not-this");
  });
});
