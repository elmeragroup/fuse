/**
 * Unit under test: the Calendar day component set as the build produces it. Oracle: the Fuse
 * variable or literal each Figma field of a cell must carry, read by hand from `cellVariants` in
 * `styles/calendar.ts`, the state focus ring in `styles/utils.ts` and the classes Tailwind compiles
 * them to, from the render props React Aria's `CalendarCell` hands `Calendar`'s `className`
 * function, and from the docs Basic demo, whose selected day is July 14. The cell is a 36px circle,
 * `size-9 rounded-full`, centering its day number in the 14/20px `text-sm` type at the page's
 * Regular weight. React Aria never selects a disabled date and selects an invalid one, and it marks
 * no day cell `aria-pressed`, so `aria-pressed:bg-accent` paints in no cell.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  CENTERED_BOX,
  fixedSize,
  FOCUS_RING,
  HUGGING_LABEL,
  literal,
  paint,
  token,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";
import type { ComponentRootSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

function day(selected: string, state: string): ComponentRootSpec {
  return variantRoot(spec, `calendar-day/selected=${selected},state=${state}`);
}

const STATES = ["rest", "hover", "focus", "disabled", "invalid"];

/** The day number in the 14/20px `text-sm` type, at the page's Regular weight. */
const number = (color: string) =>
  ({
    kind: "text",
    key: "label",
    name: "label",
    characters: "14",
    textProperty: "Day",
    fontFamily: token("font-sans"),
    fontStyle: "Regular",
    fontSize: literal(14),
    lineHeight: literal(20),
    color: paint(color),
    ...HUGGING_LABEL,
  }) as const;

/** The 36px circle around its number, with no fill or ring. */
const circle = (color: string) => ({
  name: "calendar-cell",
  ...CENTERED_BOX,
  sizing: fixedSize(literal(36), literal(36)),
  clips: true,
  cornerRadius: literal(18),
  children: [number(color)],
});

describe("the Calendar day component set", () => {
  it("holds selected off and on in 5 states on the Calendar page, with columns by state and the demo's day", () => {
    const days = spec.componentSets.find((candidate) => candidate.key === "calendar-day");
    expect([days?.name, days?.page]).toEqual(["Calendar day", "page/calendar"]);
    expect(days?.axes).toEqual([
      { name: "selected", values: ["off", "on"] },
      { name: "state", values: STATES },
    ]);
    expect(days?.columnAxis).toBe("state");
    expect(new Set(days?.variants.map((cell) => cell.key)).size).toBe(10);
    expect(days?.textProperties).toEqual([{ name: "Day", defaultValue: "14" }]);
    expect(days?.swapProperties).toEqual([]);
  });

  it("draws a day at rest as the 36px circle around its number in foreground, with no fill", () => {
    expect(day("off", "rest")).toEqual(circle("foreground"));
  });

  it("fills a day with muted on hover and rings it with the 2px ring on focus", () => {
    expect(day("off", "hover")).toEqual({ ...circle("foreground"), fill: paint("muted") });
    expect(day("off", "focus")).toEqual({ ...circle("foreground"), shadows: [FOCUS_RING] });
  });

  it("fills a selected day with primary behind a primary-foreground number, unchanged on hover", () => {
    const selected = { ...circle("primary-foreground"), fill: paint("primary") };
    expect(day("on", "rest")).toEqual(selected);
    expect(day("on", "hover")).toEqual(selected);
    expect(day("on", "focus")).toEqual({ ...selected, shadows: [FOCUS_RING] });
  });

  it("fills an invalid day with error, selected whatever the axis says, as React Aria selects it", () => {
    const invalid = { ...circle("primary-foreground"), fill: paint("error") };
    expect(day("off", "invalid")).toEqual(invalid);
    expect(day("on", "invalid")).toEqual(invalid);
  });

  it("draws a disabled day's number in muted-foreground, unselected whatever the axis says", () => {
    expect(day("off", "disabled")).toEqual(circle("muted-foreground"));
    expect(day("on", "disabled")).toEqual(circle("muted-foreground"));
  });

  it("drops the pressed fill, a disabled day's hover fill, the forced-colors arms and the cursor, and leaves nothing unmapped", () => {
    const rows = coverage.filter((row) => row.component === "Calendar day");
    const outcomes = (className: string) =>
      new Set(
        rows.filter((row) => row.className === className).map((row) => `${row.property}: ${row.outcome}`)
      );
    expect(outcomes("aria-pressed:bg-accent")).toEqual(new Set(["background-color: dropped"]));
    // `cellVariants` gives `hover:bg-transparent` only to a disabled day, which no cell hovers.
    expect(outcomes("hover:bg-transparent")).toEqual(new Set(["background-color: dropped"]));
    expect(outcomes("forced-colors:bg-[Highlight]")).toEqual(new Set(["background-color: dropped"]));
    expect(outcomes("forced-colors:invalid:bg-[Mark]")).toEqual(new Set(["background-color: dropped"]));
    expect(outcomes("forced-colors:text-[GrayText]")).toEqual(new Set(["color: dropped"]));
    expect(outcomes("forced-color-adjust-none")).toEqual(new Set(["forced-color-adjust: dropped"]));
    expect(outcomes("cursor-default")).toEqual(new Set(["cursor: dropped"]));
    expect(rows.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });
});
