/**
 * Unit under test: the stylesheet order of `previewDocument`, and the host classes
 * `compileHostUtilities` compiles onto it. Oracle: the CSS cascade. Two rules of one layer with
 * equal specificity resolve by order of appearance, and layers rank in the order their first
 * declaration names them. Fuse's base rule, which gives every border the `border` role, must come
 * after preflight's `border: 0 solid` in the `base` layer, as in a Tailwind-source host, or the
 * outline Badge draws its border in the text color. The page must name the layers first, in the
 * order the built `styles.css` declares them, so loading preflight first does not reorder the
 * layers. A standalone-CSS host compiles its own classes in its own build, into the `utilities`
 * layer after Fuse's stylesheets. `data-horizontal:` is `fuse.css`'s
 * `:where([data-orientation="horizontal"])`, and `w-64` is 64 steps of the `--spacing: 0.25rem`
 * that `fuse.css` declares in its `@theme inline` block, which Tailwind writes out in place.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { compileHostUtilities } from "../components/utility-css";
import { ASSET_PATHS, PAGE_LAYOUT, previewDocument } from "./preview-page";

/** The layers the built `styles.css` names, in the order its `@layer` statements first name them. */
function declaredLayers(): readonly string[] {
  const css = readFileSync(new URL("../../../fuse/dist/styles.css", import.meta.url), "utf8");
  const statements = [...css.matchAll(/@layer ([\w-]+(?:\s*,\s*[\w-]+)*)\s*;/g)];
  return [...new Set(statements.flatMap(([, names = ""]) => names.split(",").map((name) => name.trim())))];
}

/** The `<style>` block's lines, trimmed and without blanks. */
function styleLines(hostCss = ""): readonly string[] {
  const stamps = {
    root: { "data-theme": "light", "data-density": "dense" },
    body: { "data-theme-variant": "internal", "data-theme-brand": "fkas", "data-theme-segment": "private" },
  };
  const html = previewDocument(stamps, [], PAGE_LAYOUT, hostCss);
  const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
  return style
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

describe("the preview page's stylesheets", () => {
  it("names the layers in the order styles.css declares them, before any import", () => {
    const layers = declaredLayers();
    expect(layers).toContain("base");
    expect(styleLines()[0]).toBe(`@layer ${layers.join(", ")};`);
  });

  it("loads preflight into the base layer before Fuse's styles.css, so Fuse's base rule wins", () => {
    const lines = styleLines();
    const preflight = lines.indexOf(`@import url("${ASSET_PATHS.preflight}") layer(base);`);
    const styles = lines.indexOf(`@import url("${ASSET_PATHS.styles}");`);
    expect(preflight).toBeGreaterThan(-1);
    expect(styles).toBeGreaterThan(preflight);
  });

  it("puts the host's own classes in the utilities layer after Fuse's styles.css and themes.css", async () => {
    const lines = styleLines(await compileHostUtilities(["data-horizontal:w-64"]));
    const themes = lines.indexOf(`@import url("${ASSET_PATHS.themes}");`);
    const host = lines.indexOf("@layer utilities {");
    expect(themes).toBeGreaterThan(lines.indexOf(`@import url("${ASSET_PATHS.styles}");`));
    expect(host).toBeGreaterThan(themes);
    expect(lines.slice(host, host + 3)).toEqual([
      "@layer utilities {",
      String.raw`.data-horizontal\:w-64:where([data-orientation="horizontal"]){width:calc(0.25rem * 64);}`,
      "}",
    ]);
  });
});
