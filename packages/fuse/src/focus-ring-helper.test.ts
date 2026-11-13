import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = dirname(fileURLToPath(import.meta.url));

const componentsRoot = join(sourceRoot, "components");

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...walk(path));
      continue;
    }
    if (path.endsWith(".test.ts") || path.endsWith(".test.tsx") || path.endsWith(".browser.test.tsx")) {
      files.push(path);
    }
  }
  return files;
}

describe("assert-focus-ring helper", () => {
  it("is the only component-test reference to --tw-ring-shadow", () => {
    const hits = walk(componentsRoot).filter((file) =>
      readFileSync(file, "utf8").includes("--tw-ring-shadow")
    );
    expect(hits).toEqual([]);
  });
});
