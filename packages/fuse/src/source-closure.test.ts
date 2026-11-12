import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { walkImportedSourceFiles } from "../scripts/entries";

// Unit under test: the source closure that names the build's entries and the packed directive
// check's files. Oracle: the import graph this fixture writes by hand, where each file except
// the entry is reached through exactly one form of import.
const scratchDirs: string[] = [];

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function scratchPackage(files: Record<string, string>): string {
  const packageRoot = mkdtempSync(join(tmpdir(), "fuse-closure-"));
  scratchDirs.push(packageRoot);
  for (const [relative, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(packageRoot, relative)), { recursive: true });
    writeFileSync(join(packageRoot, relative), contents);
  }
  return packageRoot;
}

describe("walkImportedSourceFiles", () => {
  it("follows every form of relative import, including ones written across lines", () => {
    const packageRoot = scratchPackage({
      "src/entry.ts": [
        `import { one } from "./one-line";`,
        `import {`,
        `  first,`,
        `  second,`,
        `} from "./multi-line";`,
        `import type {`,
        `  Shape,`,
        `} from "./multi-line-type";`,
        `export {`,
        `  reexported,`,
        `} from "./multi-line-reexport";`,
        `export * from "./star";`,
        `export {} from "./register";`,
        `import "./side-effect";`,
        `import "./entry.css";`,
        `export const lazy = () => import("./lazy");`,
        `export const escaped = () => import("./esc\\u0061ped");`,
        `export const dollar = () => import("./price$");`,
        "export const templated = () => import(`./templated`);",
        `export const computed = (name: string) => import(name);`,
        `export { one, first, second };`,
        `export type { Shape };`,
        ``,
      ].join("\n"),
      "src/one-line.ts": `export const one = 1;\n`,
      "src/multi-line.ts": `export { first, second } from "./nested/leaf";\n`,
      "src/nested/leaf.ts": `export const first = 1;\nexport const second = 2;\n`,
      "src/multi-line-type.ts": `export type Shape = { readonly side: number };\n`,
      "src/multi-line-reexport.ts": `export const reexported = 1;\n`,
      "src/star.ts": `export const star = 1;\n`,
      "src/side-effect.ts": `globalThis.toString();\n`,
      "src/entry.css": `.entry {}\n`,
      "src/lazy.tsx": `export const Lazy = () => <span />;\n`,
      "src/register.ts": `globalThis.toString();\n`,
      "src/escaped.ts": `export const escaped = 1;\n`,
      "src/price$.ts": `export const price = 1;\n`,
      "src/templated.ts": `export const templated = 1;\n`,
      "src/unreached.ts": `export const unreached = 1;\n`,
    });

    expect(walkImportedSourceFiles(packageRoot, ["src/entry.ts"])).toEqual([
      "src/entry.ts",
      "src/escaped.ts",
      "src/lazy.tsx",
      "src/multi-line-reexport.ts",
      "src/multi-line-type.ts",
      "src/multi-line.ts",
      "src/nested/leaf.ts",
      "src/one-line.ts",
      "src/price$.ts",
      "src/register.ts",
      "src/side-effect.ts",
      "src/star.ts",
      "src/templated.ts",
    ]);
  });
});
