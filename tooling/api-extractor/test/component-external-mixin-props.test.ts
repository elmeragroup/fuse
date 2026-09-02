import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { ComponentNode, ExtractionResult } from "../src/index.ts";
import { extractFixture, fixtureRoot } from "./support/extract.ts";

const fixtureDirectory = resolve(fixtureRoot, "component-external-mixin-props");
const tsconfigPath = resolve(fixtureDirectory, "tsconfig.json");
const inputPath = resolve(fixtureDirectory, "input.tsx");
const mixinPackage = "@fixture/render";

function widget(result: ExtractionResult): ComponentNode {
  const entry = result.module.exports.find((candidate) => candidate.name === "Widget");
  if (entry?.type.kind !== "component") throw new Error("Expected Widget to be recognized as a component");
  return entry.type;
}

describe("component props mixed in from a dependency-owned intersection member", () => {
  it("squashes the mixin's prop with its documentation and provenance when the package is selected", async () => {
    const result = await extractFixture({ tsconfigPath }, inputPath, {
      includeExternalTypes: [mixinPackage],
    });
    const props = widget(result).props;

    expect(props.map((property) => property.name)).toEqual(expect.arrayContaining(["level", "render"]));
    const render = props.find((property) => property.name === "render");
    expect(render?.optional).toBe(true);
    expect(render?.documentation?.description).toBe("Replaces the rendered element.");
    expect(render?.type.kind).toBe("union");
    expect(result.warnings).toEqual([]);

    const provenance = result.provenance.find(
      (entry) => JSON.stringify(entry.path) === JSON.stringify(["Widget", "props", "render"])
    );
    expect(provenance?.declarations).toEqual([
      {
        path: "test/fixtures/component-external-mixin-props/node_modules/@fixture/render/index.d.ts",
        owner: { kind: "dependency", packageName: mixinPackage },
      },
    ]);
  });

  it("squashes a prop the checker derives from an unselected mapped alias over the project's own table", async () => {
    const result = await extractFixture({ tsconfigPath }, inputPath, {
      includeExternalTypes: [mixinPackage],
    });
    const props = widget(result).props;

    // `Variants<typeof widgetVariants>` stays an external reference (its
    // package is not selected), but the `size` prop it produces is keyed by
    // the project's own table, so the intersection's merged property list
    // carries it and the squash must not drop it.
    const size = props.find((property) => property.name === "size");
    expect(size?.optional).toBe(true);
    const members = size?.type.kind === "union" ? size.type.types : [];
    expect(members).toContainEqual({ kind: "literal", value: '"sm"' });
    expect(members).toContainEqual({ kind: "literal", value: '"lg"' });
    expect(result.warnings).toEqual([]);
    expect(
      result.provenance.some(
        (entry) => JSON.stringify(entry.path) === JSON.stringify(["Widget", "props", "size"])
      )
    ).toBe(true);
  });

  it("squashes a union arm's own prop even when the arm's merged view dropped it as co-declared by React", async () => {
    const result = await extractFixture({ tsconfigPath }, inputPath, {
      includeExternalTypes: [mixinPackage],
    });
    const entry = result.module.exports.find((candidate) => candidate.name === "LabelledWidget");
    if (entry?.type.kind !== "component") throw new Error("Expected LabelledWidget to be a component");
    const props = new Map(entry.type.props.map((property) => [property.name, property]));

    // The second arm declares `aria-label` itself, but the checker merges that
    // declaration with React's `AriaAttributes` one; the arm's aggregate
    // property list omits the merged symbol because `@types/react` is not
    // selected. The arm's own object member still names it, so it is a prop.
    expect(props.get("icon")?.optional).toBe(true);
    expect(props.get("aria-label")).toMatchObject({ optional: true });
    expect(props.get("aria-label")?.documentation).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it("keeps a component-object member's prop provenance on the prop's own declaration", async () => {
    const result = await extractFixture({ tsconfigPath }, inputPath, {
      includeExternalTypes: [mixinPackage],
    });
    const paths = result.provenance.map((entry) => JSON.stringify(entry.path));
    const render = result.provenance.find(
      (entry) =>
        JSON.stringify(entry.path) === JSON.stringify(["Toolkit", "properties", "Widget", "props", "render"])
    );

    // The render callback's parameter is declared in a second file of the
    // dependency. It keeps its own nested entry instead of being folded into
    // the prop's declaration list, so the prop names exactly one declaration.
    expect(render?.declarations).toEqual([
      {
        path: "test/fixtures/component-external-mixin-props/node_modules/@fixture/render/index.d.ts",
        owner: { kind: "dependency", packageName: mixinPackage },
      },
    ]);
    expect(paths).toContain(
      JSON.stringify([
        "Toolkit",
        "properties",
        "Widget",
        "props",
        "render",
        "callSignatures",
        "0",
        "parameters",
        "props",
      ])
    );
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("reports the anonymous mixin member as unsupported when the package is not selected", async () => {
    const result = await extractFixture({ tsconfigPath }, inputPath);
    const props = widget(result).props;

    // The member has no name an external reference could carry, so the
    // extractor keeps the structured warning instead of inventing a shape.
    // The project-keyed `size` prop does not depend on the selection.
    expect(props.map((property) => property.name)).toEqual(["level", "size"]);
    expect(result.warnings.length).toBeGreaterThan(0);
    for (const warning of result.warnings) {
      expect(warning.code).toBe("unsupported-type-fallback");
      expect(warning.message).toContain("render?:");
    }
  });
});
