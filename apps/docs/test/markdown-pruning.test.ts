import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { pruneUnwrittenMarkdown } from "../scripts/lib/markdown-pruning.ts";

let publicDir = "";

afterEach(() => {
  rmSync(publicDir, { recursive: true, force: true });
});

/** Writes a file under the temporary public folder and returns its absolute path. */
function plant(relative: string): string {
  const target = path.join(publicDir, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, "x");
  return target;
}

describe("markdown endpoint pruning", () => {
  it("removes the markdown a run did not write and keeps what it wrote and every other file", () => {
    publicDir = mkdtempSync(path.join(tmpdir(), "docs-public-"));
    const renamed = plant("handbook/old-name.md");
    const kept = plant("handbook/theming.md");
    const asset = plant("handbook/diagram.png");
    const notes = plant("landing/notes.txt");

    pruneUnwrittenMarkdown(publicDir, new Set([kept]));

    expect({
      renamed: existsSync(renamed),
      kept: existsSync(kept),
      asset: existsSync(asset),
      notes: existsSync(notes),
    }).toEqual({ renamed: false, kept: true, asset: true, notes: true });
  });
});
