import { describe, expect, it } from "vitest";

import { checkDocument, checkFuseImports, checkSource, checkStylesheetMode } from "../src/checks.ts";
import type { Resolution, SourceFile, StylesheetEvidence } from "../src/checks.ts";
import type { SourceCheck } from "../src/task.ts";

// Unit under test: the checks the runner decides from an app's files. Oracles: the attributes
// Fuse's `documentAttributes` writes (`data-theme-identity`, `data-theme-brand`,
// `data-theme-segment`, `data-density`) and the HTML rule that a browser keeps an attribute's
// first value; the ECMAScript and CSS rules that a comment holds no import or declaration; the two
// CSS modes /quick-start#install names, with Tailwind's rule that `@source not` removes files from
// its scan; and JSX's rule that a tag names the binding in scope.

const FJORDKRAFT = {
  identity: "branded",
  brand: "fkas",
  segment: "private",
  density: "comfortable",
} as const;

const STAMPED = `data-theme-identity="branded" data-theme-brand="fkas" data-theme-segment="private" data-density="comfortable"`;

describe("checkDocument", () => {
  it.each([
    {
      case: "the attributes on <html>, as the Vite plugin stamps them",
      html: `<!doctype html>\n<html lang="en" ${STAMPED}>\n<head></head>`,
      passed: true,
    },
    {
      case: "single-quoted attributes in another order",
      html: `<html data-density='comfortable' data-theme-segment='private' data-theme-brand='fkas' data-theme-identity='branded'>`,
      passed: true,
    },
    {
      case: "the attributes on <body>, where a script would put them",
      html: `<html lang="en"><body ${STAMPED}>`,
      passed: false,
    },
    {
      case: "the attributes only on a commented-out <html>",
      html: `<!doctype html><!-- <html ${STAMPED}> --><html><head></head>`,
      passed: false,
    },
    {
      case: "a brand written twice, the browser's first value wrong",
      html: `<html data-theme-brand="tkas" ${STAMPED}>`,
      passed: false,
    },
    { case: "no built index.html", html: undefined, passed: false },
  ])("$case", ({ html, passed }) => {
    expect(checkDocument(html, FJORDKRAFT).passed).toBe(passed);
  });
});

describe("checkFuseImports", () => {
  const resolved = (file: string): Resolution => ({ _tag: "resolved", file });
  const RESOLUTIONS = new Map<string, Resolution>([
    ["@elmeragroup/fuse/button", resolved("button.js")],
    ["@elmeragroup/fuse/css", resolved("styles/fuse.css")],
    ["@elmeragroup/fuse/flags/nonexistent.svg", { _tag: "unresolved", reason: "ERR_MODULE_NOT_FOUND" }],
  ]);
  const app = (script: string, css = ""): SourceFile[] => [
    { path: "src/App.tsx", text: script },
    { path: "src/index.css", text: css },
  ];

  it.each([
    {
      case: "a script import and a CSS @import that resolve",
      sources: app(`import { Button } from "@elmeragroup/fuse/button";`, `@import "@elmeragroup/fuse/css";`),
      passed: true,
    },
    {
      case: "an import that resolves to no file",
      sources: app(`import flag from "@elmeragroup/fuse/flags/nonexistent.svg";`),
      passed: false,
    },
    {
      case: "an unresolved import only inside comments",
      sources: app(
        `import { Button } from "@elmeragroup/fuse/button";\n// import "@elmeragroup/fuse/flags/nonexistent.svg";\n/* import x from "@elmeragroup/fuse/flags/nonexistent.svg"; */`,
        `/* @import "@elmeragroup/fuse/flags/nonexistent.svg"; */`
      ),
      passed: true,
    },
    {
      case: "Fuse imports only inside comments",
      sources: app(`// import { Button } from "@elmeragroup/fuse/button";`),
      passed: false,
    },
  ])("$case", ({ sources, passed }) => {
    expect(checkFuseImports(sources, RESOLUTIONS).passed).toBe(passed);
  });
});

describe("checkStylesheetMode", () => {
  const PACKAGE_SOURCE = "../node_modules/@elmeragroup/fuse";
  const FUSE_SLOTS = new Set(["button", "field"]);
  const SHIPPED = [
    {
      href: "/assets/index.css",
      text: `[data-slot=button]{color:red}[data-slot="field"]{gap:1px}[data-theme-brand=fkas]{--x:1}`,
    },
  ];
  const PAGE = { path: "index.html", text: `<script type="module" src="/src/main.tsx"></script>` };
  const MAIN = { path: "src/main.tsx", text: `import "./index.css";\nimport App from "./App";` };
  const TAILWIND_CSS = `@import "tailwindcss/utilities.css";\n@import "@elmeragroup/fuse/css";\n@import "@elmeragroup/fuse/themes.css";\n@source "${PACKAGE_SOURCE}";`;
  const STANDALONE_MAIN = `import "@elmeragroup/fuse/styles.css";\nimport "@elmeragroup/fuse/themes.css";\nimport App from "./App";`;

  const evidence = (sources: SourceFile[], shipped = SHIPPED): StylesheetEvidence => ({
    sources,
    shipped,
    fuseSlots: FUSE_SLOTS,
    reachesPackage: (directive) => directive.path === PACKAGE_SOURCE,
  });
  const tailwindApp = (css: string, main = MAIN.text): SourceFile[] => [
    PAGE,
    { path: "src/main.tsx", text: main },
    { path: "src/index.css", text: css },
  ];
  const standaloneApp = (main: string): SourceFile[] => [PAGE, { path: "src/main.tsx", text: main }];

  it.each([
    {
      case: "a Tailwind app whose entry reaches the source with a positive @source",
      input: evidence(tailwindApp(TAILWIND_CSS)),
      expected: "tailwind",
      passed: true,
    },
    {
      case: "a Tailwind app whose @source misses the package",
      input: evidence(tailwindApp(TAILWIND_CSS.replace("../node_modules", "./node_modules"))),
      expected: "tailwind",
      passed: false,
    },
    {
      case: "a Tailwind app whose @source is negated",
      input: evidence(tailwindApp(TAILWIND_CSS.replace("@source", "@source not"))),
      expected: "tailwind",
      passed: false,
    },
    {
      case: "a Tailwind app whose @source is commented out",
      input: evidence(
        tailwindApp(
          TAILWIND_CSS.replace(`@source "${PACKAGE_SOURCE}";`, `/* @source "${PACKAGE_SOURCE}"; */`)
        )
      ),
      expected: "tailwind",
      passed: false,
    },
    {
      case: "a Tailwind app whose entry never imports the sheet",
      input: evidence(tailwindApp(TAILWIND_CSS, `import App from "./App";`)),
      expected: "tailwind",
      passed: false,
    },
    {
      case: "a standalone app whose build ships Fuse's rules",
      input: evidence(standaloneApp(STANDALONE_MAIN)),
      expected: "standalone",
      passed: true,
    },
    {
      case: "a standalone app whose imports are only in a comment",
      input: evidence(standaloneApp(`/* ${STANDALONE_MAIN} */\nimport App from "./App";`)),
      expected: "standalone",
      passed: false,
    },
    {
      case: "a standalone app that also imports the Tailwind source",
      input: evidence([
        ...standaloneApp(`${STANDALONE_MAIN}\nimport "./index.css";`),
        { path: "src/index.css", text: `@import "@elmeragroup/fuse/css";` },
      ]),
      expected: "standalone",
      passed: false,
    },
    {
      case: "a standalone app whose built page links no stylesheet",
      input: evidence(standaloneApp(STANDALONE_MAIN), []),
      expected: "standalone",
      passed: false,
    },
    {
      case: "a standalone app whose shipped CSS lacks a Fuse part's rules",
      input: evidence(standaloneApp(STANDALONE_MAIN), [
        { href: "/a.css", text: `[data-slot=button]{}[data-theme-brand=fkas]{}` },
      ]),
      expected: "standalone",
      passed: false,
    },
  ] as const)("$case", ({ input, expected, passed }) => {
    expect(checkStylesheetMode(input, expected).passed).toBe(passed);
  });

  it("fails when the installed styles.css names no part, rather than passing on an empty oracle", () => {
    const input = { ...evidence(standaloneApp(STANDALONE_MAIN)), fuseSlots: new Set<string>() };
    expect(checkStylesheetMode(input, "standalone").passed).toBe(false);
  });
});

describe("checkSource", () => {
  const VERTICAL: SourceCheck = {
    name: "vertical",
    kind: "prop",
    components: ["ToggleGroup.Root"],
    props: ["orientation"],
    value: { equals: "vertical" },
  };
  const PENDING: SourceCheck = {
    name: "pending",
    kind: "prop",
    components: "any",
    props: ["isPending", "isPerformingAction"],
    value: "not-false",
  };
  const PROVIDER: SourceCheck = { name: "provider", kind: "renders", components: ["ThemeProvider"] };
  const TOGGLE_IMPORT = `import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";\n`;
  const app = (text: string): SourceFile[] => [{ path: "src/App.tsx", text }];

  it.each([
    {
      case: "a vertical toggle group",
      check: VERTICAL,
      text: `${TOGGLE_IMPORT}<ToggleGroup.Root orientation="vertical" />`,
      passed: true,
    },
    {
      case: "spaces and single quotes in an expression",
      check: VERTICAL,
      text: `${TOGGLE_IMPORT}<ToggleGroup.Root orientation = {'vertical'} />`,
      passed: true,
    },
    {
      case: "a renamed import",
      check: VERTICAL,
      text: `import { ToggleGroup as TG } from "@elmeragroup/fuse";\n<TG.Root orientation="vertical" />`,
      passed: true,
    },
    {
      case: "a namespace import",
      check: VERTICAL,
      text: `import * as Fuse from "@elmeragroup/fuse";\n<Fuse.ToggleGroup.Root orientation="vertical" />`,
      passed: true,
    },
    {
      case: "the prop only in a comment",
      check: VERTICAL,
      text: `${TOGGLE_IMPORT}<ToggleGroup.Root>{/* orientation="vertical" */}</ToggleGroup.Root>`,
      passed: false,
    },
    {
      case: "the prop on another element",
      check: VERTICAL,
      text: `${TOGGLE_IMPORT}<ToggleGroup.Root><div orientation="vertical" /></ToggleGroup.Root>`,
      passed: false,
    },
    {
      case: "a local component of the same name",
      check: PROVIDER,
      text: `function ThemeProvider() { return null; }\nconst app = <ThemeProvider />;`,
      passed: false,
    },
    {
      case: "a Fuse ThemeProvider",
      check: PROVIDER,
      text: `import { ThemeProvider } from "@elmeragroup/fuse/theme";\nconst app = <ThemeProvider theme={theme}>x</ThemeProvider>;`,
      passed: true,
    },
    {
      case: "a pending prop bound to state",
      check: PENDING,
      text: `import { Button } from "@elmeragroup/fuse";\n<Button isPending={submitting} />`,
      passed: true,
    },
    {
      case: "a pending prop set to a literal false",
      check: PENDING,
      text: `import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";\n<AlertDialog.Content isPerformingAction={false} />`,
      passed: false,
    },
  ])("$case", ({ check, text, passed }) => {
    expect(checkSource(app(text), check).passed).toBe(passed);
  });

  it.each([
    { case: "a stylesheet that declares --border", css: `:root { --border: #ccc; }`, passed: false },
    { case: "a declaration only in a comment", css: `/* :root { --border: #ccc; } */`, passed: true },
    { case: "a use of the token, not a declaration", css: `a { color: var(--accent); }`, passed: true },
  ])("$case", ({ css, passed }) => {
    const check: SourceCheck = {
      name: "renamed",
      kind: "no-custom-property",
      properties: ["--border", "--accent"],
    };
    expect(checkSource([{ path: "src/index.css", text: css }], check).passed).toBe(passed);
  });
});
