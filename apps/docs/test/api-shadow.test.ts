import { beforeAll, describe, expect, test } from "vitest";

import { effectOrigin } from "../scripts/lib/api-effect-adapter.ts";
import {
  assertReviewedReasons,
  compareParts,
  docsShadowInventory,
  inputCapturesEqual,
  readShadowSnapshot,
  refusingDocsWriter,
  reviewAgainstSnapshot,
  runDocsShadowComparison,
  persistShadowReport,
  snapshotOf,
  writeShadowSnapshot,
} from "../scripts/lib/api-shadow.ts";
import type { DocsShadowReport } from "../scripts/lib/api-shadow.ts";
import { componentSlugs } from "../scripts/lib/components.ts";
import type { ApiPart, ApiProp } from "../src/lib/docs-model.ts";

const refusedWrites: string[] = [];
const shadowWriter = refusingDocsWriter((operation) => {
  refusedWrites.push(operation);
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

const racShadowSlugs = new Set([
  "calendar",
  "date-field",
  "date-picker",
  "date-range-picker",
  "grid-list",
  "link",
  "range-calendar",
  "search-field",
]);

function partNameFromPath(path: string): string {
  const rest = path.replace(/^(?:parts|evidence)\./u, "");
  const cut = rest.search(/\.props\.|\.propOrder/u);
  return cut === -1 ? (rest.split(".")[0] ?? rest) : rest.slice(0, cut);
}

function propOrderIndex(path: string): string | undefined {
  return /\.propOrder\[(\d+)\]/u.exec(path)?.[1];
}

function isWholeRenderPath(path: string): boolean {
  return path.endsWith(".props.render");
}

beforeAll(async () => {
  report = await runDocsShadowComparison({ writer: shadowWriter });
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
    expect(snapshot.summary.componentCount).toBe(66);
    const reasons = [...snapshot.apiDifferences, ...snapshot.problemDifferences].map(
      (difference) => difference.reason
    );
    expect(reasons.every((reason) => reason.trim() !== "")).toBe(true);
    expect(reasons.every((reason) => !reason.includes("reviewed in the 57-component snapshot"))).toBe(true);
    expect(snapshotOf(report, snapshot)).toEqual(snapshot);
    expect(report.apiDifferences).toHaveLength(report.summary.apiDifferenceCount);
    expect(report.problemDifferences).toHaveLength(report.summary.problemDifferenceCount);
    expect(
      report.apiDifferences.every(
        (difference) =>
          difference.path !== "parts" && difference.path !== "evidence" && !difference.path.endsWith(".props")
      )
    ).toBe(true);
  });

  test("reviewed reasons name the part or the keys that moved", () => {
    const snapshot = readShadowSnapshot();
    const apiReasonCounts = new Map<string, number>();
    for (const difference of snapshot.apiDifferences) {
      const part = partNameFromPath(difference.path);
      expect(difference.reason, difference.path).toContain(difference.component);
      expect(difference.reason, difference.path).toContain(part);
      expect(difference.reason).not.toContain("Type printer disagreement");
      expect(difference.reason).not.toContain("adds `render` (or drops");
      const order = propOrderIndex(difference.path);
      if (order !== undefined) {
        const matched = /propOrder\[(\d+)\]: checker (.+) vs Effect (.+)\.$/u.exec(difference.reason);
        expect(matched?.[1], difference.path).toBe(order);
        expect(matched?.[2], difference.path).toBe(difference.current ?? "omitted");
        expect(matched?.[3], difference.path).toBe(difference.effect ?? "omitted");
      }
      if (isWholeRenderPath(difference.path)) {
        if (racShadowSlugs.has(difference.component)) {
          expect(difference.reason, difference.path).toMatch(/RAC|DOMRenderFunction/u);
          expect(difference.reason, difference.path).not.toContain("Base UI");
          expect(difference.reason, difference.path).not.toContain("ComponentRenderFn");
        } else if (difference.effect !== undefined) {
          expect(difference.reason, difference.path).toContain("Base UI");
        }
      }
      apiReasonCounts.set(difference.reason, (apiReasonCounts.get(difference.reason) ?? 0) + 1);
    }
    expect(
      [...apiReasonCounts]
        .filter(([, count]) => count > 2)
        .map(([reason, count]) => `${String(count)}× ${reason}`)
    ).toEqual([]);
    for (const difference of snapshot.problemDifferences) {
      expect(difference.reason, difference.key).toContain(difference.component);
      const problem = difference.effect ?? difference.current;
      if (problem?.code === "unsupported-type-fallback") {
        expect(difference.reason).toContain("`any`");
        expect(difference.reason).toMatch(/\{|METER_CONSTANTS|Toast namespace|PopoverHandle/u);
      }
    }
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
    expect(effectOrigin({ path: ["A", "props", "x"], declarations: [], synthesized: false })).toBe(
      "declared"
    );
    expect(effectOrigin({ path: ["A", "props", "variant"], declarations: [], synthesized: true })).toBe(
      "recipe-axis"
    );
    expect(
      effectOrigin({
        path: ["A", "props", "size"],
        declarations: [{ path: "packages/ui/src/components/a/a-variants.ts" }],
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

  test("Effect part count matches the checker walk for every component", () => {
    expect(report.summary.componentCount).toBe(66);
    expect(report.summary.effectPartCount).toBe(report.summary.currentPartCount);
    for (const component of report.components) {
      expect(
        component.effect.map((part) => part.name),
        component.inventory.slug
      ).toEqual(component.current.map((part) => part.name));
    }
  });

  test("represents hook and intrinsic exports as parts", () => {
    const names = (slug: string): readonly string[] =>
      report.components
        .find((component) => component.inventory.slug === slug)
        ?.effect.map((part) => part.name) ?? [];
    expect(names("sidebar")).toContain("useSidebar");
    expect(names("combobox")).toContain("useComboboxAnchor");
    expect(names("focusable")).toContain("useFocusable");
    expect(names("toast")).toEqual(
      report.components
        .find((component) => component.inventory.slug === "toast")
        ?.current.map((part) => part.name)
    );
  });

  test("does not drop hook or intrinsic exports as unrenderable", () => {
    expect(
      report.components
        .flatMap((component) => component.effectProblems)
        .filter((problem) => problem.message.includes("has no renderable component parts"))
    ).toEqual([]);
  });

  test("computes forwardedCount from the part type rather than leaving it at zero", () => {
    expect(report.apiDifferences.filter((difference) => difference.path.endsWith(".forwardedCount"))).toEqual(
      []
    );
    const button = report.components.find((component) => component.inventory.slug === "button")?.effect[0];
    expect(button?.forwardedCount).toBeGreaterThan(0);
  });

  test("rejects a snapshot entry without a reason, naming the entry", () => {
    const snapshot = readShadowSnapshot();
    const first = snapshot.apiDifferences[0];
    if (first === undefined) throw new Error("the reviewed snapshot has no API differences");
    expect(() =>
      assertReviewedReasons({
        ...snapshot,
        apiDifferences: [
          {
            component: first.component,
            path: first.path,
            current: first.current,
            effect: first.effect,
            reason: "",
          },
          ...snapshot.apiDifferences.slice(1),
        ],
      })
    ).toThrow(`snapshot entry missing reason: api|${first.component}|${first.path}`);
  });

  test("preserves reviewed reasons by identity when forming the snapshot", () => {
    const snapshot = readShadowSnapshot();
    const first = snapshot.apiDifferences[0];
    if (first === undefined) throw new Error("the reviewed snapshot has no API differences");
    const merged = snapshotOf(report, snapshot);
    const reviewedApi = new Map(
      snapshot.apiDifferences.map((difference) => [
        `${difference.component}|${difference.path}`,
        difference.reason,
      ])
    );
    for (const difference of merged.apiDifferences) {
      const previous = reviewedApi.get(`${difference.component}|${difference.path}`);
      if (previous !== undefined) expect(difference.reason).toBe(previous);
    }
    const novel = merged.apiDifferences.find(
      (difference) => !reviewedApi.has(`${difference.component}|${difference.path}`)
    );
    if (novel !== undefined) expect(novel.reason).toBe("");
    const kept = snapshotOf(
      { ...report, apiDifferences: [first], problemDifferences: [], summary: snapshot.summary },
      snapshot
    );
    expect(kept.apiDifferences).toEqual([first]);
  });

  test("never writes during a run and surfaces an injected side failure", async () => {
    expect(refusedWrites).toEqual([]);
    const injected = new Error("injected shadow extraction failure");
    await expect(
      runDocsShadowComparison({
        writer: shadowWriter,
        effectSide: () => {
          throw injected;
        },
      })
    ).rejects.toBe(injected);
  });

  test("snapshot writes go through the injected DocsWriter", () => {
    const snapshot = readShadowSnapshot();
    const first = snapshot.apiDifferences[0];
    if (first === undefined) throw new Error("the reviewed snapshot has no API differences");
    const writes: string[] = [];
    const writer = refusingDocsWriter((operation) => {
      writes.push(operation);
    });
    expect(() => writeShadowSnapshot(snapshot, writer)).toThrow("docs shadow run must not write (writeFile)");
    expect(writes).toEqual(["writeFile"]);
    const persistWrites: string[] = [];
    const persistWriter = refusingDocsWriter((operation) => {
      persistWrites.push(operation);
    });
    expect(() =>
      persistShadowReport(
        { ...report, apiDifferences: [first], problemDifferences: [], summary: snapshot.summary },
        persistWriter,
        snapshot
      )
    ).toThrow("docs shadow run must not write (writeFile)");
    expect(persistWrites).toEqual(["writeFile"]);
  });
});
