import { Effect, Schema } from "effect";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ExtractionResultSchema, ProjectExtractor } from "../src/index.ts";
import type { ComponentNode, ExtractionResult, ExtractorOptions } from "../src/index.ts";

const fixtureRoot = resolve(import.meta.dirname, "fixtures/package-selective-external-types");
const inputPath = resolve(fixtureRoot, "input.ts");
const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");

function runExtraction(
  options?: ExtractorOptions & { readonly typeOperatorOutput?: "resolved" }
): Promise<ExtractionResult> {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const extractor = yield* ProjectExtractor;
        return yield* extractor.extractModule(inputPath, options);
      }).pipe(Effect.provide(ProjectExtractor.live({ tsconfigPath })))
    )
  );
}

function primitiveComponent(result: ExtractionResult): ComponentNode {
  const entry = result.module.exports.find((candidate) => candidate.name === "PrimitiveComponent");
  if (entry?.type.kind !== "component") throw new Error("Expected PrimitiveComponent component export");
  return entry.type;
}

function stableResult(result: ExtractionResult): string {
  return JSON.stringify({ module: result.module, warnings: result.warnings, provenance: result.provenance });
}

describe("package-selective external-type expansion", () => {
  it("expands ordinary props from exactly the selected scoped dependency", async () => {
    const result = await runExtraction({ includeExternalTypes: ["@fixture/selected"] });
    const props = new Map(primitiveComponent(result).props.map((property) => [property.name, property]));

    expect([...props.keys()]).toEqual(["focusableWhenDisabled", "foreignDetail", "onAction", "localLabel"]);
    expect(props.get("focusableWhenDisabled")?.documentation).toEqual({
      description: "Allows the primitive to remain focusable while disabled.",
      defaultValue: "false",
      tags: [],
    });
    expect(props.get("foreignDetail")?.type).toMatchObject({
      kind: "external",
      typeName: { name: "ForeignDetail" },
    });
    expect(props.get("onAction")?.type).toMatchObject({
      kind: "union",
      types: [
        {
          kind: "external",
          typeName: { name: "MouseEventHandler", namespaces: ["React"] },
        },
        { kind: "intrinsic", intrinsic: "undefined" },
      ],
    });
    expect(props.has("prefixedPackageProp")).toBe(false);
    expect(result.provenance).toContainEqual({
      path: ["PrimitiveComponent", "props", "focusableWhenDisabled"],
      declarationPaths: [
        "test/fixtures/package-selective-external-types/node_modules/@fixture/selected/button.d.ts",
      ],
      synthesized: false,
    });
    expect(Schema.decodeUnknownSync(ExtractionResultSchema)(result)).toEqual(result);
  });

  it("uses the same selection for mapped members, keyof, and mixed declaration owners", async () => {
    const result = await runExtraction({ includeExternalTypes: ["@fixture/selected"] });
    const exports = new Map(result.module.exports.map((entry) => [entry.name, entry.type]));

    expect(exports.get("SelectedMappedUse")).toMatchObject({
      kind: "object",
      properties: [{ name: "mappedOne" }, { name: "mappedTwo" }],
    });
    expect(exports.get("SelectedKeysUse")).toMatchObject({
      kind: "typeOperator",
      operator: "keyof",
      type: {
        kind: "object",
        typeName: { name: "SelectedKeySource" },
        properties: [],
      },
    });
    expect(exports.get("MixedOwner")).toEqual({ kind: "object", properties: [] });
    expect(exports.get("SelectedOwner")).toMatchObject({
      kind: "object",
      properties: [{ name: "selectedMember" }],
    });
  });

  it("preserves default and boolean behavior while treating an empty list as disabled", async () => {
    const [omitted, disabled, empty, enabled] = await Promise.all([
      runExtraction(),
      runExtraction({ includeExternalTypes: false }),
      runExtraction({ includeExternalTypes: [] }),
      runExtraction({ includeExternalTypes: true }),
    ]);

    expect(stableResult(disabled)).toBe(stableResult(omitted));
    expect(stableResult(empty)).toBe(stableResult(omitted));
    expect(primitiveComponent(omitted).props.map((property) => property.name)).toEqual(["localLabel"]);
    expect(primitiveComponent(enabled).props.map((property) => property.name)).toEqual([
      "focusableWhenDisabled",
      "foreignDetail",
      "onAction",
      "prefixedPackageProp",
      "localLabel",
    ]);
    expect(
      primitiveComponent(enabled).props.find((property) => property.name === "foreignDetail")?.type.kind
    ).not.toBe("external");
  });

  it("matches exact package owners deterministically and copies caller lists", async () => {
    const packages = ["@fixture/selected"];
    const selectedWhileMutating = runExtraction({
      includeExternalTypes: packages,
      shouldInclude: () => {
        packages.push("@fixture/selected-extra");
        return true;
      },
    });
    const [firstOrder, secondOrder, caseMismatch, subpathEntry, samePrefix, typescript, copied] =
      await Promise.all([
        runExtraction({
          includeExternalTypes: ["@fixture/selected", "@fixture/selected-extra", "@fixture/selected"],
        }),
        runExtraction({ includeExternalTypes: ["@fixture/selected-extra", "@fixture/selected"] }),
        runExtraction({ includeExternalTypes: ["@fixture/Selected"] }),
        runExtraction({ includeExternalTypes: ["@fixture/selected/button"] }),
        runExtraction({ includeExternalTypes: ["@fixture/selected-extra"] }),
        runExtraction({ includeExternalTypes: ["typescript"] }),
        selectedWhileMutating,
      ]);
    const disabled = await runExtraction({ includeExternalTypes: false });

    expect(stableResult(firstOrder)).toBe(stableResult(secondOrder));
    expect(stableResult(caseMismatch)).toBe(stableResult(disabled));
    expect(stableResult(subpathEntry)).toBe(stableResult(disabled));
    expect(stableResult(typescript)).toBe(stableResult(disabled));
    expect(primitiveComponent(samePrefix).props.map((property) => property.name)).toEqual([
      "prefixedPackageProp",
      "localLabel",
    ]);
    expect(primitiveComponent(copied).props.some((property) => property.name === "prefixedPackageProp")).toBe(
      false
    );
  });

  it("allows existing callbacks to narrow selected dependency shapes", async () => {
    const baseline = await runExtraction({ includeExternalTypes: ["@fixture/selected"] });
    const narrowed = await runExtraction({
      includeExternalTypes: ["@fixture/selected"],
      shouldInclude: ({ name }) => name !== "focusableWhenDisabled",
      shouldResolveObject: ({ name }) => (name === "SelectedOwner" ? false : undefined),
    });
    const props = primitiveComponent(narrowed).props.map((property) => property.name);
    const selectedOwner = narrowed.module.exports.find((entry) => entry.name === "SelectedOwner");

    expect(props).toEqual(["foreignDetail", "onAction", "localLabel"]);
    expect(selectedOwner?.type).toEqual({
      kind: "object",
      typeName: { name: "SelectedOwner" },
      properties: [],
    });
    expect(narrowed.warnings).toEqual(baseline.warnings);
  });
});
