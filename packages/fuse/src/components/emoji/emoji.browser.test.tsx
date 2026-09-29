import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { px, renderThemed } from "../../../test/themed-browser-render";
import { Emoji } from "./emoji";

/** DOM audit: each face emits `data-slot="emoji"` on the svg. */
function slotSvg(): SVGElement {
  const element = document.querySelector('[data-slot="emoji"]');
  if (!(element instanceof SVGElement)) {
    throw new Error('expected an svg with data-slot="emoji"');
  }
  return element;
}

function labeledFace(name: string): SVGElement {
  const element = page.getByRole("img", { name, exact: true }).element();
  if (!(element instanceof SVGElement)) {
    throw new Error(`expected an svg named ${name}`);
  }
  return element;
}

describe("Emoji", () => {
  it("is found by role=img when label is set and drops aria-hidden", () => {
    renderThemed(<Emoji.PartyingFace label="Very satisfied" />);
    const svg = labeledFace("Very satisfied");
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("Very satisfied");
    expect(svg.getAttribute("aria-hidden")).toBeNull();
    expect(svg.getAttribute("focusable")).toBe("false");
  });

  it.each([
    ["undefined", undefined, null],
    ['"false"', "false", "false"],
  ] as const)(
    "lets a consumer aria-hidden=%s on the spread override the default",
    (_label, ariaHidden, expected) => {
      renderThemed(<Emoji.NeutralFace aria-hidden={ariaHidden} />);
      expect(slotSvg().getAttribute("aria-hidden")).toBe(expected);
    }
  );

  it("lands className on the svg", () => {
    renderThemed(<Emoji.SlightlyFrowningFace className="size-5" />);
    expect(px(getComputedStyle(slotSvg()).width)).toBe(20);
    expect(px(getComputedStyle(slotSvg()).height)).toBe(20);
  });
});
