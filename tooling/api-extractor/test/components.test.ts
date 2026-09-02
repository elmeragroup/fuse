import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { ExtractionResult } from "../src/index.ts";
import { extractFixture, fixtureRoot } from "./support/extract.ts";

const tsconfigPath = resolve(fixtureRoot, "issue-11-tsconfig.json");

function runExtraction(fixture: string, file: string): Promise<ExtractionResult> {
  return extractFixture({ tsconfigPath }, resolve(fixtureRoot, fixture, file));
}

describe("basic component representation", () => {
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
