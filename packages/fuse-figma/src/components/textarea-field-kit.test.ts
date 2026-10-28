/**
 * Unit under test: the `Textarea field` set as the build produces it.
 * Oracle: the Figma field each cell must carry, read by hand from `field-variants.ts`,
 * `field-frame-variants.ts`, `textarea-field-variants.ts` and `field-frame.tsx`, and the copy of the
 * docs TextareaField Basic, Counter and Error demos.
 *
 * - The Field root is `flex flex-col gap-(--surface-gap-md) w-full`, 384px in the preview, and passes
 *   `data-invalid:text-error` to the children that set no color of their own.
 * - The heading row is `flex items-center justify-between gap-2`. The counter is `text-xs
 *   text-muted-foreground`, 12/16px, and shows `current/max`, `0/120` over the empty textarea.
 * - FieldFrame renders the label row, the control, the error and the description, in that order.
 *   Base UI renders the error only in an invalid Field.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  density,
  FILL,
  fixed,
  HUG,
  instancesIn,
  literal,
  outline,
  paint,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

/** A variant's root, by its state. */
function cell(state: string) {
  return variantRoot(spec, `textarea-field/state=${state}`);
}

describe("the Textarea field component set", () => {
  it("sits on the Textarea page in five states, with the counter behind a BOOLEAN that starts off", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "textarea-field");
    expect([set?.name, set?.page, set?.axes, set?.booleanProperties, set?.textProperties]).toEqual([
      "Textarea field",
      "page/textarea",
      [{ name: "state", values: ["rest", "focus", "disabled", "readonly", "invalid"] }],
      [{ name: "Counter", defaultValue: false }],
      [{ name: "Count", defaultValue: "0/120" }],
    ]);
  });

  it("stacks the heading row, the textarea and the description surface-gap-md apart, 384px wide", () => {
    const root = cell("rest");
    expect(root).toMatchObject({
      direction: "VERTICAL",
      sizing: { horizontal: fixed(literal(384)), vertical: HUG },
      itemSpacing: density("surface-gap-md"),
    });
    expect(root.fill).toBeUndefined();
    expect(outline(root.children)).toEqual([
      "label-row",
      "  label -> label/state=rest",
      "  counter",
      "    text",
      "textarea -> textarea/content=placeholder,state=rest",
      "description -> field-description/state=rest",
    ]);
  });

  it("spreads the label and the 12/16px muted counter across a filling row, 8px apart", () => {
    const [row] = cell("rest").children;
    expect(row).toMatchObject({
      kind: "frame",
      direction: "HORIZONTAL",
      sizing: { horizontal: FILL, vertical: HUG },
      primaryAlign: "SPACE_BETWEEN",
      counterAlign: "CENTER",
      itemSpacing: literal(8),
    });
    const counter = row?.kind === "frame" ? row.children[1] : undefined;
    expect(counter).toMatchObject({ kind: "frame", key: "counter", visibleProperty: "Counter" });
    expect(counter?.kind === "frame" ? counter.children[0] : undefined).toMatchObject({
      characters: "0/120",
      textProperty: "Count",
      fontSize: literal(12),
      lineHeight: literal(16),
      color: paint("muted-foreground"),
    });
  });

  it("fills the column with the textarea and the description, and gives each instance the demo's copy", () => {
    expect(
      instancesIn(cell("rest").children).map((layer) => [
        layer.key,
        layer.sizing.horizontal,
        layer.properties,
        layer.exposed,
      ])
    ).toEqual([
      ["label", HUG, { text: { Label: "Bio" } }, true],
      ["textarea", FILL, { text: { Text: "Write a short bio." } }, true],
      ["description", FILL, { text: { Text: "Shown to other users." } }, true],
    ]);
  });

  it("shows each state on the textarea, and dims the label only in a disabled Field", () => {
    expect(
      ["rest", "focus", "disabled", "readonly"].map((state) =>
        instancesIn(cell(state).children).map((layer) => layer.variant)
      )
    ).toEqual([
      ["label/state=rest", "textarea/content=placeholder,state=rest", "field-description/state=rest"],
      ["label/state=rest", "textarea/content=placeholder,state=focus", "field-description/state=rest"],
      ["label/state=disabled", "textarea/content=placeholder,state=disabled", "field-description/state=rest"],
      ["label/state=rest", "textarea/content=placeholder,state=readonly", "field-description/state=rest"],
    ]);
  });

  it("shows the error under the invalid textarea and turns the label's text `error`", () => {
    const root = cell("invalid");
    expect(outline(root.children)).toEqual([
      "label-row",
      "  label-invalid -> label/state=rest",
      "  counter",
      "    text",
      "textarea -> textarea/content=placeholder,state=invalid",
      "error -> field-error/state=invalid",
      "description-invalid -> field-description/state=rest",
    ]);
    const [label, , error] = instancesIn(root.children);
    expect(label).toMatchObject({
      overrides: [{ path: ["label"], field: "textColor", color: paint("error") }],
    });
    expect(error).toMatchObject({
      sizing: { horizontal: FILL, vertical: HUG },
      properties: { text: { Text: "Keep it under 120 characters." } },
    });
  });
});
