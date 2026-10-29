/**
 * Unit under test: the Popover sets `Popover content` and `Popover (open)` as the build produces them.
 * Oracle: the Figma field each cell must carry, read by hand from `popover-variants.ts`,
 * `inner-corner/popover.ts`, `overlay-classes.ts`, `field-variants.ts` and `button-variants.ts`, Base
 * UI's placement in `popover.tsx` (side bottom, offset 4, centered), and the popup Chromium measured on
 * the compare page on 2026-10-25: 288px wide.
 *
 * - The popup is `bg-popover`, `shadow-md` and `ring-1 ring-foreground/10`, `rounded-md`, padded
 *   `surface-pad-md`, `w-72` and `flex flex-col gap-4`, clipping as a variant root does.
 * - The header is `flex flex-col gap-1` at `text-sm`; the title is `font-medium`, the description
 *   `text-muted-foreground`.
 * - A vertical Field is `flex flex-col gap-1`; its label sets the label type pair at
 *   Medium; its input is `w-full` at the md control height.
 * - The open trigger is the outline Button, `aria-expanded:bg-muted aria-expanded:text-foreground`.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  density,
  FILL,
  fixed,
  HUG,
  literal,
  outline,
  paint,
  token,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

function set(key: string) {
  return spec.componentSets.find((candidate) => candidate.key === key);
}

describe("the Popover content component set", () => {
  it("sits on the Popover page with the demo's title, description and labels as properties", () => {
    const content = set("popover-content");
    expect([content?.name, content?.page, content?.axes, content?.textProperties]).toEqual([
      "Popover content",
      "page/popover",
      [{ name: "content", values: ["basic"] }],
      [
        { name: "Title", defaultValue: "Dimensions" },
        { name: "Description", defaultValue: "Set the dimensions for the layer." },
        { name: "Width label", defaultValue: "Width" },
        { name: "Height label", defaultValue: "Height" },
      ],
    ]);
  });

  it("draws the popup surface 288px wide, its parts 16px apart", () => {
    const root = variantRoot(spec, "popover-content/content=basic");
    expect(root).toMatchObject({
      direction: "VERTICAL",
      sizing: { horizontal: fixed(literal(288)), vertical: HUG },
      paddingTop: density("surface-pad-md"),
      paddingRight: density("surface-pad-md"),
      paddingBottom: density("surface-pad-md"),
      paddingLeft: density("surface-pad-md"),
      itemSpacing: literal(16),
      cornerRadius: token("radius-md"),
      fill: paint("popover"),
    });
    // `shadow-md` lists its 4px shadow before its 2px one, then the ring; Figma paints a later effect
    // above an earlier one (PE2), so the spec lists them reversed.
    expect(root.shadows).toEqual([
      {
        color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.1 } },
        offsetX: 0,
        offsetY: 2,
        radius: literal(4),
        spread: literal(-2),
      },
      {
        color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.1 } },
        offsetX: 0,
        offsetY: 4,
        radius: literal(6),
        spread: literal(-1),
      },
      { color: paint("foreground/10"), offsetX: 0, offsetY: 0, radius: literal(0), spread: literal(1) },
    ]);
    expect(outline(root.children)).toEqual([
      "header",
      "  title",
      "    text",
      "  description",
      "    text",
      "field-width",
      "  label-width",
      "    label",
      "  input-width -> input/content=value,state=rest",
      "field-height",
      "  label-height",
      "    label",
      "  input-height -> input/content=value,state=rest",
    ]);
  });

  it("stacks the title over the muted description 4px apart in 14px type", () => {
    const [header] = variantRoot(spec, "popover-content/content=basic").children;
    expect(header).toMatchObject({ sizing: { horizontal: FILL, vertical: HUG }, itemSpacing: literal(4) });
    const texts =
      header?.kind === "frame"
        ? header.children.map((part) => (part.kind === "frame" ? part.children[0] : undefined))
        : [];
    expect(texts).toEqual([
      expect.objectContaining({
        characters: "Dimensions",
        fontStyle: "Medium",
        fontSize: literal(14),
        lineHeight: literal(20),
        color: paint("popover-foreground"),
      }),
      expect.objectContaining({
        characters: "Set the dimensions for the layer.",
        fontStyle: "Regular",
        fontSize: literal(14),
        lineHeight: literal(20),
        color: paint("muted-foreground"),
      }),
    ]);
  });

  it("draws each Field as its label over an empty Input that fills it", () => {
    const fields = variantRoot(spec, "popover-content/content=basic").children.slice(1);
    expect(
      fields.map((field) => {
        if (field.kind !== "frame") {
          return undefined;
        }
        const [label, input] = field.children;
        return [
          field.itemSpacing,
          field.sizing,
          label?.kind === "frame" ? label.children[0] : undefined,
          input?.kind === "instance" ? [input.sizing, input.properties] : undefined,
        ];
      })
    ).toEqual(
      ["Width", "Height"].map((characters): readonly unknown[] => [
        literal(4),
        { horizontal: FILL, vertical: HUG },
        expect.objectContaining({
          characters,
          fontStyle: "Medium",
          fontSize: density("label-text"),
          lineHeight: density("label-leading"),
        }),
        [{ horizontal: FILL, vertical: fixed(density("control-h-md")) }, { text: { Text: "" } }],
      ])
    );
  });
});

describe("the Popover (open) component set", () => {
  it("centers the 288px popup 4px below the outline trigger, in a column that clips nothing", () => {
    const root = variantRoot(spec, "popover-open/placement=below");
    expect(root).toMatchObject({
      direction: "VERTICAL",
      sizing: { horizontal: HUG, vertical: HUG },
      itemSpacing: literal(4),
      counterAlign: "CENTER",
      clips: false,
    });
    expect(outline(root.children)).toEqual([
      "trigger -> button/variant=outline,size=default,state=rest,icon=none",
      "content -> popover-content/content=basic",
    ]);
    const [trigger, content] = root.children;
    expect([
      trigger?.kind === "instance" ? trigger.properties : undefined,
      content?.kind === "instance" ? content.sizing.horizontal : undefined,
    ]).toEqual([{ text: { Label: "Details" } }, fixed(literal(288))]);
  });

  // `bg-muted` fills the transparent rest face; the rest face's text already inherits the page's
  // `foreground`, so only the fill differs.
  it("paints the open trigger's expanded face as a fill override", () => {
    const [trigger] = variantRoot(spec, "popover-open/placement=below").children;
    const rest = variantRoot(spec, "button/variant=outline,size=default,state=rest,icon=none");
    expect([rest.fill, rest.children[0]]).toEqual([
      undefined,
      expect.objectContaining({ color: paint("foreground") }),
    ]);
    expect(trigger?.kind === "instance" ? trigger.overrides : undefined).toEqual([
      { path: [], field: "fill", color: paint("muted") },
    ]);
  });
});
