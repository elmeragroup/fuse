/**
 * Unit under test: the `Select field` set as the build produces it.
 * Oracle: the Figma field each cell must carry, read by hand from `field-variants.ts`,
 * `field-frame-variants.ts`, `field-frame.tsx` and `select-field.tsx`, and the copy of the docs
 * SelectField Basic, Form and States demos.
 *
 * - SelectField's FieldFrame uses part spacing: the root is `group/field flex flex-col w-full` with
 *   FieldFrame's `gap-1` over Field's own gap, 4px, and 384px in the preview. It passes
 *   `data-invalid:text-error` to the children that set no color of their own.
 * - The heading row is `flex items-center justify-between` around the lone label, which
 *   `space-between` packs at the start (CSS Box Alignment 3 §5.3).
 * - The trigger takes `w-full`, so it fills the Field: the `width=fill` variant of Select trigger.
 * - FieldFrame renders the label row, the control, the error and the description, in that order.
 *   Base UI renders the error only in an invalid Field.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, FILL, fixed, HUG, literal, paint, variantRoot } from "../../test/built-kit";
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

/** A variant's root, by its state and content. */
function cell(state: string, content: string) {
  return variantRoot(spec, `select-field/state=${state},content=${content}`);
}

/** The instance layers below a root, depth first. */
function instances(layers: readonly ChildLayerSpec[]): readonly ChildLayerSpec[] {
  return layers.flatMap((layer) =>
    layer.kind === "instance" ? [layer] : layer.kind === "frame" ? instances(layer.children) : []
  );
}

describe("the Select field component set", () => {
  it("sits on the Select page in four states, holding the placeholder or a value", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "select-field");
    // The set adds no property of its own: its instances carry the text a designer sets.
    expect([set?.name, set?.page, set?.axes, set?.booleanProperties ?? [], set?.textProperties]).toEqual([
      "Select field",
      "page/select",
      [
        { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
        { name: "content", values: ["placeholder", "value"] },
      ],
      [],
      [],
    ]);
  });

  it("stacks the label, the filling trigger and the description 4px apart, 384px wide", () => {
    const root = cell("rest", "placeholder");
    expect(root).toMatchObject({
      direction: "VERTICAL",
      sizing: { horizontal: fixed(literal(384)), vertical: HUG },
      itemSpacing: literal(4),
    });
    expect(root.fill).toBeUndefined();
    expect(outline(root.children)).toEqual([
      "label-row",
      "  label -> label/state=rest",
      "trigger -> select-trigger/width=fill,size=default,state=rest,content=placeholder,open=off",
      "description -> field-description/state=rest",
    ]);
    expect(root.children[0]).toMatchObject({
      kind: "frame",
      sizing: { horizontal: FILL, vertical: HUG },
      primaryAlign: "MIN",
    });
  });

  it("gives the trigger the placeholder or the selected plan, and each instance the demo's copy", () => {
    expect(
      ["placeholder", "value"].map((content) =>
        instances(cell("rest", content).children).map((layer) =>
          layer.kind === "instance"
            ? [layer.key, layer.sizing.horizontal, layer.properties, layer.exposed]
            : []
        )
      )
    ).toEqual([
      [
        ["label", HUG, { text: { Label: "Plan" } }, true],
        ["trigger", FILL, { text: { Value: "Choose a plan" } }, true],
        ["description", FILL, { text: { Text: "You can change plan later." } }, true],
      ],
      [
        ["label", HUG, { text: { Label: "Plan" } }, true],
        ["trigger", FILL, { text: { Value: "Pro" } }, true],
        ["description", FILL, { text: { Text: "You can change plan later." } }, true],
      ],
    ]);
  });

  it("shows each state on the trigger, and dims the label only in a disabled Field", () => {
    expect(
      ["rest", "focus", "disabled"].map((state) =>
        instances(cell(state, "value").children).map((layer) =>
          layer.kind === "instance" ? layer.variant : ""
        )
      )
    ).toEqual([
      [
        "label/state=rest",
        "select-trigger/width=fill,size=default,state=rest,content=value,open=off",
        "field-description/state=rest",
      ],
      [
        "label/state=rest",
        "select-trigger/width=fill,size=default,state=focus,content=value,open=off",
        "field-description/state=rest",
      ],
      [
        "label/state=disabled",
        "select-trigger/width=fill,size=default,state=disabled,content=value,open=off",
        "field-description/state=rest",
      ],
    ]);
  });

  it("shows the error under the invalid trigger and turns the label's text `error`", () => {
    const root = cell("invalid", "placeholder");
    expect(outline(root.children)).toEqual([
      "label-row",
      "  label-invalid -> label/state=rest",
      "trigger -> select-trigger/width=fill,size=default,state=invalid,content=placeholder,open=off",
      "error -> field-error/state=invalid",
      "description-invalid -> field-description/state=rest",
    ]);
    const [label, , error] = instances(root.children);
    expect(label).toMatchObject({
      overrides: [{ path: ["label"], field: "textColor", color: paint("error") }],
    });
    expect(error).toMatchObject({
      sizing: { horizontal: FILL, vertical: HUG },
      properties: { text: { Text: "Choose a plan to continue." } },
    });
  });
});
