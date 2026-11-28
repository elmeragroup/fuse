import * as Schema from "effect/Schema";
import { parse, printParseErrorCode } from "jsonc-parser";
import type { ParseError } from "jsonc-parser";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import picomatch from "picomatch";
import { describe, expect, it } from "vitest";

import { docsRoot } from "../scripts/lib/paths.ts";

/** The part of `apps/docs/turbo.json` this test reads: the generate task's outputs. */
const TurboConfig = Schema.Struct({
  tasks: Schema.Struct({ generate: Schema.Struct({ outputs: Schema.Array(Schema.String) }) }),
});

/** The `outputs` globs `apps/docs/turbo.json` declares for the generate task. */
function generateOutputs(): readonly string[] {
  const errors: ParseError[] = [];
  const config: unknown = parse(readFileSync(join(docsRoot, "turbo.json"), "utf8"), errors);
  expect(errors.map((error) => printParseErrorCode(error.error))).toEqual([]);
  return Schema.decodeUnknownSync(TurboConfig)(config).tasks.generate.outputs;
}

/** Whether turbo restores this docs-relative path on a cache hit: a glob matches it and no `!` glob excludes it. */
function restored(outputs: readonly string[], file: string): boolean {
  const matches = (glob: string) => picomatch(glob, { dot: true })(file);
  const excluded = outputs.filter((glob) => glob.startsWith("!")).map((glob) => glob.slice(1));
  return outputs.some((glob) => !glob.startsWith("!") && matches(glob)) && !excluded.some(matches);
}

describe("docs#generate turbo outputs", () => {
  it("covers every kind of file generation writes, so a cache hit restores the generated tree", () => {
    // Unit under test: the generate task's declared outputs. Oracle: one hand-listed file for each
    // kind of file scripts/generate.ts writes.
    const outputs = generateOutputs();
    const written = [
      "src/generated/catalog.json",
      "src/generated/component-pages.ts",
      "src/app/(docs)/components/button/api.json",
      "src/app/(docs)/components/chart/sparkline.api.json",
      "public/components/button.md",
      "public/quick-start.md",
      "public/handbook/theming.md",
      "public/llms.txt",
    ];

    expect(written.filter((file) => !restored(outputs, file))).toEqual([]);
  });
});
