/**
 * Unit under test: the `Text field` set as the build produces it.
 * Oracle: the Figma field each cell must carry, read by hand from `field-variants.ts`,
 * `field-frame-variants.ts`, `text-field-variants.ts`, `field-frame.tsx` and `text-field.tsx`, the
 * docs TextField Basic and Error demos, and Chromium's layout of TextField at both densities on
 * 2026-10-27:
 *
 * - The root is `group/field flex flex-col w-full` with FieldFrame's `gap-1` over Field's own gap,
 *   4px, 384px in the preview. It passes `data-invalid:text-error` to the label.
 * - The heading row is `flex items-center justify-between` around the lone label, packed at its start.
 * - TextField's content wrapper is `flex flex-col gap-1`, 4px. It holds the input's `relative`
 *   container, a block box that Chromium measured exactly as wide and tall as its input (384 by 36
 *   dense, 384 by 44 comfortable), then the error in an invalid Field and the description.
 * - The input is `w-full` at `control-h-md`.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, density, FILL, fixed, HUG, literal, paint, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { ChildLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

/** Each layer's key, and the variant it shows where it is an instance, depth first. */
function outline(layers: readonly ChildLayerSpec[], depth = 0): readonly string[] {
  return layers.flatMap((layer) => [
    `${"  ".repeat(depth)}${layer.key}${layer.kind === "instance" ? ` -> ${layer.variant}` : ""}`,
    ...(layer.kind === "frame" ? outline(layer.children, depth + 1) : []),
  ]);
}

/** A variant's root, by its content and state. */
function cell(content: string, state: string) {
  return variantRoot(spec, `text-field/content=${content},state=${state}`);
}

/** The layer at a path of keys below a root. */
function at(layers: readonly ChildLayerSpec[], ...keys: readonly string[]): ChildLayerSpec | undefined {
  const [key, ...rest] = keys;
  const layer = layers.find((candidate) => candidate.key === key);
  return rest.length === 0 || layer?.kind !== "frame" ? layer : at(layer.children, ...rest);
}

describe("the Text field component set", () => {
  it("sits on the Input page, holding the placeholder or a value in Input's five states", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "text-field");
    expect([set?.name, set?.page, set?.axes, set?.booleanProperties ?? [], set?.textProperties]).toEqual([
      "Text field",
      "page/input",
      [
        { name: "content", values: ["placeholder", "value"] },
        { name: "state", values: ["rest", "focus", "disabled", "readonly", "invalid"] },
      ],
      [],
      [],
    ]);
  });

  it("stacks the heading row and the content 4px apart, 384px wide", () => {
    const root = cell("placeholder", "rest");
    expect(root).toMatchObject({
      direction: "VERTICAL",
      sizing: { horizontal: fixed(literal(384)), vertical: HUG },
      itemSpacing: literal(4),
    });
    expect(root.fill).toBeUndefined();
    expect(outline(root.children)).toEqual([
      "label-row",
      "  label -> label/state=rest",
      "content",
      "  input-container",
      "    input -> input/content=placeholder,state=rest",
      "  description -> field-description/state=rest",
    ]);
    expect(at(root.children, "label-row")).toMatchObject({
      sizing: { horizontal: FILL, vertical: HUG },
      primaryAlign: "MIN",
    });
  });

  it("fills the content column 4px apart with the input's container, which the input fills at the control height", () => {
    const root = cell("placeholder", "rest");
    expect(at(root.children, "content")).toMatchObject({
      direction: "VERTICAL",
      sizing: { horizontal: FILL, vertical: HUG },
      itemSpacing: literal(4),
    });
    expect(at(root.children, "content", "input-container")).toMatchObject({
      direction: "VERTICAL",
      sizing: { horizontal: FILL, vertical: HUG },
    });
    expect(at(root.children, "content", "input-container", "input")).toMatchObject({
      kind: "instance",
      sizing: { horizontal: FILL, vertical: fixed(density("control-h-md")) },
      exposed: true,
    });
  });

  it("shows each state and content on the input, and dims the label only in a disabled Field", () => {
    const variants = (content: string, state: string) =>
      outline(cell(content, state).children).filter((line) => line.includes("->"));
    expect([variants("value", "readonly"), variants("value", "disabled")]).toEqual([
      [
        "  label -> label/state=rest",
        "    input -> input/content=value,state=readonly",
        "  description -> field-description/state=rest",
      ],
      [
        "  label -> label/state=disabled",
        "    input -> input/content=value,state=disabled",
        "  description-disabled -> field-description/state=rest",
      ],
    ]);
  });

  it("shows the error under the invalid input and turns the label's text `error`", () => {
    const root = cell("placeholder", "invalid");
    expect(outline(root.children)).toEqual([
      "label-row",
      "  label-invalid -> label/state=rest",
      "content",
      "  input-container",
      "    input -> input/content=placeholder,state=invalid",
      "  error -> field-error/state=invalid",
      "  description-invalid -> field-description/state=rest",
    ]);
    expect(at(root.children, "label-row", "label-invalid")).toMatchObject({
      overrides: [{ path: ["label"], field: "textColor", color: paint("error") }],
    });
  });
});
