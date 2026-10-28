import { describe, expect, it } from "vitest";

import { cn } from "./cn";
import { fieldSize } from "./field-size";

/**
 * The field-size recipe against hand-written classes: what each size writes on the box, what
 * each read binds with its md fallback, and how a consumer's utility replaces a read through
 * tailwind-merge. `field-size.browser.test.tsx` measures the rendered boxes.
 */

/** Class order carries no meaning, so a slot is compared as a set. */
function classSet(classes: string): string[] {
  return classes.split(" ").toSorted();
}

const FLOOR = "entry-floor:[--entry-text:max(16px,var(--field-text,var(--control-text)))]";
const FLOORED_TYPE = "text-[length:var(--entry-text,var(--field-text,var(--control-text)))]";
const LEADING = "leading-[var(--field-leading,var(--control-leading))]";

describe("fieldSize: the box writes", () => {
  it("resets every field variable on a default box, so a default box nested in an sm box reads md", () => {
    expect(classSet(fieldSize({ size: "default" }).box())).toEqual(
      classSet(
        "[--field-h:initial] [--field-px:initial] [--field-gap:initial] [--field-inner:initial] [--field-text:initial] [--field-leading:initial]"
      )
    );
  });

  it("writes the sm control metrics with the height floored at 26px, the floored xs inner square and the fixed text-sm type, its leading as a length, on an sm box", () => {
    expect(classSet(fieldSize({ size: "sm" }).box())).toEqual(
      classSet(
        "[--field-h:max(var(--control-h-sm),26px)] [--field-px:var(--control-px-sm)] [--field-gap:var(--control-gap-sm)] [--field-inner:max(var(--control-h-xs),24px)] [--field-text:var(--text-sm)] [--field-leading:calc(var(--text-sm)*var(--text-sm--line-height))]"
      )
    );
  });

  it("writes the default size when no size is passed", () => {
    expect(fieldSize().box()).toBe(fieldSize({ size: "default" }).box());
  });
});

describe("fieldSize: the reads", () => {
  it("falls back to the md metrics in every read", () => {
    const reads = fieldSize();
    expect(reads.height()).toBe("h-[var(--field-h,var(--control-h-md))]");
    expect(reads.minHeight()).toBe("min-h-[var(--field-h,var(--control-h-md))]");
    expect(reads.inset()).toBe("px-[var(--field-px,var(--control-px-md))]");
    expect(reads.gap()).toBe("gap-[var(--field-gap,var(--control-gap-md))]");
    expect(reads.inner()).toBe("size-[var(--field-inner,var(--control-h-sm))]");
    expect(classSet(reads.type())).toEqual(
      classSet(`text-[length:var(--field-text,var(--control-text))] ${LEADING}`)
    );
  });

  it("reads the 16px floor in the text-entry type's one font-size class at every size", () => {
    for (const size of ["default", "sm"] as const) {
      expect(classSet(fieldSize({ size }).entryType()), size).toEqual(
        classSet(`${FLOORED_TYPE} ${FLOOR} ${LEADING}`)
      );
    }
  });
});

describe("fieldSize: consumer utilities replace the reads", () => {
  const reads = fieldSize();

  it.each([
    ["h-12", reads.height()],
    ["min-h-12", reads.minHeight()],
    ["px-3", reads.inset()],
    ["gap-1", reads.gap()],
    ["size-6", reads.inner()],
  ])("lets a consumer %s replace its read", (consumer, read) => {
    expect(cn(read, consumer)).toBe(consumer);
  });

  it.each(["text-sm", "text-lg"])(
    "lets a consumer %s replace the text-entry type on every pointer",
    (consumer) => {
      // Only the inert floor variable stays: no font-size class but the consumer's reads it.
      expect(classSet(cn(reads.entryType(), consumer))).toEqual(classSet(`${FLOOR} ${consumer}`));
    }
  );

  it("keeps the floored type under a consumer leading-* class", () => {
    expect(classSet(cn(reads.entryType(), "leading-5"))).toEqual(
      classSet(`${FLOORED_TYPE} ${FLOOR} leading-5`)
    );
  });
});
