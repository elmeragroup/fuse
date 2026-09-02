import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { effectOrigin } from "../scripts/lib/api-effect-adapter.ts";
import {
  compareParts,
  docsShadowInventory,
  inputCapturesEqual,
  readShadowSnapshot,
  reviewAgainstSnapshot,
  runDocsShadowComparison,
  snapshotOf,
} from "../scripts/lib/api-shadow.ts";
import type { DocsShadowReport } from "../scripts/lib/api-shadow.ts";
import { componentSlugs } from "../scripts/lib/components.ts";
import type { ApiPart, ApiProp } from "../src/lib/docs-model.ts";

// The shadow run is validation only: every synchronous write through node:fs
// fails the run, so a writer sneaking into either side fails the suite.
const refusedWrites: string[] = [];
const writeSpies = (["writeFileSync", "appendFileSync", "rmSync", "unlinkSync"] as const).map((name) =>
  vi.spyOn(fs, name).mockImplementation(() => {
    refusedWrites.push(name);
    throw new Error(`docs shadow run must not write (${name})`);
  })
);
syncBuiltinESMExports();

afterAll(() => {
  for (const spy of writeSpies) spy.mockRestore();
  syncBuiltinESMExports();
});

let report: DocsShadowReport;

function testProp(name: string): ApiProp {
  return {
    name,
    origin: "declared",
    type: "string",
    shortType: null,
    defaultValue: null,
    description: "",
    required: false,
  };
}

function testPart(name: string, propNames: readonly string[] = []): ApiPart {
  return {
    name,
    rsc: "client",
    sourcePath: `${name}.tsx`,
    props: propNames.map(testProp),
    forwardedFrom: [],
    forwardedCount: 0,
  };
}

beforeAll(async () => {
  report = await runDocsShadowComparison();
}, 120_000);

describe("docs API shadow", () => {
  test("uses the complete route inventory and identical public entry inputs", () => {
    const inventory = docsShadowInventory();
    expect(inventory.map((entry) => entry.slug)).toEqual([...componentSlugs()]);
    expect(report.inventory).toEqual(inventory);
    expect(report.extractionInputs).toEqual(inventory.map((entry) => entry.entryFile));
    expect(report.currentInputs).toEqual(report.extractionInputs);
    expect(report.effectInputs).toEqual(report.extractionInputs);
    expect(report.currentInputHashes).toHaveLength(inventory.length);
    expect(report.effectInputHashes).toHaveLength(inventory.length);
    expect(inputCapturesEqual(report.currentInputHashes, report.effectInputHashes)).toBe(true);
    expect(
      report.currentInputHashes.every(
        (input) =>
          input.entrySha256.length === 64 &&
          input.sourceSha256.length === 64 &&
          input.entryFile.length > 0 &&
          input.sourceFile.length > 0
      )
    ).toBe(true);
    expect(
      report.inventory.every(
        (entry) => entry.exportNames.length > 0 && entry.exportNames.includes(entry.exportName)
      )
    ).toBe(true);
  });

  test("reproduces the reviewed snapshot exactly", () => {
    const snapshot = readShadowSnapshot();
    const review = reviewAgainstSnapshot(report.apiDifferences, report.problemDifferences, snapshot);
    expect(review, "run `pnpm run shadow:update` after reviewing these differences").toEqual({
      unexplained: [],
      stale: [],
    });
    expect(report.summary).toEqual(snapshot.summary);
    expect(snapshotOf(report)).toEqual(snapshot);
    expect(report.apiDifferences).toHaveLength(report.summary.apiDifferenceCount);
    expect(report.problemDifferences).toHaveLength(report.summary.problemDifferenceCount);
    expect(
      report.apiDifferences.every(
        (difference) =>
          difference.path !== "parts" && difference.path !== "evidence" && !difference.path.endsWith(".props")
      )
    ).toBe(true);
  });

  test("reports both unexplained and stale differences against a snapshot", () => {
    const snapshot = snapshotOf(report);
    const [first, ...rest] = snapshot.apiDifferences;
    if (first === undefined) throw new Error("the shadow report has no API differences to review");
    const review = reviewAgainstSnapshot(report.apiDifferences, report.problemDifferences, {
      ...snapshot,
      apiDifferences: [...rest, { ...first, path: `${first.path}.renamed` }],
    });
    expect(review.unexplained).toEqual([`api|${first.component}|${first.path}`]);
    expect(review.stale).toEqual([`api|${first.component}|${first.path}.renamed`]);
  });

  test("detects side-specific input and source-byte drift", () => {
    const first = report.currentInputHashes[0];
    if (first === undefined) throw new Error("shadow report has no input capture");
    const changedSource = report.currentInputHashes.map((input, index) =>
      index === 0 ? { ...input, sourceSha256: "0".repeat(64) } : input
    );
    expect(inputCapturesEqual(changedSource, report.effectInputHashes)).toBe(false);
    const changedEntry = report.currentInputHashes.map((input, index) =>
      index === 0 ? { ...input, entrySha256: "1".repeat(64) } : input
    );
    expect(inputCapturesEqual(changedEntry, report.effectInputHashes)).toBe(false);
    expect(compareParts("length-regression", report.components[0]?.current ?? [], [])).not.toContainEqual(
      expect.objectContaining({ path: "parts" })
    );
  });

  test("reports exact order changes for common parts and props", () => {
    const differences = compareParts(
      "ordering",
      [testPart("A", ["a", "b"]), testPart("B")],
      [testPart("B"), testPart("A", ["b", "a"])]
    );
    expect(differences).toEqual([
      { component: "ordering", path: "parts.A.order", current: 0, effect: 1 },
      { component: "ordering", path: "parts.B.order", current: 1, effect: 0 },
      { component: "ordering", path: "parts.A.props.a.order", current: 0, effect: 1 },
      { component: "ordering", path: "parts.A.props.b.order", current: 1, effect: 0 },
    ]);
    expect(differences.every(({ path }) => !["parts", "parts.A.props"].includes(path))).toBe(true);

    const missing = compareParts("missing", [testPart("A"), testPart("B")], [testPart("A")]);
    expect(missing.map(({ path }) => path)).toEqual(["parts.B"]);
  });

  test("keeps current-side origin drift visible to the shadow comparator", () => {
    const current = testPart("A", ["x"]);
    const firstProp = current.props[0];
    if (firstProp === undefined) throw new Error("test part has no prop");
    const currentOriginDrift = {
      ...current,
      props: [{ ...firstProp, origin: "recipe-axis" as const }],
    };
    expect(compareParts("origin-drift", [currentOriginDrift], [current])).toContainEqual({
      component: "origin-drift",
      path: "parts.A.props.x.origin",
      current: "recipe-axis",
      effect: "declared",
    });
    expect(effectOrigin({ path: ["A", "props", "x"], declarationPaths: [], synthesized: false })).toBe(
      "declared"
    );
    expect(effectOrigin({ path: ["A", "props", "variant"], declarationPaths: [], synthesized: true })).toBe(
      "recipe-axis"
    );
    expect(
      effectOrigin({
        path: ["A", "props", "size"],
        declarationPaths: ["packages/ui/src/components/a/a-variants.ts"],
        synthesized: false,
      })
    ).toBe("recipe-axis");
  });

  test("rejects duplicate part and prop names instead of overwriting them", () => {
    expect(() => compareParts("duplicate-parts", [testPart("A"), testPart("A")], [])).toThrow(
      'duplicate part name "A"'
    );
    expect(() => compareParts("duplicate-props", [testPart("A", ["x", "x"])], [testPart("A")])).toThrow(
      'duplicate prop name "x"'
    );
  });

  test("deduplicates normalized provenance paths in stable first-seen order", () => {
    for (const component of report.components) {
      for (const evidence of [...component.currentEvidence, ...component.effectEvidence]) {
        expect(evidence.declarationPaths).toEqual([...new Set(evidence.declarationPaths)]);
        for (const prop of evidence.props) {
          expect(prop.declarationPaths).toEqual([...new Set(prop.declarationPaths)]);
        }
      }
    }
    for (const slug of ["badge", "button", "input", "separator", "textarea"] as const) {
      const component = report.components.find((entry) => entry.inventory.slug === slug);
      expect(component).toBeDefined();
      expect(component?.currentEvidence[0]?.declarationPaths).toHaveLength(1);
      expect(component?.effectEvidence[0]?.declarationPaths).toHaveLength(1);
    }
  });

  test("never writes during a run and surfaces an injected side failure", async () => {
    expect(refusedWrites).toEqual([]);
    const injected = new Error("injected shadow extraction failure");
    await expect(
      runDocsShadowComparison({
        effectSide: () => {
          throw injected;
        },
      })
    ).rejects.toBe(injected);
  });
});
