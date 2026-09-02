import { Effect, Schema } from "effect";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  canonicalDifferencePaths,
  issue11ReactFixtures,
  readFixtureOracle,
} from "../scripts/fixture-evidence.ts";
import { referenceAvailable, upstreamFixtureRoot } from "../scripts/reference.ts";
import { ProjectExtractor } from "../src/index.ts";
import type { ExtractionResult, ExtractorOptions } from "../src/index.ts";

const fixtureRoot = resolve(import.meta.dirname, "fixtures");
const tsconfigPath = resolve(fixtureRoot, "issue-11-tsconfig.json");

function runExtraction(fixture: string, file: string, options?: ExtractorOptions): Promise<ExtractionResult> {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const extractor = yield* ProjectExtractor;
        return yield* extractor.extractModule(resolve(fixtureRoot, fixture, file), options);
      }).pipe(Effect.provide(ProjectExtractor.live({ tsconfigPath })))
    )
  );
}

describe("Issue 11 ported React component fixtures", () => {
  it("keeps every copied input and upstream oracle byte-identical to e145350", () => {
    if (!referenceAvailable) return;
    for (const definition of issue11ReactFixtures) {
      for (const file of [definition.file, "output.json"]) {
        expect(readFileSync(resolve(fixtureRoot, definition.fixture, file), "utf8")).toBe(
          readFileSync(resolve(upstreamFixtureRoot, definition.fixture, file), "utf8")
        );
      }
    }
  });

  it.each(issue11ReactFixtures.map((definition) => [definition] as const))(
    "matches the upstream oracle for $0.fixture",
    async (definition) => {
      const result = await runExtraction(definition.fixture, definition.file);
      expect(result.module).toEqual(readFixtureOracle(definition.fixture, "output.json"));
    }
  );

  it("has an exact zero-leaf-difference record for every ported fixture", async () => {
    for (const definition of issue11ReactFixtures) {
      const result = await runExtraction(definition.fixture, definition.file);
      const expected = Schema.decodeUnknownSync(Schema.Json)(
        JSON.parse(readFileSync(resolve(fixtureRoot, definition.fixture, "output.json"), "utf8"))
      );
      const actual = Schema.decodeUnknownSync(Schema.Json)(JSON.parse(JSON.stringify(result.module)));
      expect(canonicalDifferencePaths(expected, actual)).toEqual([]);
    }
  });

  it("emits no recoverable warnings for the ported family", async () => {
    for (const definition of issue11ReactFixtures) {
      const result = await runExtraction(definition.fixture, definition.file);
      expect(result.warnings).toEqual([]);
    }
  });

  it("covers every basic-component recognition family with at least one ported fixture", () => {
    const families = new Set(issue11ReactFixtures.map((definition) => definition.family));
    expect([...families].sort()).toEqual([
      "componentOverloads",
      "declaration",
      "hooks",
      "props",
      "returnTypes",
      "variable",
    ]);
    // The whole family reproduces the immutable upstream oracles; the deferred
    // external-graph fixtures are recorded in the README instead.
    expect(issue11ReactFixtures).toHaveLength(10);
  });
});

describe("Issue 11 basic component representation", () => {
  it("reports components with only the upstream-compatible shape and squashed props", async () => {
    const result = await runExtraction("react-component-function-declaration", "input.tsx");
    const declared = result.module.exports.find((entry) => entry.name === "DeclaredComponent");
    expect(declared?.type).toEqual({
      kind: "component",
      typeName: { name: "DeclaredComponent" },
      props: [
        {
          name: "className",
          type: {
            kind: "union",
            types: [
              { kind: "intrinsic", intrinsic: "string" },
              { kind: "intrinsic", intrinsic: "undefined" },
            ],
          },
          optional: true,
        },
      ],
    });
  });

  it("keeps FC-annotated variables as named components through their callable surface", async () => {
    const result = await runExtraction("react-component-function-variable", "input.tsx");
    for (const [exportName, typeName] of [
      ["TestComponent1", "TestComponent"],
      ["TestComponent2", "FC"],
      ["TestComponent3", "FunctionComponent"],
    ] as const) {
      const entry = result.module.exports.find((candidate) => candidate.name === exportName);
      expect(entry?.type).toMatchObject({ kind: "component", typeName: { name: typeName } });
    }
  });

  it("squashes the props of every overload into one table exactly as upstream", async () => {
    const result = await runExtraction("react-component-function-overloads", "input.ts");
    const overloaded = result.module.exports.find((entry) => entry.name === "OverloadedComponent");
    if (overloaded?.type.kind !== "component") throw new Error("the overload squash disappeared");
    expect(overloaded.type.props.map((prop) => prop.name)).toEqual([
      "discriminant",
      "variant1Prop",
      "variant1OptionalProp",
      "mandatoryProp",
      "variant2Prop",
      "variant2OptionalProp",
    ]);
    // A prop required by one form and absent from the other becomes optional…
    const discriminant = overloaded.type.props.find((prop) => prop.name === "discriminant");
    expect(discriminant?.optional).toBe(true);
    // …while a prop both forms require stays required.
    const mandatory = overloaded.type.props.find((prop) => prop.name === "mandatoryProp");
    expect(mandatory?.optional).toBe(false);
  });
});
