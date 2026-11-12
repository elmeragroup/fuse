import { describe, expect, it } from "vitest";

import { demoComponents, liveCodeDemoFiles, renderStage } from "../scripts/lib/live-code-render.ts";
import { LiveCodeStore } from "../src/lib/live-code/store";

describe("Live code transparency", () => {
  // Unit under test: the Live code loader's rewrite (`lensDemoSource`), which this project applies
  // to every demo module as the docs build does. Oracle: the same demo module unrewritten, which
  // the `?original` import keeps. With no edits, Live code must change nothing a demo renders.
  it("renders every lensed demo exactly as the original renders it", async () => {
    const differences: string[] = [];
    // React logs a server render error it recovers from; a difference shows in the HTML instead.
    const consoleError = console.error;
    console.error = () => undefined;
    try {
      for (const file of liveCodeDemoFiles()) {
        const lensed = await demoComponents(file.path);
        const original = await demoComponents(`${file.path}?original`);
        for (const [name, Demo] of original) {
          const Lensed = lensed.get(name);
          const expected = renderStage(Demo, new LiveCodeStore());
          if (Lensed === undefined || renderStage(Lensed, new LiveCodeStore()) !== expected) {
            differences.push(`${file.name} ${name}`);
          }
        }
      }
    } finally {
      console.error = consoleError;
    }
    expect(differences).toEqual([]);
    // A hang guard, not a budget: the test renders every component demo twice, about 1,150 server
    // renders, and a loaded machine stretches that past the unit project's 30 s default.
  }, 180_000);
});
