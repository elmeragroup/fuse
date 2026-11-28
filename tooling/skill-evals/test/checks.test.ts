import { describe, expect, it } from "vitest";

import { checkDocument, checkFuseImports, checkStylesheetMode, stylesheetFindings } from "../src/checks.ts";
import type { PackageExports, SourceFile } from "../src/checks.ts";

// Unit under test: the checks the runner decides from an app's files. Oracles: the attributes
// Fuse's `documentAttributes` writes (`data-theme-identity`, `data-theme-brand`,
// `data-theme-segment`, `data-density`), Node's package `exports` resolution (an exact key, or a
// pattern with one `*`, and `null` excludes), and the two CSS modes /quick-start#install names.

const FJORDKRAFT = {
  identity: "branded",
  brand: "fkas",
  segment: "private",
  density: "comfortable",
} as const;

describe("checkDocument", () => {
  it.each([
    {
      case: "the attributes on <html>, as the Vite plugin stamps them",
      html: `<!doctype html>\n<html lang="en" data-theme-identity="branded" data-theme-brand="fkas" data-theme-segment="private" data-density="comfortable">\n<head></head>`,
      passed: true,
    },
    {
      case: "single-quoted attributes in another order",
      html: `<html data-density='comfortable' data-theme-segment='private' data-theme-brand='fkas' data-theme-identity='branded'>`,
      passed: true,
    },
    {
      case: "the attributes on <body>, where a script would put them",
      html: `<html lang="en"><body data-theme-identity="branded" data-theme-brand="fkas" data-theme-segment="private" data-density="comfortable">`,
      passed: false,
    },
    {
      case: "another brand",
      html: `<html data-theme-identity="branded" data-theme-brand="tkas" data-theme-segment="private" data-density="comfortable">`,
      passed: false,
    },
    { case: "no built index.html", html: undefined, passed: false },
  ])("$case", ({ html, passed }) => {
    expect(checkDocument(html, FJORDKRAFT).passed).toBe(passed);
  });
});

/** An installed package's `exports`, shaped like Fuse's, with a pattern and an excluded pattern. */
const EXPORTS: PackageExports = new Map([
  [".", "exported"],
  ["./button", "exported"],
  ["./css", "exported"],
  ["./flags/*.svg", "exported"],
  ["./internal/*", "excluded"],
]);

describe("checkFuseImports", () => {
  it.each([
    {
      case: "the root, a subpath and a CSS @import",
      text: `import { Button } from "@elmeragroup/fuse";\nimport { Button as B } from "@elmeragroup/fuse/button";`,
      css: `@import "@elmeragroup/fuse/css";`,
      passed: true,
    },
    {
      case: "a subpath a pattern covers",
      text: `import flag from "@elmeragroup/fuse/flags/no.svg";`,
      css: "",
      passed: true,
    },
    {
      case: "a subpath the package does not export",
      text: `import { Toggle } from "@elmeragroup/fuse/toggle";`,
      css: "",
      passed: false,
    },
    {
      case: "a pattern's subpath with another extension",
      text: `import flag from "@elmeragroup/fuse/flags/no.png";`,
      css: "",
      passed: false,
    },
    {
      case: "a subpath a null pattern excludes",
      text: `export * from "@elmeragroup/fuse/internal/theme";`,
      css: "",
      passed: false,
    },
    {
      case: "a side-effect import that does not resolve",
      text: `import "@elmeragroup/fuse/styles.css";`,
      css: "",
      passed: false,
    },
    { case: "no Fuse import at all", text: `import { useState } from "react";`, css: "", passed: false },
  ])("$case", ({ text, css, passed }) => {
    const sources: SourceFile[] = [
      { path: "src/App.tsx", text },
      { path: "src/index.css", text: css },
    ];
    expect(checkFuseImports(sources, EXPORTS).passed).toBe(passed);
  });

  it("fails when the app has no Fuse installed", () => {
    expect(
      checkFuseImports([{ path: "src/App.tsx", text: `import "@elmeragroup/fuse/css";` }], undefined).passed
    ).toBe(false);
  });
});

const TAILWIND_CSS = `@import "tailwindcss";\n@import "@elmeragroup/fuse/css";\n@import "@elmeragroup/fuse/themes.css";\n@source "../node_modules/@elmeragroup/fuse";`;
const STANDALONE_TSX = `import "@elmeragroup/fuse/styles.css";\nimport "@elmeragroup/fuse/themes.css";`;

describe("checkStylesheetMode", () => {
  const reaches = (path: string) => (source: { readonly path: string }) => source.path === path;

  it.each([
    {
      case: "Tailwind source with an @source that reaches the package, in a Tailwind app",
      files: [{ path: "src/index.css", text: TAILWIND_CSS }],
      expected: "tailwind",
      passed: true,
    },
    {
      case: "an @source that misses the package",
      files: [{ path: "src/index.css", text: TAILWIND_CSS.replace("../node_modules", "./node_modules") }],
      expected: "tailwind",
      passed: false,
    },
    {
      case: "the standalone sheet in a Tailwind app",
      files: [{ path: "src/main.tsx", text: STANDALONE_TSX }],
      expected: "tailwind",
      passed: false,
    },
    {
      case: "the standalone sheet in an app without Tailwind",
      files: [{ path: "src/main.tsx", text: STANDALONE_TSX }],
      expected: "standalone",
      passed: true,
    },
    {
      case: "the Tailwind source in an app without Tailwind",
      files: [{ path: "src/index.css", text: TAILWIND_CSS }],
      expected: "standalone",
      passed: false,
    },
    {
      case: "the standalone sheet without themes.css",
      files: [{ path: "src/main.tsx", text: `import "@elmeragroup/fuse/styles.css";` }],
      expected: "standalone",
      passed: false,
    },
  ] as const)("$case", ({ files, expected, passed }) => {
    const result = checkStylesheetMode(
      stylesheetFindings(files),
      expected,
      reaches("../node_modules/@elmeragroup/fuse")
    );
    expect(result.passed).toBe(passed);
  });
});
