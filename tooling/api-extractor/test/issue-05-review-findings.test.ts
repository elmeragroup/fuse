import { Schema } from "effect";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import type { ExtractionResult, ExtractorOptions } from "../src/index.ts";
import { ModuleNodeSchema } from "../src/model.ts";
import type { ExportNode, SemanticType } from "../src/model.ts";
import { extractFixture } from "./support/extract.ts";

const fixtureDirectory = resolve(import.meta.dirname, "fixtures/issue-05-review");

function extract(options: ExtractorOptions, file = "input.ts"): Promise<ExtractionResult> {
  return extractFixture(
    { tsconfigPath: resolve(fixtureDirectory, "tsconfig.json") },
    resolve(fixtureDirectory, file),
    options
  );
}

let result: ExtractionResult;
let external: ExtractionResult;
let shadowed: ExtractionResult;

beforeAll(async () => {
  result = await extract({});
  external = await extract({ includeExternalTypes: true });
  shadowed = await extract({}, "shadowed.ts");
});

function exportedType(extraction: ExtractionResult, name: string): SemanticType {
  const entry = extraction.module.exports.find((candidate: ExportNode) => candidate.name === name);
  if (entry === undefined) throw new Error(`The fixture does not export ${name}`);
  return entry.type;
}

function tupleElements(name: string): readonly SemanticType[] {
  const type = exportedType(result, name);
  if (type.kind !== "tuple") throw new Error(`${name} is a ${type.kind}, not a tuple`);
  return type.types;
}

function propertyType(extraction: ExtractionResult, owner: string, name: string): SemanticType {
  const type = exportedType(extraction, owner);
  const properties = type.kind === "object" ? type.properties : [];
  const found = properties.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`${owner} has no property ${name}`);
  return found.type;
}

const keyofTarget = {
  kind: "typeOperator",
  operator: "keyof",
  type: { kind: "typeParameter", name: "Target" },
};

describe("Issue 05 review regressions", () => {
  it("maps an open rest element to the array's element syntax, not to the array", () => {
    // `[string, ...(keyof Target)[]]` has two semantic elements and two authored
    // positions, but the rest position was written as the *array*. Attaching
    // that array to the `keyof Target` element used to re-enter the element type
    // and report an empty object with no warning at all.
    expect(tupleElements("OpenRestKeys")[1]).toMatchObject(keyofTarget);
    // The built-in array reference spelling reaches the same element syntax.
    expect(tupleElements("OpenRestKeysReference")[1]).toMatchObject(keyofTarget);
    expect(tupleElements("OpenRestKeys")[1]).toEqual(tupleElements("OpenRestKeysReference")[1]);
  });

  it("keeps a rest element of a nested array reporting the array it spreads", () => {
    // `[string, ...Element[][]]` spreads an array *of arrays*: one element down
    // is still an array, and the element syntax has to travel with it.
    expect(tupleElements("NestedRest")[1]).toMatchObject({
      kind: "array",
      elementType: { kind: "object", typeName: { name: "Element" } },
    });
  });

  it("expands a finite inline spread into the authored elements it contributes", () => {
    // `[boolean, ...[keyof Target, number]]` is three semantic elements against
    // two authored positions; aligning by width recovers the exact syntax each
    // element was written as, which is what upstream's selection plan does.
    const elements = tupleElements("FiniteSpreadKeys");
    expect(elements).toHaveLength(3);
    expect(elements[0]).toMatchObject({ kind: "intrinsic", intrinsic: "boolean" });
    expect(elements[1]).toMatchObject(keyofTarget);
    expect(elements[2]).toMatchObject({ kind: "intrinsic", intrinsic: "number" });
    // The spread reports the same elements as writing the tuple out directly.
    expect(elements.slice(1)).toEqual(tupleElements("SpreadTail"));
  });

  it("replays a generic tuple alias spread through its rebound parameters", () => {
    // A generic tuple alias describes its elements in terms of its *own*
    // parameters. The resolver rebinds those parameters to the written
    // arguments — upstream's deriveTypeParameterBindings — so the spread
    // donates real element syntax (`SpreadTail<Target>` expands to the key set
    // and `number`) instead of falling back to an unlabelled open rest.
    const aliased = tupleElements("AliasedSpread");
    expect(aliased[0]).toEqual({ kind: "intrinsic", intrinsic: "boolean" });
    expect(aliased[1]).toMatchObject(keyofTarget);
    expect(aliased[2]).toEqual({ kind: "intrinsic", intrinsic: "number" });
    // The uninstantiated declaration bodies themselves fall back honestly:
    // with no arguments written there is nothing to bind `Target` to, so the
    // checker cannot reduce `keyof Target`. Since Issue 09's index-like
    // fallback mirrors upstream's `resolveIndexLikeType`, that degradation is
    // silent (`any`, with no authored expression left to preserve) instead of
    // a structured warning.
    expect(
      result.warnings.filter(
        (warning) => warning.code === "unsupported-type-fallback" && warning.typeText === "keyof Target"
      ).length
    ).toBe(0);
  });

  it("never converts an index type into a silent empty object when its operator was not authored", () => {
    // `[Keys<Target>]` names an alias whose body is a `keyof`. Resolving the
    // element again would re-enter the type that is already being resolved and
    // hit the cycle cut, which reported `{}` with no warning.
    const element = tupleElements("AliasedKeys")[0];
    expect(element).toMatchObject({ ...keyofTarget, typeName: { name: "Keys" } });
    expect(element).not.toMatchObject({ kind: "object", properties: [] });
  });

  it("keeps authored names on library interfaces when external types are included", () => {
    expect(propertyType(external, "LibraryContainers", "promise")).toMatchObject({
      typeName: { name: "Promise", typeArguments: [{ type: { kind: "intrinsic", intrinsic: "string" } }] },
    });
    expect(propertyType(external, "LibraryContainers", "lookup")).toMatchObject({
      typeName: { name: "Map" },
    });
    // A library *alias* the checker resolved away still has no public name: the
    // model describes the tuple it produced, not the alias that is gone.
    const parameters = propertyType(external, "LibraryContainers", "parameters");
    expect(parameters.kind).toBe("tuple");
    expect(parameters).not.toHaveProperty("typeName");
    // The same names are reported when external members stay hidden.
    expect(propertyType(result, "LibraryContainers", "promise")).toMatchObject({
      kind: "external",
      typeName: { name: "Promise" },
    });
  });

  it("distinguishes an unrepresentable index key from a representable one that lost the single slot", () => {
    const omitted = result.warnings.filter((warning) => warning.code === "omitted-index-signature");
    expect(omitted.map((warning) => [warning.reason, warning.keyTypes])).toEqual([
      ["additional-signature", ["number"]],
      ["unrepresentable-key", ["symbol"]],
    ]);
    const [tieLoss, unrepresentable] = omitted;
    // A number key is representable; only the model's single signature slot is
    // not, and the message has to say so.
    expect(tieLoss?.message).toContain("output model supports one");
    expect(tieLoss?.message).toContain('key type "number"');
    expect(unrepresentable?.message).toContain('uses unsupported key type "symbol"');
    // The representable signature is the one the model kept.
    expect(exportedType(result, "DualIndexed")).toMatchObject({
      indexSignature: { keyName: "name", keyType: "string" },
    });
  });

  it("never lets a non-built-in reference name an array's element", () => {
    // `type StringArray<Item> = string[]` is an array whose authored syntax
    // names `Item`. Handing that argument to the element used to publish a
    // string element called `Marker`, with no warning at all. Upstream gates the
    // same branch on `getBuiltInArrayReferenceName`.
    const elements = exportedType(shadowed, "MislabeledElements");
    expect(elements).toMatchObject({
      kind: "array",
      elementType: { kind: "intrinsic", intrinsic: "string" },
    });
    expect(elements.kind === "array" ? elements.elementType : undefined).not.toHaveProperty("typeName");
    // The array reached through a rest position reports the same element.
    const rest = exportedType(shadowed, "MislabeledRestElements");
    expect(rest).toMatchObject({
      kind: "tuple",
      types: [{ intrinsic: "boolean" }, { kind: "intrinsic", intrinsic: "string" }],
    });
    expect(rest.kind === "tuple" ? rest.types[1] : undefined).not.toHaveProperty("typeName");
  });

  it("verifies the built-in array reference through the checker instead of its name text", () => {
    // The fixture imports project declarations literally named `Array` and
    // `ReadonlyArray`, which shadow the global names in that file. A name-text
    // gate accepts them and replays element syntax belonging to another type;
    // the checker-verified fact (interface, declared in a TypeScript lib file)
    // does not. Both container paths use the same fact.
    const array = exportedType(shadowed, "ShadowedArrayElements");
    expect(array).toMatchObject({ kind: "array", elementType: { kind: "intrinsic", intrinsic: "string" } });
    expect(array.kind === "array" ? array.elementType : undefined).not.toHaveProperty("typeName");
    const rest = exportedType(shadowed, "ShadowedRestElements");
    expect(rest.kind === "tuple" ? rest.types[1] : undefined).toEqual({
      kind: "intrinsic",
      intrinsic: "string",
    });
  });

  it("never reports a container's elements as its alias name's type arguments", () => {
    // A parameterless alias has no type arguments, but its checker type is a
    // reference to the tuple or array target whose type arguments are its
    // ELEMENTS. Upstream guards with `if (type.aliasSymbol &&
    // !type.aliasTypeArguments) typeArguments = []` (common.ts).
    expect(exportedType(result, "Pair")).toEqual({
      kind: "tuple",
      typeName: { name: "Pair" },
      types: [
        { kind: "intrinsic", intrinsic: "string" },
        { kind: "intrinsic", intrinsic: "number" },
      ],
    });
    // A *generic* alias does have arguments, and upstream reports the element
    // list as those arguments — the ported `mapped-tuple-rest-synthetic-key`
    // oracle pins `Rest<V> = [V, V]` with `typeArguments: [V, V]`.
    expect(exportedType(result, "GenericPair")).toMatchObject({
      typeName: {
        name: "GenericPair",
        typeArguments: [{ type: { kind: "typeParameter", name: "Item" } }, { type: { intrinsic: "number" } }],
      },
    });
    // An authored reference to a different symbol than the alias keeps the
    // arguments it was written with, which is upstream's first branch and what
    // the ported `readonly-array-mapped-type-literal-key` oracle shows for
    // `DirectData = ReadonlyArray<{...}>`.
    expect(exportedType(result, "Names")).toMatchObject({
      kind: "array",
      typeName: { name: "Names", typeArguments: [{ type: { intrinsic: "string" } }] },
    });
    expect(exportedType(result, "InstantiatedPair")).toMatchObject({
      typeName: { name: "GenericPair", typeArguments: [{ type: { intrinsic: "string" } }] },
    });
  });

  it("resolves a keyof to its key set, not to its operand", () => {
    // Upstream's `resolveTypeOperatorResult` resolves the KEY SET: a generic
    // `keyof Target` has none, so its base constraint stands in and the result
    // says so. The upstream fixture `unresolved-indexed-access-fallback` pins
    // exactly this union and `resolutionKind`.
    expect(exportedType(result, "Keys")).toEqual({
      kind: "typeOperator",
      operator: "keyof",
      type: { kind: "typeParameter", name: "Target" },
      resolvedType: {
        kind: "union",
        types: [
          { kind: "intrinsic", intrinsic: "string" },
          { kind: "intrinsic", intrinsic: "number" },
          { kind: "intrinsic", intrinsic: "symbol" },
        ],
      },
      resolutionKind: "baseConstraint",
    });
    // A concrete operand leaves the checker with a key set it can name, which
    // is reported exactly — as the operator's own `resolvedType` since Issue
    // 09's operator-first reconstruction (upstream runs `resolveTypeOperatorType`
    // before every broad resolver, so the authored expression survives with its
    // reduced key set attached instead of collapsing to the bare literal).
    expect(exportedType(result, "ElementKeys")).toEqual({
      kind: "typeOperator",
      operator: "keyof",
      type: { kind: "object", typeName: { name: "Element" }, properties: [] },
      resolvedType: { kind: "literal", value: '"id"' },
      resolutionKind: "exact",
    });
  });

  it("keeps the reviewed output schema-decodable", () => {
    expect(() =>
      Schema.decodeUnknownSync(ModuleNodeSchema)(JSON.parse(JSON.stringify(result.module)))
    ).not.toThrow();
  });
});
