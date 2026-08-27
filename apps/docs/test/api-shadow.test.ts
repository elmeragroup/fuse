import { beforeAll, describe, expect, test } from "vitest";

import { effectOrigin } from "../scripts/lib/api-shadow-adapter.ts";
import {
  DOCS_SHADOW_SLUGS,
  compareParts,
  inputCapturesEqual,
  docsShadowInventory,
  reviewDifferences,
  runDocsShadowComparison,
  protectedBytesEqual,
} from "../scripts/lib/api-shadow.ts";
import type { DocsShadowReport } from "../scripts/lib/api-shadow.ts";
import type { ApiPart, ApiProp } from "../src/lib/docs-model.ts";

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

describe("Issue 15 docs API shadow", () => {
  test("uses the complete route inventory and identical public entry inputs", () => {
    const inventory = docsShadowInventory();
    expect(inventory.map((entry) => entry.slug)).toEqual([...DOCS_SHADOW_SLUGS]);
    expect(report.inventory).toEqual(inventory);
    expect(report.extractionInputs).toEqual(inventory.map((entry) => entry.entryFile));
    expect(report.currentInputs).toEqual(report.extractionInputs);
    expect(report.effectInputs).toEqual(report.extractionInputs);
    expect(report.currentInputs).not.toBe(report.extractionInputs);
    expect(report.effectInputs).not.toBe(report.extractionInputs);
    expect(report.currentInputs).not.toBe(report.effectInputs);
    expect(report.currentInputHashes).toHaveLength(DOCS_SHADOW_SLUGS.length);
    expect(report.effectInputHashes).toHaveLength(DOCS_SHADOW_SLUGS.length);
    expect(report.currentInputHashes).not.toBe(report.effectInputHashes);
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
    expect(report.inventory.every((entry) => entry.sourceFile.length > 0)).toBe(true);
  });

  test("records the complete measured shape and problem multiset", () => {
    expect(report.summary).toEqual({
      componentCount: 57,
      currentPartCount: 225,
      effectPartCount: 78,
      currentPropCount: 403,
      effectPropCount: 372,
      currentProblemCount: 0,
      effectProblemCount: 139,
      apiDifferenceCount: 1115,
      problemDifferenceCount: 139,
      reviewedApiDifferenceCount: 1115,
      reviewedProblemDifferenceCount: 139,
      unexplainedApiDifferenceCount: 0,
      unexplainedProblemDifferenceCount: 0,
    });
    expect(report.unexplainedApiDifferences).toEqual([]);
    expect(report.unexplainedProblemDifferences).toEqual([]);
    expect(report.apiDifferences).toHaveLength(report.summary.reviewedApiDifferenceCount);
    expect(report.problemDifferences).toHaveLength(report.summary.reviewedProblemDifferenceCount);
  });

  test("checks exact decisions and rejects duplicate or wildcard coverage", () => {
    const covered = new Set<string>();
    for (const decision of report.decisions) {
      expect(decision.paths.length).toBeGreaterThan(0);
      expect(new Set(decision.paths).size).toBe(decision.paths.length);
      for (const decisionPath of decision.paths) {
        expect(decisionPath).not.toBe("");
        if (decision.kind === "api") expect(decisionPath).not.toMatch(/[*?]/u);
        const key = `${decision.kind}|${decision.component}|${decisionPath}`;
        expect(covered.has(key)).toBe(false);
        covered.add(key);
      }
    }
    expect(covered.size).toBe(
      report.summary.reviewedApiDifferenceCount + report.summary.reviewedProblemDifferenceCount
    );
    expect(
      report.apiDifferences.every(
        (difference) =>
          difference.path !== "parts" && difference.path !== "evidence" && !difference.path.endsWith(".props")
      )
    ).toBe(true);
    expect(
      report.apiDifferences.some(
        (difference) =>
          difference.component === "input-group" &&
          difference.path === "parts.InputGroup.Button.props.aria-label"
      )
    ).toBe(true);

    const firstDecision = report.decisions[0];
    if (firstDecision === undefined) throw new Error("shadow report has no decisions");
    expect(() =>
      reviewDifferences(report.apiDifferences, report.problemDifferences, [
        ...report.decisions,
        { ...firstDecision, id: firstDecision.id },
      ])
    ).toThrow(`duplicate shadow decision id ${firstDecision.id}`);
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

    const button = report.components.find((entry) => entry.inventory.slug === "button");
    const ariaLabel = button?.currentEvidence[0]?.props.find((prop) => prop.name === "aria-label");
    expect(ariaLabel?.declarationPaths).toEqual([
      "node_modules/.pnpm/@types+react@19.2.17/node_modules/@types/react/index.d.ts",
      "packages/ui/src/components/button/button.tsx",
    ]);
  });

  test("proves the validation-only run leaves protected bytes unchanged", () => {
    expect(report.protectedBytesBefore.generator.path).toBe("apps/docs/scripts/generate.ts");
    expect(report.protectedBytesBefore.generated.length).toBeGreaterThan(0);
    expect(report.protectedBytesBefore.markdown).toHaveLength(DOCS_SHADOW_SLUGS.length);
    expect(report.protectedBytesBefore.llms.path).toBe("apps/docs/public/llms.txt");
    expect(report.protectedBytesAfter).toEqual(report.protectedBytesBefore);
    expect(protectedBytesEqual(report.protectedBytesBefore, report.protectedBytesAfter)).toBe(true);
  });

  test("takes the after snapshot and preserves an injected failure", async () => {
    const injected = new Error("injected shadow extraction failure");
    const phases: Array<{ phase: "before" | "after"; snapshot: DocsShadowReport["protectedBytesBefore"] }> =
      [];
    await expect(
      runDocsShadowComparison({
        effectSide: () => {
          throw injected;
        },
        onProtectedSnapshot: (phase, snapshot) => phases.push({ phase, snapshot }),
      })
    ).rejects.toBe(injected);
    expect(phases.map(({ phase }) => phase)).toEqual(["before", "after"]);
    expect(
      protectedBytesEqual(
        phases[0]?.snapshot ?? report.protectedBytesBefore,
        phases[1]?.snapshot ?? report.protectedBytesAfter
      )
    ).toBe(true);
  });
});
