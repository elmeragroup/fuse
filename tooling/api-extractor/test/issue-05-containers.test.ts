import { Effect, Schema } from "effect";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { ProjectExtractor } from "../src/index.ts";
import type { ExtractionResult } from "../src/index.ts";
import { ModuleNodeSchema } from "../src/model.ts";
import type { ExportNode, PropertyNode, SemanticType } from "../src/model.ts";
import { ProvenanceSchema } from "../src/provenance.ts";

const fixtureDirectory = resolve(import.meta.dirname, "fixtures/issue-05-containers");

let result: ExtractionResult;

beforeAll(async () => {
  result = await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const extractor = yield* ProjectExtractor;
        return yield* extractor.extractModule(resolve(fixtureDirectory, "input.ts"));
      }).pipe(
        Effect.provide(ProjectExtractor.live({ tsconfigPath: resolve(fixtureDirectory, "tsconfig.json") }))
      )
    )
  );
});

function exportedType(name: string): SemanticType {
  const entry = result.module.exports.find((candidate: ExportNode) => candidate.name === name);
  if (entry === undefined) throw new Error(`The fixture does not export ${name}`);
  return entry.type;
}

function property(owner: string, name: string): PropertyNode {
  const type = exportedType(owner);
  const properties = type.kind === "object" ? type.properties : [];
  const found = properties.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`${owner} has no property ${name}`);
  return found;
}

function propertyType(owner: string, name: string): SemanticType {
  return property(owner, name).type;
}

function provenanceFor(path: readonly string[]): { readonly synthesized: boolean } {
  const entry = result.provenance.find(
    (candidate) =>
      candidate.path.length === path.length &&
      candidate.path.every((segment, index) => segment === path[index])
  );
  if (entry === undefined) throw new Error(`No provenance entry for ${path.join("/")}`);
  return entry;
}

describe("Issue 05 container extraction through the public seam", () => {
  it("extracts mutable and readonly arrays with their element types and aliases", () => {
    const mutable = propertyType("Arrays", "mutable");
    expect(mutable).toMatchObject({
      kind: "array",
      elementType: { kind: "object", typeName: { name: "Element" } },
    });
    expect(mutable).not.toHaveProperty("isReadonly");
    expect(mutable).not.toHaveProperty("typeName");
    // `Array<T>` is the same anonymous container as `T[]`, so the authored
    // spelling never becomes a public name.
    expect(propertyType("Arrays", "mutableReference")).not.toHaveProperty("typeName");
    for (const name of ["readonlyOperator", "readonlyReference"]) {
      expect(propertyType("Arrays", name)).toMatchObject({ kind: "array", isReadonly: true });
    }
    expect(propertyType("Arrays", "nested")).toMatchObject({
      kind: "array",
      isReadonly: true,
      elementType: { kind: "array", isReadonly: true },
    });
    // Only an alias gives an array a public name.
    expect(propertyType("Arrays", "aliased")).toMatchObject({
      kind: "array",
      typeName: { name: "ElementList" },
    });
    expect(propertyType("Arrays", "aliased")).not.toHaveProperty("isReadonly");
  });

  it("extracts tuples with ordered elements, labels, optional and rest elements, and readonly state", () => {
    const plain = exportedType("Pair");
    expect(plain).toMatchObject({
      kind: "tuple",
      typeName: { name: "Pair" },
      types: [
        { kind: "intrinsic", intrinsic: "string" },
        { kind: "intrinsic", intrinsic: "number" },
      ],
    });
    // A label is authored metadata, not a distinct element type: the ordered
    // element list is identical with and without labels.
    expect(propertyType("Tuples", "labelled")).toEqual(propertyType("Tuples", "plain"));
    // An optional element carries `undefined` in its own element type.
    expect(propertyType("Tuples", "optional")).toMatchObject({
      kind: "tuple",
      types: [
        { kind: "intrinsic", intrinsic: "string" },
        {
          kind: "union",
          types: [
            { kind: "intrinsic", intrinsic: "number" },
            { kind: "intrinsic", intrinsic: "undefined" },
          ],
        },
      ],
    });
    // A rest element contributes its element type in the rest position.
    expect(propertyType("Tuples", "rest")).toMatchObject({
      kind: "tuple",
      types: [
        { kind: "intrinsic", intrinsic: "string" },
        { kind: "object", typeName: { name: "Element" } },
      ],
    });
    expect(propertyType("Tuples", "frozen")).toMatchObject({ kind: "tuple", isReadonly: true });
    expect(propertyType("Tuples", "plain")).not.toHaveProperty("isReadonly");
  });

  it("extracts records and finite mapped-key objects after canonicalization", () => {
    // An open `Record` stays an external reference with its arguments, exactly
    // as upstream reports it.
    expect(propertyType("Records", "open")).toMatchObject({
      kind: "external",
      typeName: { name: "Record" },
    });
    // A finite key domain is described by concrete properties, not a key type.
    const finite = exportedType("FiniteKeys");
    expect(finite).not.toHaveProperty("indexSignature");
    const finiteProperties = finite.kind === "object" ? finite.properties : [];
    expect(finiteProperties.map((entry) => [entry.name, entry.optional, entry.type.kind])).toEqual([
      ["a", true, "union"],
      ["b", true, "union"],
    ]);
    // A built-in utility over a finite key domain hides its library-declared
    // members, and still never manufactures a key type for them.
    const partial = propertyType("Records", "partial");
    expect(partial.kind).toBe("object");
    expect(partial).not.toHaveProperty("indexSignature");
    // An open mapped key domain is the case that becomes an index signature.
    expect(exportedType("SynthesizedKeys")).toMatchObject({
      kind: "object",
      properties: [],
      indexSignature: { keyName: "Name", keyType: "string" },
    });
  });

  it("extracts string and number index signatures and keeps optional value behavior", () => {
    expect(exportedType("StringIndexed")).toMatchObject({
      indexSignature: { keyName: "elementName", keyType: "string" },
    });
    expect(exportedType("NumberIndexed")).toMatchObject({
      indexSignature: { keyName: "position", keyType: "number" },
    });
    // An optional index value is representable, and reaches the model as the
    // union the checker produced.
    expect(exportedType("OptionalIndexed")).toMatchObject({
      indexSignature: {
        keyType: "string",
        valueType: {
          kind: "union",
          types: [{ kind: "object" }, { kind: "intrinsic", intrinsic: "undefined" }],
        },
      },
    });
    // A readonly index signature has no encoding in the semantic model, so it
    // reports the same shape as a mutable one rather than a different key.
    expect(exportedType("ReadonlyIndexed")).toEqual({
      ...exportedType("StringIndexed"),
      typeName: { name: "ReadonlyIndexed" },
    });
  });

  it("reports an unrepresentable symbol index signature as a structured warning", () => {
    expect(exportedType("SymbolIndexed")).not.toHaveProperty("indexSignature");
    const warnings = result.warnings.filter((warning) => warning.code === "omitted-index-signature");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ code: "omitted-index-signature", keyTypes: ["symbol"] });
    expect(warnings[0]?.parsedSymbolStack).toContain("SymbolIndexed");
    expect(warnings[0]?.message).toContain("symbol");
  });

  it("keeps recursive containers reporting their own kind when the cycle is cut", () => {
    expect(propertyType("RecursiveNode", "children")).toMatchObject({
      kind: "array",
      typeName: { name: "RecursiveList" },
      elementType: { kind: "object", typeName: { name: "RecursiveNode" }, properties: [] },
    });
    expect(propertyType("RecursiveNode", "siblings")).toMatchObject({
      kind: "tuple",
      isReadonly: true,
      types: [
        { kind: "object", properties: [] },
        { kind: "object", properties: [] },
      ],
    });
  });

  it("preserves documentation for container members", () => {
    expect(property("Arrays", "mutable").documentation?.description).toBe("Written with array syntax.");
    expect(property("Tuples", "frozen").documentation?.description).toBe("A readonly tuple.");
    const indexed = exportedType("StringIndexed");
    const value = indexed.kind === "object" ? indexed.indexSignature?.valueType : undefined;
    const documented =
      value?.kind === "object"
        ? value.properties.find((entry) => entry.name === "id")?.documentation?.description
        : undefined;
    expect(documented).toBe("The element's identifier.");
  });

  it("records provenance for container members and synthesized keys without compiler handles", () => {
    // A container is transparent in the provenance grammar: a property reached
    // through an array, a tuple, or an index signature keeps the container's
    // own path.
    expect(provenanceFor(["Arrays", "properties", "mutable", "properties", "id"]).synthesized).toBe(false);
    expect(provenanceFor(["Tuples", "properties", "plain", "properties", "id"]).synthesized).toBe(false);
    expect(provenanceFor(["StringIndexed", "properties", "id"]).synthesized).toBe(false);
    // An authored key is declared; a mapped type's key is synthesized.
    expect(provenanceFor(["StringIndexed", "indexSignature", "key"]).synthesized).toBe(false);
    expect(provenanceFor(["SynthesizedKeys", "indexSignature", "key"]).synthesized).toBe(true);
    const serialized = JSON.stringify(result.provenance);
    expect(serialized).not.toMatch(/"session"|"__handle"|"kind":"(?:type|symbol|node|type-node)"/u);
  });

  it("keeps the semantic output and provenance independently schema-decodable", () => {
    expect(() =>
      Schema.decodeUnknownSync(ModuleNodeSchema)(JSON.parse(JSON.stringify(result.module)))
    ).not.toThrow();
    expect(() =>
      Schema.decodeUnknownSync(ProvenanceSchema)(JSON.parse(JSON.stringify(result.provenance)))
    ).not.toThrow();
  });
});
