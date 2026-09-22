import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = dirname(fileURLToPath(import.meta.url));

/** Components plus the quarantined react-aria interim tier. */
const suiteRoots = ["components", "react-aria"].map((tier) => join(sourceRoot, tier));

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
  it("is the only component- or react-aria-test reference to --tw-ring-shadow", () => {
    const hits = suiteRoots
      .flatMap((root) => walk(root))
      .filter((file) => readFileSync(file, "utf8").includes("--tw-ring-shadow"));
    expect(hits).toEqual([]);
  });
});
