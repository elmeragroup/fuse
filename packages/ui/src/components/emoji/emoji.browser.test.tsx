import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { Emoji } from "./emoji";

const FACES = [
  ["SlightlyFrowningFace", Emoji.SlightlyFrowningFace],
  ["SlightlySmilingFace", Emoji.SlightlySmilingFace],
  ["NeutralFace", Emoji.NeutralFace],
  ["LoudlyCryingFace", Emoji.LoudlyCryingFace],
  ["PartyingFace", Emoji.PartyingFace],
] as const;

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
  it.each(FACES)("%s renders an svg with viewBox and data-slot=emoji", (_name, Face) => {
    renderThemed(<Face />);
    const svg = slotSvg();
    expect(svg.tagName).toBe("svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 36 36");
    expect(svg.getAttribute("data-slot")).toBe("emoji");
  });

  it("is decorative by default and is not found by role=img", () => {
    renderThemed(<Emoji.SlightlySmilingFace className="size-5" />);
    const svg = slotSvg();
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(svg.getAttribute("role")).toBeNull();
    expect(page.getByRole("img").query()).toBeNull();
  });

  it("is found by role=img when label is set and drops aria-hidden", () => {
    renderThemed(<Emoji.PartyingFace label="Very satisfied" />);
    const svg = labeledFace("Very satisfied");
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("Very satisfied");
    expect(svg.getAttribute("aria-hidden")).toBeNull();
    expect(svg.getAttribute("focusable")).toBe("false");
  });

  it("lets a consumer aria-hidden={undefined} on the spread override the default", () => {
    renderThemed(<Emoji.NeutralFace aria-hidden={undefined} />);
    expect(slotSvg().getAttribute("aria-hidden")).toBeNull();
  });

  it("lets a consumer aria-hidden on the spread override the default", () => {
    renderThemed(<Emoji.NeutralFace aria-hidden="false" />);
    expect(slotSvg().getAttribute("aria-hidden")).toBe("false");
  });

  it("lands className on the svg", () => {
    renderThemed(<Emoji.SlightlyFrowningFace className="size-5" />);
    expect([...slotSvg().classList]).toContain("size-5");
  });
});
