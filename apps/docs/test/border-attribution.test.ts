import { describe, expect, it } from "vitest";

import { blocksSentinel, currentColorReport, currentColorSides, drawnSides } from "./border-attribution";
import type { BorderReading, SideReading } from "./border-attribution";

/** A side with no border, as Chromium computes it: zero width, style `none`, colour `currentColor`. */
const NONE: SideReading = {
  width: "0px",
  style: "none",
  color: "rgb(0, 0, 0)",
  sentinelColor: "rgb(1, 2, 3)",
};
/** A 1px solid side in a role colour, which the sentinel `color` leaves alone. */
const ROLE: SideReading = {
  width: "1px",
  style: "solid",
  color: "oklch(0.9 0.01 250)",
  sentinelColor: "oklch(0.9 0.01 250)",
};
/** A 1px solid side that follows the sentinel `color`. */
const CURRENT: SideReading = {
  width: "1px",
  style: "solid",
  color: "rgb(0, 0, 0)",
  sentinelColor: "rgb(1, 2, 3)",
};

function reading(
  sides: Partial<BorderReading["sides"]>,
  pseudo: BorderReading["pseudo"] = ""
): BorderReading {
  return {
    slot: "card",
    tag: "div",
    pseudo,
    sentinelColor: "rgb(1, 2, 3)",
    sides: { top: NONE, right: NONE, bottom: NONE, left: NONE, ...sides },
  };
}

describe("border attribution", () => {
  it("counts a side as drawn only with a width above zero and a painting style", () => {
    const sides = reading({
      top: { ...CURRENT, width: "0.5px" },
      right: { ...CURRENT, style: "hidden" },
      bottom: { ...CURRENT, style: "none" },
      left: { ...CURRENT, width: "0px", style: "solid" },
    });
    expect(drawnSides(sides)).toEqual(["top"]);
  });

  it("flags a drawn side that follows the sentinel and passes one in a role colour", () => {
    expect(currentColorSides(reading({ top: ROLE, bottom: CURRENT }))).toEqual(["bottom"]);
  });

  it("flags a currentColor mix, whose colour changes without equalling the sentinel", () => {
    const mixed = { ...CURRENT, color: "rgba(0, 0, 0, 0.5)", sentinelColor: "rgba(1, 2, 3, 0.5)" };
    expect(currentColorSides(reading({ left: mixed }))).toEqual(["left"]);
  });

  it("ignores an undrawn side even though its colour follows the sentinel", () => {
    expect(currentColorSides(reading({}))).toEqual([]);
  });

  it("blocks the sentinel only when a box draws a side and kept its own colour", () => {
    const kept = (sides: Partial<BorderReading["sides"]>) => ({
      ...reading(sides),
      sentinelColor: "rgb(255, 0, 0)",
    });
    expect(blocksSentinel(kept({ top: { ...CURRENT, sentinelColor: "rgb(255, 0, 0)" } }))).toBe(true);
    expect(blocksSentinel(kept({}))).toBe(false);
    expect(blocksSentinel(reading({ top: CURRENT }))).toBe(false);
  });

  it("groups claims by slot, tag, pseudo-element, side and density, with counts and pages", () => {
    const at = (page: string, density: string, sides: BorderReading, slot = "card") => ({
      ...sides,
      slot,
      page,
      density,
    });
    const report = currentColorReport([
      at("/components/card", "dense", reading({ bottom: CURRENT })),
      at("/components/sheet", "dense", reading({ bottom: CURRENT })),
      at("/components/card", "comfortable", reading({ bottom: CURRENT })),
      at("/components/table", "dense", reading({ top: CURRENT }, "::after"), "table-row"),
      at("/components/table", "dense", reading({ top: ROLE }), "table-head"),
      at("/components/kbd", "dense", reading({ top: CURRENT }), ""),
      at("/components/menu", "dense", {
        ...reading({ top: ROLE, left: CURRENT }),
        sentinelColor: "rgb(255, 0, 0)",
      }),
    ]);
    expect(report).toEqual([
      "(no slot) <div> draws its top border in currentColor at dense (1 on /components/kbd)",
      "card <div> blocks the colour sentinel at dense (1 on /components/menu)",
      "card <div> draws its bottom border in currentColor at comfortable (1 on /components/card)",
      "card <div> draws its bottom border in currentColor at dense (2 on /components/card, /components/sheet)",
      "table-row <div>::after draws its top border in currentColor at dense (1 on /components/table)",
    ]);
  });
});
