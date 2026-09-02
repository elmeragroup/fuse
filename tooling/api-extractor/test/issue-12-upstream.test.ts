import { Schema } from "effect";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertReactDivergenceEvidence,
  assertTs7DivergenceEvidence,
  canonicalDifferencePaths,
  expectedWarningCodes,
  issue12ExpectedWarnings,
  issue12ReactFixtureAudit,
  issue12ReactFixtures,
  normalizeWarnings,
  readFixtureOracle,
} from "../scripts/fixture-evidence.ts";
import { referenceAvailable, upstreamFixtureRoot } from "../scripts/reference.ts";
import type { ExtractionResult, ExtractorOptions } from "../src/index.ts";
import type { ComponentNode, SemanticType } from "../src/model.ts";
import { ProvenanceEntrySchema } from "../src/provenance.ts";
import { ExtractWarningSchema } from "../src/warnings.ts";
import { extractFixture } from "./support/extract.ts";

const fixtureRoot = resolve(import.meta.dirname, "fixtures");
const tsconfigPath = resolve(fixtureRoot, "issue-12-tsconfig.json");

function runExtraction(fixture: string, file: string, options?: ExtractorOptions): Promise<ExtractionResult> {
  return extractFixture({ tsconfigPath }, resolve(fixtureRoot, fixture, file), options);
}

function oracleFile(definition: (typeof issue12ReactFixtures)[number]): string {
  return definition.oracle === "immutable-upstream" ? "output.json" : "output.tsgo.json";
}

function readJson(fixture: string, file: string): Schema.Json {
  return Schema.decodeUnknownSync(Schema.Json)(
    JSON.parse(readFileSync(resolve(fixtureRoot, fixture, file), "utf8"))
  );
}

function component(result: ExtractionResult, name: string): ComponentNode {
  const entry = result.module.exports.find((candidate) => candidate.name === name);
  if (entry?.type.kind !== "component") throw new Error(`Expected component export ${name}`);
  return entry.type;
}

function property(type: ComponentNode, name: string): SemanticType {
  const entry = type.props.find((candidate) => candidate.name === name);
  if (entry === undefined) throw new Error(`Expected component prop ${name}`);
  return entry.type;
}

describe("Issue 12 ported wrapped React fixtures", () => {
  it("keeps every copied input and immutable upstream oracle byte-identical", () => {
    if (!referenceAvailable) return;
    for (const definition of issue12ReactFixtures) {
      for (const file of [definition.file, "output.json"]) {
        expect(readFileSync(resolve(fixtureRoot, definition.fixture, file), "utf8")).toBe(
          readFileSync(resolve(upstreamFixtureRoot, definition.fixture, file), "utf8")
        );
      }
    }
  });

  for (const definition of issue12ReactFixtures) {
    it(`matches the ${definition.oracle} oracle for ${definition.fixture}`, async () => {
      const result = await runExtraction(definition.fixture, definition.file);
      expect(result.module).toEqual(readFixtureOracle(definition.fixture, oracleFile(definition)));
    });
  }

  it("records exact zero-leaf equality for immutable wrappers", async () => {
    for (const definition of issue12ReactFixtures) {
      if (definition.oracle !== "immutable-upstream") continue;
      const result = await runExtraction(definition.fixture, definition.file);
      expect(
        canonicalDifferencePaths(
          readJson(definition.fixture, "output.json"),
          Schema.decodeUnknownSync(Schema.Json)(JSON.parse(JSON.stringify(result.module)))
        )
      ).toEqual([]);
    }
  });

  it("keeps every reviewed TypeScript 7 divergence tied to its preserved upstream oracle", () => {
    for (const definition of issue12ReactFixtures) {
      if (definition.oracle !== "reviewed-ts7") continue;
      expect(() => assertTs7DivergenceEvidence(definition.fixture)).not.toThrow();
    }
  });

  it("keeps the Base UI compound divergence record current", () => {
    expect(() => assertReactDivergenceEvidence()).not.toThrow();
  });

  it("matches the structured warning oracle for every wrapper", async () => {
    for (const definition of issue12ReactFixtures) {
      const result = await runExtraction(definition.fixture, definition.file);
      const expected = Schema.decodeUnknownSync(Schema.Array(ExtractWarningSchema))(
        readJson(definition.fixture, definition.warningOracle)
      );
      expect(normalizeWarnings(result.warnings)).toEqual(expected);
      expect(result.warnings.map((warning) => warning.code)).toEqual(
        expectedWarningCodes(issue12ExpectedWarnings, definition.fixture)
      );
      for (const provenance of result.provenance) {
        expect(() => Schema.decodeUnknownSync(ProvenanceEntrySchema)(provenance)).not.toThrow();
      }
    }
  });

  it("audits all 22 upstream React fixtures plus the Base UI compound boundary", () => {
    const names = issue12ReactFixtureAudit.map((entry) => entry.fixture);
    expect(new Set(names).size).toBe(23);
    expect(names).toEqual([
      "react-component-function-declaration",
      "react-component-function-variable",
      "react-component-return-types",
      "react-component-function-overloads",
      "react-component-generic-function-overloads",
      "react-component-overload-any-callback-deduplication",
      "react-component-render-callback-props",
      "react-component-union-variants",
      "react-event-handlers",
      "react-hook-arrow-function",
      "react-hook-function-declaration",
      "react-hook-function-expression",
      "react-hook-multiple-parameters",
      "react-hook-overload-signatures",
      "react-props-callback-types",
      "react-props-literal-types",
      "react-props-optional-types",
      "react-refs",
      "react-forward-ref-component",
      "react-forward-ref-union-props",
      "react-memo-component",
      "react-mui-overridable-component",
      "base-ui-component",
    ]);
    expect(
      issue12ReactFixtureAudit.filter((entry) => entry.owner === "issue12").map((entry) => entry.fixture)
    ).toEqual([
      "react-forward-ref-component",
      "react-forward-ref-union-props",
      "react-memo-component",
      "react-mui-overridable-component",
      "base-ui-component",
    ]);
    expect(issue12ReactFixtures.map((entry) => entry.fixture)).toEqual([
      "react-forward-ref-component",
      "react-forward-ref-union-props",
      "react-memo-component",
      "react-mui-overridable-component",
    ]);
  });
});

describe("Issue 12 wrapped and compound component representation", () => {
  it("preserves forwardRef props, ref type, docs, and authored ownership", async () => {
    const result = await runExtraction("react-forward-ref-component", "input.tsx");
    const type = component(result, "TestComponent");
    expect(type.typeName).toMatchObject({
      name: "ForwardRefExoticComponent",
      namespaces: ["React"],
    });
    expect(type.props.map((entry) => entry.name)).toEqual(["className", "id"]);
    expect(
      result.module.exports.find((entry) => entry.name === "TestComponent")?.documentation
    ).toMatchObject({
      description: "A test component",
    });
    const argument = type.typeName?.typeArguments?.[0]?.type;
    if (argument?.kind !== "intersection") throw new Error("forwardRef props lost its intersection");
    expect(
      argument.types.some(
        (member) =>
          member.kind === "external" &&
          member.typeName.name === "RefAttributes" &&
          member.typeName.namespaces?.join(".") === "React"
      )
    ).toBe(true);
    expect(result.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["TestComponent", "props", "className"] }),
        expect.objectContaining({ path: ["TestComponent", "props", "id"] }),
      ])
    );
    const propProvenance = result.provenance.filter(
      (entry) => entry.path[0] === "TestComponent" && entry.path[1] === "props"
    );
    expect(propProvenance.length).toBeGreaterThan(0);
    expect(
      propProvenance.every((entry) => entry.declarationPaths.every((path) => !path.includes("node_modules")))
    ).toBe(true);
  });

  it("preserves memo props and display documentation", async () => {
    const result = await runExtraction("react-memo-component", "input.tsx");
    const type = component(result, "TestComponent");
    expect(type.typeName).toMatchObject({ name: "NamedExoticComponent", namespaces: ["React"] });
    expect(type.props.map((entry) => entry.name)).toEqual(["className", "id"]);
    expect(
      result.module.exports.find((entry) => entry.name === "TestComponent")?.documentation
    ).toMatchObject({
      description: "A test component",
    });
  });

  it("squashes forwardRef union props while retaining each ref arm", async () => {
    const result = await runExtraction("react-forward-ref-union-props", "input.tsx");
    const type = component(result, "Button");
    expect(type.typeName).toMatchObject({
      name: "ForwardRefExoticComponent",
      namespaces: ["React"],
    });
    expect(type.props.map((entry) => entry.name)).toEqual(["type", "id", "className", "nativeButton"]);
    const nativeButton = property(type, "nativeButton");
    if (nativeButton.kind !== "union") throw new Error("nativeButton lost its union type");
    expect(nativeButton.types).toEqual([
      { kind: "intrinsic", intrinsic: "boolean" },
      { kind: "intrinsic", intrinsic: "undefined" },
    ]);
    const argument = type.typeName?.typeArguments?.[0]?.type;
    if (argument?.kind !== "union") throw new Error("forwardRef union props lost its union");
    const refArms = argument.types.filter(
      (member) =>
        member.kind === "intersection" &&
        member.types.some(
          (child) =>
            child.kind === "external" &&
            child.typeName.name === "RefAttributes" &&
            child.typeName.namespaces?.join(".") === "React"
        )
    );
    expect(refArms).toHaveLength(2);
  });

  it("resolves MUI overridable props as one established component model", async () => {
    const result = await runExtraction("react-mui-overridable-component", "input.d.ts");
    const type = component(result, "default");
    expect(type.typeName).toBeUndefined();
    expect(type.props.map((entry) => entry.name)).toEqual(["component", "variant", "className", "style"]);
    const componentProp = property(type, "component");
    if (componentProp.kind !== "union") throw new Error("overridable component prop lost its overload union");
    const root = componentProp.types.find((member) => member.kind === "typeParameter");
    expect(root).toMatchObject({
      kind: "typeParameter",
      name: "RootComponent",
      constraint: {
        kind: "external",
        typeName: { name: "ElementType", namespaces: ["React"] },
      },
    });
    expect(property(type, "variant")).toMatchObject({ kind: "union" });
    expect(property(type, "style")).toMatchObject({ kind: "union" });
    expect(result.warnings.every((warning) => warning.code === "omitted-index-signature")).toBe(true);
  });

  it("supports nested wrappers and namespace compound members at the public seam", async () => {
    const result = await runExtraction("issue-12-review", "input.tsx");
    const nested = component(result, "NestedWrapped");
    expect(nested.typeName).toMatchObject({ name: "NamedExoticComponent", namespaces: ["React"] });
    expect(nested.props.map((entry) => entry.name)).toEqual(["label", "children"]);
    expect(result.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["NestedWrapped", "props", "label"] }),
        expect.objectContaining({ path: ["NestedWrapped", "props", "children"] }),
      ])
    );
    expect(component(result, "CompoundRoot.Item")).toMatchObject({
      kind: "component",
      typeName: { name: "Item", namespaces: ["CompoundRoot"] },
    });
    expect(result.module.exports.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(["CompoundRoot", "CompoundRoot.Item", "CompoundRoot.Props"])
    );
    expect(component(result, "default")).toMatchObject({
      kind: "component",
      typeName: { name: "ForwardRefExoticComponent", namespaces: ["React"] },
      props: [{ name: "label", optional: false }],
    });
    expect(component(result, "GenericWrapped")).toMatchObject({
      kind: "component",
      typeName: { name: "MemoExoticComponent", namespaces: ["React"] },
      props: [
        {
          name: "value",
          type: { kind: "typeParameter", name: "Value" },
          optional: false,
        },
      ],
    });
    expect(component(result, "OverloadedWrapped")).toMatchObject({
      kind: "component",
      typeName: { name: "MemoExoticComponent", namespaces: ["React"] },
      props: [
        { name: "text", type: { kind: "union" }, optional: true },
        { name: "count", type: { kind: "union" }, optional: true },
      ],
    });
    expect(result.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["GenericWrapped", "props", "value"] }),
        expect.objectContaining({ path: ["OverloadedWrapped", "props", "text"] }),
        expect.objectContaining({ path: ["OverloadedWrapped", "props", "count"] }),
      ])
    );
  });

  it("follows only React wrappers and never imports arbitrary callback or comparator props", async () => {
    const result = await runExtraction("issue-12-review", "input.tsx");

    expect(component(result, "ArbitraryWrapped").props.map((entry) => entry.name)).toEqual(["resolvedOnly"]);
    expect(component(result, "ArbitraryWrapped").props.map((entry) => entry.name)).not.toContain(
      "callbackOnly"
    );
    expect(
      result.provenance.some(
        (entry) => entry.path.includes("callbackOnly") || entry.path.includes("ArbitraryCallbackProps")
      )
    ).toBe(false);
    expect(component(result, "AliasWrapped").props.map((entry) => entry.name)).toEqual(["value"]);
    expect(component(result, "ComparedWrapped").props.map((entry) => entry.name)).toEqual(["value"]);
    expect(component(result, "ComparedWrapped").props.map((entry) => entry.name)).not.toContain(
      "comparatorOnly"
    );
  });

  it("derives overloaded wrapper props from public signatures only", async () => {
    const result = await runExtraction("issue-12-review", "input.tsx");

    expect(component(result, "ImplementationLeakWrapped").props.map((entry) => entry.name)).toEqual([
      "text",
      "count",
    ]);
    expect(component(result, "ImplementationLeakWrapped").props.map((entry) => entry.name)).not.toContain(
      "implementationOnly"
    );

    const generic = component(result, "GenericImplementationLeakWrapped");
    expect(generic.props.map((entry) => entry.name)).toEqual(["value", "count"]);
    expect(generic.props.map((entry) => entry.name)).not.toContain("implementationOnly");
    const value = property(generic, "value");
    if (value.kind !== "union") throw new Error("generic overload prop lost its optional union");
    expect(value.types).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "typeParameter", name: "Value" })])
    );
  });

  it("keeps wrapper components recognizable when external expansion is enabled", async () => {
    const forward = await runExtraction("react-forward-ref-component", "input.tsx", {
      includeExternalTypes: true,
    });
    expect(component(forward, "TestComponent").props.map((entry) => entry.name)).toEqual(["className", "id"]);
    const memo = await runExtraction("react-memo-component", "input.tsx", {
      includeExternalTypes: true,
    });
    expect(memo.module.exports.find((entry) => entry.name === "TestComponent")?.type.kind).toBe("component");
  });
});
