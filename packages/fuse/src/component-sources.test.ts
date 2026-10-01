import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";

import {
  componentSourceDistFile,
  componentSourceEntries,
  renderComponentSourceCss,
  walkPublishedImports,
} from "../scripts/component-sources";
import { COMPONENT_SOURCE_DIR, discoverEntries } from "../scripts/entries";
import { buttonVariants } from "./components/button/button-variants";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(packageRoot, "dist");

/**
 * The per-entry Tailwind source stylesheets, `dist/source/<entry>.css`. Each declares the
 * `@source` lines that scan exactly the published files its entry reaches, so a consumer that
 * adopts one component compiles that component's classes and no other's, and a refactor that
 * moves a class into another file cannot drop it from the consumer's build.
 */
describe("per-entry Tailwind source stylesheets", () => {
  const discovered = discoverEntries(packageRoot);
  // The build writes the stylesheets from `dist/`; this package inherits the root `test`
  // task's build dependency, so the published graph is there to read.
  const sources = componentSourceEntries(distDir, discovered.jsEntries);

  it("exist for every JS entry but the root barrel, nested like the entry's subpath", () => {
    const subpaths = discovered.jsEntries.map((entry) => entry.subpath).filter((subpath) => subpath !== ".");
    expect(subpaths).toContain("button");
    expect(subpaths).toContain("react-aria/calendar");
    expect(sources.map((entry) => entry.subpath)).toEqual(subpaths);
    for (const entry of sources) {
      expect(entry.distFile).toBe(`${COMPONENT_SOURCE_DIR}/${entry.subpath}.css`);
      expect(existsSync(join(distDir, entry.distFile)), entry.distFile).toBe(true);
      expect(readFileSync(join(distDir, entry.distFile), "utf8")).toBe(renderComponentSourceCss(entry));
    }
  });

  it("name Button's own modules and the shared style owners, and nothing of another component", () => {
    const button = sources.find((entry) => entry.subpath === "button");
    // Independent expectation: the files the Button recipe imports today. A refactor that
    // moves a class into a new file must appear here and in the generated stylesheet together.
    expect(button?.publishedFiles).toEqual([
      "button.js",
      "components/button/button-variants.js",
      "components/button/button.js",
      "hooks/use-merged-refs.js",
      "hooks/use-predicted-events.js",
      "internal/defined-props.js",
      "styles/cn.js",
      "styles/control-size-md.js",
      "styles/control-size.js",
      "styles/state-face.js",
      "styles/utils.js",
    ]);
    expect(button?.publishedFiles.some((file) => file.startsWith("components/skeleton/"))).toBe(false);
  });

  it("write each @source relative to the stylesheet's own directory", () => {
    const css = renderComponentSourceCss({
      subpath: "react-aria/calendar",
      distFile: componentSourceDistFile("react-aria/calendar"),
      publishedFiles: ["react-aria/calendar.js", "components/button/button-variants.js"],
    });
    expect(css).toContain('@source "../../react-aria/calendar.js";');
    expect(css).toContain('@source "../../components/button/button-variants.js";');
    expect(
      renderComponentSourceCss({
        subpath: "button",
        distFile: "source/button.css",
        publishedFiles: ["button.js"],
      })
    ).toContain('@source "../button.js";');
  });

  it("walk the published graph, which drops type-only imports and reads multi-line clauses", () => {
    // `components/accordion/index.js` is reached through a multi-line import clause in the
    // source, and `overlay-props` is a type-only module that tsdown strips, so neither the
    // published Popover graph nor its stylesheet names it.
    expect(walkPublishedImports(distDir, "accordion.js")).toContain("components/accordion/accordion.js");
    const popover = walkPublishedImports(distDir, "popover.js");
    expect(popover).toContain("components/popover/popover.js");
    expect(popover).not.toContain("components/overlay/overlay-props.js");
    expect(() => walkPublishedImports(distDir, "no-such-entry.js")).toThrow(/missing/u);
  });

  it("resolve, through Tailwind, to source globs rooted at the published files", async () => {
    const stylesheet = join(distDir, componentSourceDistFile("button"));
    const compiler = await compile(readFileSync(stylesheet, "utf8"), { base: dirname(stylesheet) });
    // Tailwind hands the declared sources back for its scanner, each resolved against the
    // stylesheet's directory. Every one must be a file the package publishes.
    const resolved = compiler.sources.map((source) => join(source.base, source.pattern));
    expect(resolved.length).toBeGreaterThan(0);
    for (const file of resolved) {
      expect(existsSync(file), file).toBe(true);
      expect(file.startsWith(distDir)).toBe(true);
    }
    expect(resolved).toContain(join(distDir, "components/button/button-variants.js"));
    expect(resolved).toContain(join(distDir, "styles/control-size-md.js"));
    expect(compiler.sources.every((source) => !source.negated)).toBe(true);
  });

  it("let a consumer compile Button's classes from the published files they name", () => {
    const button = sources.find((entry) => entry.subpath === "button");
    const scanned = (button?.publishedFiles ?? [])
      .map((file) => readFileSync(join(distDir, file), "utf8"))
      .join("\n");
    // Every class the Button recipe emits is spelled in a file the stylesheet scans, so a
    // Tailwind build over those files alone generates them.
    for (const token of buttonVariants({ variant: "outline", size: "lg" }).split(" ")) {
      expect(scanned, token).toContain(token);
    }
  });
});
