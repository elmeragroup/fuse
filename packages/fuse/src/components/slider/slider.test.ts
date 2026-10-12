import { describe, expect, it } from "vitest";

import { dataStateFaceClass } from "../../styles/state-face";
import { withinFocusRingClass } from "../../styles/utils";
import { sliderVariants } from "./slider-variants";

function classes(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

describe("sliderVariants", () => {
  it("sizes each orientation's geometry, horizontal by default", () => {
    const horizontal = ["h-(--control-h-md)", "w-full"];
    expect(classes(sliderVariants().control())).toEqual(expect.arrayContaining(horizontal));
    expect(classes(sliderVariants().track())).toEqual(expect.arrayContaining(["h-1", "w-full"]));
    expect(classes(sliderVariants({ orientation: "horizontal" }).control())).toEqual(
      expect.arrayContaining(horizontal)
    );
    const vertical = sliderVariants({ orientation: "vertical" });
    expect(classes(vertical.frame())).toContain("h-full");
    expect(classes(vertical.root())).toEqual(expect.arrayContaining(["min-h-0", "grow"]));
    expect(classes(vertical.control())).toEqual(expect.arrayContaining(["w-(--control-h-md)", "grow"]));
    expect(classes(vertical.track())).toEqual(expect.arrayContaining(["h-full", "w-1"]));
  });

  it("paints the track, indicator and thumb with role tokens", () => {
    const slots = sliderVariants();
    expect(classes(slots.track())).toContain("bg-input");
    expect(classes(slots.indicator())).toContain("bg-primary");
    expect(classes(slots.thumb())).toEqual(expect.arrayContaining(["bg-background", "border-primary"]));
  });

  // Cross-check: the thumb forwards the shared data-target state face and within-target focus
  // ring, so a change to either owner reaches the slider. The face's disabled dim is the one
  // part it replaces, since the thumb is drawn over the track and indicator.
  it("forwards the shared state face, minus its disabled dim, and focus ring onto the thumb", () => {
    const thumb = classes(sliderVariants().thumb());
    const isDisabledDim = (token: string) => /^(?:data|aria)-disabled:opacity-/u.test(token);
    expect(thumb).toEqual(
      expect.arrayContaining(classes(dataStateFaceClass).filter((token) => !isDisabledDim(token)))
    );
    expect(thumb.filter(isDisabledDim).toSorted()).toEqual([
      "aria-disabled:opacity-100",
      "data-disabled:opacity-100",
    ]);
    expect(thumb).toEqual(expect.arrayContaining(classes(withinFocusRingClass)));
  });
});
