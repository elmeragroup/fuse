import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { useFocusable as useRacFocusable } from "react-aria";
import { Focusable as RacFocusable } from "react-aria-components";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { Focusable, useFocusable } from "./focusable";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");
const srcRoot = join(packageRoot, "src");
const source = readFileSync(join(here, "focusable.tsx"), "utf8");
const facade = readFileSync(join(here, "../focusable.ts"), "utf8");

const REACT_ARIA_IMPORT = /from\s+["']react-aria["']/;
const TEST_FILE = /\.(?:browser\.test|test-d|test)\.(?:ts|tsx)$/;
const SKIP_DIRECTORIES = new Set(["icons/generated", "icons/bespoke"]);

function walkImplementationFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      const relativeDir = relative(srcRoot, path).split("\\").join("/");
      if (SKIP_DIRECTORIES.has(relativeDir)) {
        continue;
      }
      files.push(...walkImplementationFiles(path));
      continue;
    }
    if (!path.endsWith(".ts") && !path.endsWith(".tsx")) {
      continue;
    }
    if (TEST_FILE.test(path)) {
      continue;
    }
    files.push(path);
  }
  return files;
}

describe("focusable source contract", () => {
  it("is a client re-export of Focusable, useFocusable, and FocusableOptions", () => {
    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).toContain('from "react-aria-components"');
    expect(source).toMatch(REACT_ARIA_IMPORT);
    expect(source).toContain("export { Focusable, useFocusable }");
    expect(source).toContain("export type { FocusableOptions }");
    expect(source).not.toContain("export function Focusable");
    expect(source).not.toContain("export function useFocusable");
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("@elmeragroup/ui/");
    expect(source).not.toContain("tv(");
    expect(source).not.toContain("tailwind-variants");
  });

  it("documents the public exports as migration debt", () => {
    expect(source).toContain("Migration debt");
    expect(source).toContain("dies with the react-aria interim");
    expect(source).toContain("Base-ui overlay triggers accept arbitrary render targets");
  });

  it("keeps the facade a directive-free named re-export", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("export *");
    expect(facade).toContain('export { Focusable, useFocusable } from "./focusable/focusable"');
    expect(facade).toContain('export type { FocusableOptions } from "./focusable/focusable"');
  });

  // Timeout: walks src (minus generated/bespoke icons) under full-gate parallel load.
  it("is the only implementation that imports the react-aria hooks package", () => {
    const hits = walkImplementationFiles(srcRoot).filter((file) =>
      REACT_ARIA_IMPORT.test(readFileSync(file, "utf8"))
    );
    expect(hits.map((file) => relative(srcRoot, file).split("\\").join("/"))).toEqual([
      "react-aria/focusable/focusable.tsx",
    ]);
  }, 30_000);
});

describe("focusable re-export identity", () => {
  it("is the same function as react-aria-components Focusable and react-aria useFocusable", () => {
    expect(Focusable).toBe(RacFocusable);
    expect(useFocusable).toBe(useRacFocusable);
  });
});

describe("focusable package surface", () => {
  it("is a subpath-only react-aria entry whose value exports are Focusable and useFocusable", () => {
    const discovered = discoverEntries(packageRoot);
    const entry = discovered.jsEntries.find((item) => item.subpath === "react-aria/focusable");
    const root = discovered.jsEntries.find((item) => item.subpath === ".");
    expect(entry?.inRootBarrel).toBe(false);
    expect(entry?.runtimeExports).toEqual(["Focusable", "useFocusable"]);
    expect(entry?.sourceFile).toBe("src/react-aria/focusable.ts");
    expect(root?.runtimeExports).not.toContain("Focusable");
    expect(root?.runtimeExports).not.toContain("useFocusable");
    expect(discovered.jsEntries.map((item) => item.subpath)).toContain("react-aria/focusable");
    expect(discovered.jsEntries.map((item) => item.subpath)).not.toContain("focusable");
  }, 30_000);
});
