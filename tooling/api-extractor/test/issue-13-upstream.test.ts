import { Effect, Schema } from "effect";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertTs7DivergenceEvidence,
  canonicalDifferencePaths,
  issue13ExpectedWarnings,
  issue13ExternalFixtures,
  readFixtureOracle,
} from "../scripts/fixture-evidence.ts";
import { referenceAvailable, upstreamFixtureRoot } from "../scripts/reference.ts";
import { classifySourceFile } from "../src/backend/ts7/file-ownership.ts";
import { ProjectExtractor } from "../src/index.ts";
import type { ExtractionResult, ExtractorOptions } from "../src/index.ts";
import type { ExternalTypeNode } from "../src/model.ts";
import { defaultExtractorOptions } from "../src/options.ts";

const fixtureRoot = resolve(import.meta.dirname, "fixtures");
const tsconfigPath = resolve(fixtureRoot, "issue-13-tsconfig.json");

function runExtraction(
  fixture: string,
  file: string,
  options?: ExtractorOptions & { readonly typeOperatorOutput?: "resolved" }
): Promise<ExtractionResult> {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const extractor = yield* ProjectExtractor;
        return yield* extractor.extractModule(resolve(fixtureRoot, fixture, file), options);
      }).pipe(Effect.provide(ProjectExtractor.live({ tsconfigPath })))
    )
  );
}

function oracleFile(definition: (typeof issue13ExternalFixtures)[number]): string {
  return definition.oracle === "immutable-upstream" ? "output.json" : "output.tsgo.json";
}

describe("Issue 13 backend ownership classification", () => {
  it.each([
    [
      "Unix ordinary dependency",
      "/repo/node_modules/pkg/index.d.ts",
      { kind: "dependency", packageName: "pkg" },
    ],
    [
      "Windows ordinary dependency",
      String.raw`C:\repo\node_modules\pkg\index.d.ts`,
      { kind: "dependency", packageName: "pkg" },
    ],
    [
      "Unix TypeScript standard library",
      "/repo/node_modules/typescript/lib/lib.dom.d.ts",
      { kind: "typescript", library: "standard-library" },
    ],
    [
      "Windows TypeScript standard library",
      String.raw`C:\repo\node_modules\typescript\lib\lib.dom.d.ts`,
      { kind: "typescript", library: "standard-library" },
    ],
    [
      "Unix @typescript toolchain library",
      "/repo/node_modules/@typescript/tsc/lib/lib.es2022.d.ts",
      { kind: "typescript", library: "standard-library" },
    ],
    [
      "Windows @typescript toolchain library",
      String.raw`C:\repo\node_modules\@typescript\tsc\lib\lib.es2022.d.ts`,
      { kind: "typescript", library: "standard-library" },
    ],
    [
      "Unix TypeScript non-standard declaration",
      "/repo/node_modules/typescript/lib/index.d.ts",
      { kind: "typescript", library: "toolchain" },
    ],
    [
      "Windows TypeScript non-standard declaration",
      String.raw`C:\repo\node_modules\typescript\lib\index.d.ts`,
      { kind: "typescript", library: "toolchain" },
    ],
    ["Unix project source", "/repo/src/index.ts", { kind: "project" }],
    ["Windows project source", String.raw`C:\repo\src\index.ts`, { kind: "project" }],
    [
      "non-TypeScript dependency library",
      "/repo/node_modules/pkg/lib/index.d.ts",
      { kind: "dependency", packageName: "pkg" },
    ],
    [
      "Unix @typescript-eslint parser library",
      "/repo/node_modules/@typescript-eslint/parser/lib/index.d.ts",
      { kind: "dependency", packageName: "@typescript-eslint/parser" },
    ],
    [
      "Windows @typescript-eslint parser library",
      String.raw`C:\repo\node_modules\@typescript-eslint\parser\lib\index.d.ts`,
      { kind: "dependency", packageName: "@typescript-eslint/parser" },
    ],
    [
      "Unix typescript-eslint library",
      "/repo/node_modules/typescript-eslint/lib/index.d.ts",
      { kind: "dependency", packageName: "typescript-eslint" },
    ],
    [
      "Windows typescript-eslint library",
      String.raw`C:\repo\node_modules\typescript-eslint\lib\index.d.ts`,
      { kind: "dependency", packageName: "typescript-eslint" },
    ],
    ["Unix project TypeScript-like library", "/repo/src/my-typescript/lib/index.d.ts", { kind: "project" }],
    [
      "Windows project TypeScript-like library",
      String.raw`C:\repo\src\my-typescript\lib\index.d.ts`,
      { kind: "project" },
    ],
  ] as const)("classifies $0", (_label, filePath, expected) => {
    expect(classifySourceFile(filePath)).toEqual(expected);
  });

  it.each([
    [
      "Unix project TypeScript-shaped library with compiler metadata",
      "/repo/src/typescript/lib/lib.dom.d.ts",
      { kind: "project" },
      { externalLibrary: false, defaultLibrary: false },
    ],
    [
      "Windows project @typescript-shaped library with compiler metadata",
      String.raw`C:\repo\src\@typescript\tsc\lib\lib.es2022.d.ts`,
      { kind: "project" },
      { externalLibrary: false, defaultLibrary: false },
    ],
    [
      "non-node_modules compiler default library",
      "/opt/typescript/lib/lib.es2022.d.ts",
      { kind: "typescript", library: "standard-library" },
      { externalLibrary: false, defaultLibrary: true },
    ],
    [
      "non-node_modules external compiler declaration",
      "/opt/typescript/lib/index.d.ts",
      { kind: "typescript", library: "toolchain" },
      { externalLibrary: true, defaultLibrary: false },
    ],
  ] as const)("combines compiler metadata for $0", (_label, filePath, expected, metadata) => {
    expect(classifySourceFile(filePath, metadata)).toEqual(expected);
  });
});

describe("Issue 13 ported external-type policy fixtures", () => {
  it("keeps every copied input and upstream oracle byte-identical to e145350", () => {
    if (!referenceAvailable) return;
    for (const definition of issue13ExternalFixtures) {
      // Inputs and upstream oracles are verbatim copies; the reviewed fixtures
      // add workspace-owned TS7 artifacts that have no upstream counterpart.
      for (const file of [definition.file, "output.json"]) {
        expect(readFileSync(resolve(fixtureRoot, definition.fixture, file), "utf8")).toBe(
          readFileSync(resolve(upstreamFixtureRoot, definition.fixture, file), "utf8")
        );
      }
      if (definition.oracle === "reviewed-ts7") {
        for (const file of ["output.tsgo.json", "ts7-oracle.json"]) {
          expect(readFileSync(resolve(fixtureRoot, definition.fixture, file), "utf8").length).toBeGreaterThan(
            0
          );
        }
      }
    }
  });

  it.each(issue13ExternalFixtures.map((definition) => [definition] as const))(
    "matches the $0.oracle oracle for $0.fixture",
    async (definition) => {
      const result = await runExtraction(definition.fixture, definition.file);
      expect(result.module).toEqual(readFixtureOracle(definition.fixture, oracleFile(definition)));
    }
  );

  it("has an exact zero-leaf-difference record for every immutable upstream oracle", async () => {
    if (!referenceAvailable) return;
    for (const definition of issue13ExternalFixtures) {
      if (definition.oracle !== "immutable-upstream") continue;
      const result = await runExtraction(definition.fixture, definition.file);
      const expected = Schema.decodeUnknownSync(Schema.Json)(
        JSON.parse(readFileSync(resolve(fixtureRoot, definition.fixture, "output.json"), "utf8"))
      );
      const actual = Schema.decodeUnknownSync(Schema.Json)(JSON.parse(JSON.stringify(result.module)));
      expect(canonicalDifferencePaths(expected, actual)).toEqual([]);
    }
  });

  it("has a current reviewed TS7 divergence record with its preserved upstream oracle", () => {
    const divergent = issue13ExternalFixtures.filter((definition) => definition.oracle === "reviewed-ts7");
    // Nine fixtures carry compiler-view divergence records; six reproduce the
    // upstream bytes outright.
    expect(divergent).toHaveLength(9);
    for (const definition of divergent) {
      expect(() => assertTs7DivergenceEvidence(definition.fixture)).not.toThrow();
    }
  });

  it("emits exactly the warnings each reviewed record declares", async () => {
    for (const definition of issue13ExternalFixtures) {
      const result = await runExtraction(definition.fixture, definition.file);
      const expectedCodes = [...issue13ExpectedWarnings[definition.fixture]].sort();
      const actualCodes = result.warnings.map((warning) => warning.code).sort();
      expect(actualCodes).toEqual(expectedCodes);
    }
  });

  it("covers every external-policy family with at least one ported fixture", () => {
    const families = new Set(issue13ExternalFixtures.map((definition) => definition.family));
    expect([...families].sort()).toEqual([
      "componentUnions",
      "exportForms",
      "externalConditional",
      "externalUnions",
      "handlers",
      "heritageOmit",
      "hooks",
      "namespaceSpecialization",
      "overloadDeduplication",
      "reexportNamespaces",
      "reexportTracking",
      "refs",
      "renderCallbacks",
    ]);
    const unchanged = issue13ExternalFixtures.filter(
      (definition) => definition.oracle === "immutable-upstream"
    );
    expect({
      total: issue13ExternalFixtures.length,
      unchanged: unchanged.length,
      reviewedDivergences: issue13ExternalFixtures.length - unchanged.length,
    }).toEqual({ total: 15, unchanged: 6, reviewedDivergences: 9 });
  });

  it("keeps the implementation contribution for a direct overloaded component export", async () => {
    const result = await runExtraction("react-component-overload-any-callback-deduplication", "input.tsx");
    const entry = result.module.exports.find((candidate) => candidate.name === "GenericComponent");
    if (entry?.type.kind !== "component") throw new Error("Expected GenericComponent component export");
    const items = entry.type.props.find((property) => property.name === "items")?.type;
    if (items?.kind !== "union") throw new Error("Expected overloaded items prop union");
    const itemValueArrays = items.types.filter(
      (member) =>
        member.kind === "array" &&
        member.elementType.kind === "typeParameter" &&
        member.elementType.name === "ItemValue"
    );
    // Direct exported functions intentionally retain the authored
    // implementation contribution; wrapper identifiers use public signatures.
    expect(itemValueArrays).toHaveLength(2);
  });
});

describe("Issue 13 external-type ownership policy in both modes", () => {
  it("keeps project-owned TypeScript-shaped declarations project-owned", async () => {
    const result = await runExtraction("issue-13-review", "input.ts");
    const exports = new Map(result.module.exports.map((entry) => [entry.name, entry]));
    expect(exports.get("ProjectArray")?.type).toMatchObject({
      kind: "object",
      typeName: { name: "Array" },
      properties: [{ name: "projectMarker" }],
    });
    expect(exports.get("ProjectReadonlyArray")?.type).toMatchObject({
      kind: "object",
      typeName: { name: "ReadonlyArray" },
      properties: [{ name: "projectMarker" }],
    });
    expect(exports.get("ProjectArray")?.type.kind).not.toBe("array");
    expect(exports.get("ProjectReadonlyArray")?.type.kind).not.toBe("array");
    // A project-owned `Extract` in a compiler-looking path must not trigger
    // the built-in conditional gate: its authored identity remains visible.
    expect(exports.get("ProjectExtractUse")?.type).toEqual({
      kind: "union",
      typeName: { name: "ProjectExtractUse" },
      types: [
        { kind: "literal", value: '"other"' },
        { kind: "literal", value: '"value"' },
      ],
    });
    expect(result.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["ProjectArray"],
          declarationPaths: ["test/fixtures/issue-13-review/src/typescript/lib/lib.dom.d.ts"],
        }),
        expect.objectContaining({
          path: ["ProjectReadonlyArray"],
          declarationPaths: ["test/fixtures/issue-13-review/src/@typescript/tsc/lib/lib.es2022.d.ts"],
        }),
      ])
    );
  });

  it("pins dependency-owned bare interface and value roots as anonymous empty objects", async () => {
    const result = await runExtraction("issue-13-review", "input.ts");
    const rootTypes = new Map(result.module.exports.map((entry) => [entry.name, entry.type]));

    expect(rootTypes.get("BareInterface")).toEqual({ kind: "object", properties: [] });
    expect(rootTypes.get("bareValue")).toEqual({ kind: "object", properties: [] });
    expect(
      result.module.exports.filter((entry) => entry.name === "BareInterface" || entry.name === "bareValue")
    ).toHaveLength(2);
    expect(result.provenance.some((entry) => entry.path[0] === "BareInterface")).toBe(false);
    expect(result.provenance.some((entry) => entry.path[0] === "bareValue")).toBe(false);
  });

  it("summarizes dependency-owned handlers as opaque references when expansion is disabled", async () => {
    const result = await runExtraction("react-event-handlers", "input.ts");
    const component = result.module.exports.find((entry) => entry.name === "EventHandlersComponent");
    if (component?.type.kind !== "component") throw new Error("the component transform vanished");
    const onClick = component.type.props.find((prop) => prop.name === "onClick");
    if (onClick === undefined) throw new Error("the onClick prop disappeared");
    // The dependency-owned alias keeps its package identity, authored name,
    // and provenance through its type arguments.
    expect(onClick.type).toMatchObject({
      kind: "external",
      typeName: { name: "MouseEventHandler", namespaces: ["React"] },
    } satisfies Partial<ExternalTypeNode>); // SAFETY: the summarized node is an external reference by policy.
    const onFocus = component.type.props.find((prop) => prop.name === "onFocus");
    if (onFocus?.type.kind !== "external") throw new Error("onFocus did not summarize");
    expect(onFocus.type.typeName.typeArguments?.[0]?.type).toMatchObject({
      kind: "external",
      typeName: { name: "HTMLDivElement" },
    });
  });

  it("resolves dependency-owned properties without losing the library/dependency boundary when expansion is enabled", async () => {
    const result = await runExtraction("react-event-handlers", "input.ts", {
      includeExternalTypes: true,
    });
    const component = result.module.exports.find((entry) => entry.name === "EventHandlersComponent");
    if (component?.type.kind !== "component") throw new Error("the component transform vanished");
    const onKeyDown = component.type.props.find((prop) => prop.name === "onKeyDown");
    if (onKeyDown === undefined) throw new Error("the onKeyDown prop disappeared");
    // The optional handler resolves as `KeyboardEventHandler<Element> |
    // undefined`; its first arm is a real callable carrying the expanded
    // dependency-owned signature.
    if (onKeyDown.type.kind !== "union" || onKeyDown.type.types[0]?.kind !== "function") {
      throw new Error("the dependency-owned handler was not resolved in expansion mode");
    }
    const [signature] = onKeyDown.type.types[0].callSignatures;
    if (signature === undefined) throw new Error("the expanded handler lost its signature");
    // Its event parameter is the EXPANDED React.KeyboardEvent object, not an
    // opaque reference: expansion mode opens the dependency graph under the
    // same traversal limits upstream applies.
    const eventParameter = signature.parameters[0];
    expect(eventParameter?.type).toMatchObject({
      kind: "object",
      typeName: { name: "KeyboardEvent", namespaces: ["React"] },
    });
  });

  it("expands a standard-library-owned property surface only when the option asks for it", async () => {
    const disabled = await runExtraction("react-refs", "input.tsx");
    const enabled = await runExtraction("react-refs", "input.tsx", {
      includeExternalTypes: true,
    });
    const propOf = (result: ExtractionResult, name: string) => {
      const component = result.module.exports.find((entry) => entry.name === "RefPropsComponent");
      if (component?.type.kind !== "component") throw new Error("the component vanished");
      const prop = component.type.props.find((candidate) => candidate.name === name);
      if (prop === undefined) throw new Error(`the ${name} prop disappeared`);
      return prop.type;
    };
    // refObject names React.RefObject: dependency-owned, so it summarizes…
    expect(propOf(disabled, "refObject").kind).toBe("external");
    // …and expands under the option.
    expect(propOf(enabled, "refObject").kind).not.toBe("external");
  });

  it("mirrors upstream's traversal limits for dependency graphs", () => {
    const limit = defaultExtractorOptions.shouldResolveObject;
    // Upstream's default (`parserContextFactory.ts`): expand at property depth
    // zero or while at most fifty properties are involved, and never past ten
    // intermediate types — the cap that keeps enabled-mode dependency graphs
    // bounded regardless of `includeExternalTypes`.
    expect(limit({ name: "", propertyCount: 51, depth: 1, propertyDepth: 1 })).toBe(false);
    expect(limit({ name: "", propertyCount: 50, depth: 10, propertyDepth: 1 })).toBe(true);
    expect(limit({ name: "", propertyCount: 50, depth: 11, propertyDepth: 1 })).toBe(false);
    expect(limit({ name: "", propertyCount: 4, depth: 3, propertyDepth: 0 })).toBe(true);
  });
});

describe("Issue 13 summarized references keep durable identity", () => {
  it("never exposes compiler paths or handles in extracted output", async () => {
    const result = await runExtraction("react-event-handlers", "input.ts");
    const serialized = JSON.stringify({ module: result.module, provenance: result.provenance });
    expect(serialized.includes("node_modules")).toBe(false);
    expect(serialized.includes("/lib/")).toBe(false);
    // Provenance paths are repository-relative; declaration paths of the
    // summarized externals stay out of the module graph entirely because the
    // reference carries names and arguments, not declarations.
    for (const warning of result.warnings) {
      expect(warning.message.includes("node_modules")).toBe(false);
    }
  });

  it("reports an unresolved dependency alias through the structured fallback contract", async () => {
    // The flattened Prettify member in this fixture has no representable
    // dependency-owned identity on TypeScript 7's checker view; it degrades to
    // `any` behind the structured warning instead of disappearing silently.
    const result = await runExtraction("external-union-type-name-preservation", "input.ts");
    const fallbacks = result.warnings.filter((warning) => warning.code === "unsupported-type-fallback");
    expect(fallbacks).toHaveLength(1);
    expect(fallbacks[0]?.message).toContain("Using any instead");
  });
});
