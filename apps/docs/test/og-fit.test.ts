import { parse } from "@shuding/opentype.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { docsRoot } from "../scripts/lib/paths.ts";
import { COMPONENT_PAGES } from "../src/generated/component-pages";
import { STATIC_PAGES, STUDIO_PAGES } from "../src/lib/pages";
import { ogSubtitleSize } from "../src/og/og-fit";

/**
 * An independent measurer: the Roboto 500 file the card loads, parsed by the library Satori
 * measures with, at the subtitle's -0.01em letter spacing. The cross-check below holds it to
 * Paper's widths before the other tests trust it.
 */
const roboto500 = (() => {
  const file = readFileSync(
    path.join(docsRoot, "node_modules/@fontsource/roboto/files/roboto-latin-500-normal.woff")
  );
  return parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
})();

function widthAt(text: string, size: number): number {
  return roboto500.getAdvanceWidth(text, size, { letterSpacing: -0.01 });
}

/** Widths Paper measured at 64px, Roboto 500, letter spacing -0.01em. */
const PAPER_WIDTHS_AT_64 = [
  ["Popover Info Button", 559],
  ["Phone Number Field", 571],
  ["Date Range Picker", 515],
  ["Brands & segments", 547],
  ["Description List", 438],
  ["UI Providers", 341],
] as const;

describe("OG card subtitle size", () => {
  it("keeps a short subtitle at 64px", () => {
    expect(ogSubtitleSize("Button")).toBe(64);
  });

  it("shrinks a subtitle wider than 520px at 64px to the size that fits", () => {
    expect(ogSubtitleSize("Popover Info Button")).toBe(59);
    expect(ogSubtitleSize("Phone Number Field")).toBe(58);
    expect(ogSubtitleSize("Brands & segments")).toBe(60);
  });

  it("stops at the 44px floor", () => {
    expect(ogSubtitleSize("W".repeat(19))).toBe(44);
  });

  it("measures text as Paper does", () => {
    for (const [text, paperWidth] of PAPER_WIDTHS_AT_64) {
      expect(Math.abs(widthAt(text, 64) - paperWidth) / paperWidth, text).toBeLessThanOrEqual(0.02);
    }
  });

  it("fits every real subtitle within 520px", () => {
    const subtitles = [
      "Overview",
      ...STATIC_PAGES.map((page) => page.label),
      ...STUDIO_PAGES.map((page) => page.title),
      ...COMPONENT_PAGES.map((component) => component.title),
    ];
    for (const subtitle of subtitles) {
      const size = ogSubtitleSize(subtitle);
      expect(size, subtitle).toBeGreaterThanOrEqual(44);
      expect(widthAt(subtitle, size), subtitle).toBeLessThanOrEqual(520);
    }
  });
});
