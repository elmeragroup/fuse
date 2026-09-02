import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { BackendExtractionSession, BackendProject } from "../src/backend/contracts.ts";
import { openTsgoProject } from "../src/backend/ts7/project.ts";

const fixtureDirectory = resolve(import.meta.dirname, "fixtures");
const basicDirectory = resolve(fixtureDirectory, "basic");
const basicTsconfigPath = resolve(basicDirectory, "tsconfig.json");
const basicInputPath = resolve(basicDirectory, "input.ts");
const enumTsconfigPath = resolve(fixtureDirectory, "issue-03-tsconfig.json");
const enumInputPath = resolve(fixtureDirectory, "enum-members-values-and-docs/input.ts");

function requestCount(project: BackendProject): number {
  const timing = project.getTimingInfo?.();
  if (timing === undefined) throw new Error("Timing seam is unavailable");
  return timing.totals.requestCount;
}

function firstExport(session: BackendExtractionSession, inputPath: string) {
  const symbol = session.readModule(inputPath).exports[0]?.symbol;
  if (symbol === undefined) throw new Error(`Missing first export in ${inputPath}`);
  return symbol;
}

describe("TypeScript 7 session fact memoization", () => {
  it("re-fetches a cached fact in the next extraction and freezes shared records", () => {
    const project = openTsgoProject({ tsconfigPath: basicTsconfigPath, collectTiming: true });
    try {
      const first = project.openExtraction();
      const firstSymbol = firstExport(first, basicInputPath);
      const firstType = first.compiler.typeOfSymbol(firstSymbol, false);
      if (firstType === undefined) throw new Error("Missing type for the first extraction");

      const firstBefore = requestCount(project);
      const firstFacts = first.compiler.typeFacts(firstType);
      const firstAfterLoad = requestCount(project);
      const firstAgain = first.compiler.typeFacts(firstType);
      const firstAfterRepeat = requestCount(project);

      expect(firstAfterLoad - firstBefore).toBeGreaterThan(0);
      expect(firstAfterRepeat).toBe(firstAfterLoad);
      expect(JSON.stringify(firstAgain)).toBe(JSON.stringify(firstFacts));
      expect(Object.isFrozen(firstFacts)).toBe(true);
      expect(Object.isFrozen(firstFacts.flags)).toBe(true);
      first.close();

      const second = project.openExtraction();
      const secondSymbol = firstExport(second, basicInputPath);
      const secondType = second.compiler.typeOfSymbol(secondSymbol, false);
      if (secondType === undefined) throw new Error("Missing type for the second extraction");

      const secondBefore = requestCount(project);
      const secondFacts = second.compiler.typeFacts(secondType);
      const secondAfterLoad = requestCount(project);
      const secondAgain = second.compiler.typeFacts(secondType);
      const secondAfterRepeat = requestCount(project);

      expect(secondAfterLoad - secondBefore).toBe(firstAfterLoad - firstBefore);
      expect(secondAfterRepeat).toBe(secondAfterLoad);
      expect(JSON.stringify(secondAgain)).toBe(JSON.stringify(secondFacts));
      expect(JSON.stringify(secondFacts)).toBe(JSON.stringify(firstFacts));
      second.close();
    } finally {
      project.close();
    }
  });

  it("does not memoize the warning-producing enum read", () => {
    const project = openTsgoProject({ tsconfigPath: enumTsconfigPath, collectTiming: true });
    try {
      const session = project.openExtraction();
      const symbol = firstExport(session, enumInputPath);
      const type = session.compiler.typeOfSymbol(symbol, true);
      if (type === undefined) throw new Error("Missing enum type");

      const beforeFirst = requestCount(project);
      const first = session.compiler.enumFacts(type);
      const afterFirst = requestCount(project);
      const second = session.compiler.enumFacts(type);
      const afterSecond = requestCount(project);

      expect(first?.name).toBe("Side");
      expect(second).toEqual(first);
      expect(afterFirst - beforeFirst).toBeGreaterThan(0);
      expect(afterSecond - afterFirst).toBeGreaterThan(0);
      session.close();
    } finally {
      project.close();
    }
  });
});
