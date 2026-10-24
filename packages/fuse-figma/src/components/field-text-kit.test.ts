/**
 * Unit under test: the Field description, error, legend and title component sets as the build
 * produces them. Oracle: the Fuse variable or literal each Figma field of a cell must carry, read by
 * hand from the `description`, `error`, `legend` and `title` slots of `field-variants.ts`,
 * `label-type.ts` and Tailwind's `text-base`, and the docs Field demos' copy. The description is a
 * `<p>` and the error and the legend are `<div>`s, block boxes the browser's default style sheet
 * makes them, so each fills the 384px the Field around it gives it, the width Input and Textarea
 * draw, and wraps its text there. The title is a `w-fit` flex row that hugs its text with an 8px gap,
 * as Label does.
 *
 * - The description sets the label type pair at Regular in `muted-foreground`, its lines at the
 *   left.
 * - The error sets the label type pair at Regular in `error`, in an invalid Field.
 * - The legend sets Medium in the page's `foreground`, at Tailwind's `text-base`, 16/24px, or at the
 *   label type pair in its `label` variant.
 * - The title sets the label type pair at Medium in the page's `foreground`, and a disabled Field
 *   dims it to 50% through `group-data-disabled/field:opacity-50`.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  CENTERED_BOX,
  density,
  FILL,
  fixed,
  HUG,
  HUGGING_LABEL,
  literal,
  paint,
  token,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";
import type { NumberSpec, TextLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

function set(key: string) {
  return spec.componentSets.find((candidate) => candidate.key === key);
}

/** A text's type: its Figma style, its size and its line height. */
type Type = {
  readonly fontStyle: string;
  readonly fontSize: NumberSpec;
  readonly lineHeight: NumberSpec;
};

/** The label type pair, 14/20px dense and 16/24px comfortable, at a weight. */
const labelType = (fontStyle: string): Type => ({
  fontStyle,
  fontSize: density("label-text"),
  lineHeight: density("label-leading"),
});

/** How a text sizes and sets its lines in its box. */
type Layout = Pick<TextLayerSpec, "sizing" | "align">;

/** The `Text` property's text in a type and color, with the sizing and alignment it takes. */
const text = (characters: string, type: Type, color: string, layout: Layout) => ({
  kind: "text",
  key: "text",
  name: "text",
  characters,
  textProperty: "Text",
  fontFamily: token("font-sans"),
  ...type,
  color: paint(color),
  ...layout,
});

/** A text that fills its box's width and wraps there, its lines from the top left. */
const WRAPPING: Layout = {
  sizing: { horizontal: FILL, vertical: HUG },
  align: { horizontal: "LEFT", vertical: "TOP" },
};

/** A block box 384px wide that hugs the height of the text it wraps, with no fill, stroke or corner. */
const block = (name: string, child: ReturnType<typeof text>) => ({
  name,
  ...CENTERED_BOX,
  sizing: { horizontal: fixed(literal(384)), vertical: HUG },
  clips: true,
  cornerRadius: literal(0),
  children: [child],
});

/** The rows of a set's coverage whose class starts with a prefix, as outcome and detail. */
function reasons(component: string, prefix: string): ReadonlySet<string> {
  return new Set(
    coverage
      .filter((row) => row.component === component && row.className.startsWith(prefix))
      .map((row) => `${row.property} ${row.outcome}: ${row.detail}`)
  );
}

describe("the Field description component set", () => {
  it("holds one variant on the Field page, with the Basic demo's description in its Text property", () => {
    const descriptions = set("field-description");
    expect([descriptions?.name, descriptions?.page]).toEqual(["Field description", "page/field"]);
    expect(descriptions?.axes).toEqual([{ name: "state", values: ["rest"] }]);
    expect(descriptions?.columnAxis).toBe("state");
    expect([descriptions?.textProperties, descriptions?.swapProperties]).toEqual([
      [{ name: "Text", defaultValue: "Work address preferred." }],
      [],
    ]);
  });

  it("wraps the muted text across the Field's 384px, its lines at the left", () => {
    expect(variantRoot(spec, "field-description/state=rest")).toEqual(
      block(
        "field-description",
        text("Work address preferred.", labelType("Regular"), "muted-foreground", WRAPPING)
      )
    );
  });

  it("drops the arms that place it among a Field's parts and a link in its text, each with its reason", () => {
    expect(reasons("Field description", "[[data-variant=legend]+&]:")).toEqual(
      new Set([
        "margin-top dropped: a description that follows a legend in a Field set, which the set does not draw",
      ])
    );
    expect(reasons("Field description", "last:")).toEqual(
      new Set([
        "margin-top dropped: the description's place among the parts of a Field, which the set does not draw",
      ])
    );
    expect(reasons("Field description", "text-pretty")).toEqual(
      new Set([
        "text-wrap-mode literal: the label wraps at the box's width",
        "text-wrap-style dropped: a Figma text fills each line before it starts the next, so it cannot even out its lines",
      ])
    );
    expect(reasons("Field description", "[&>a]:")).toEqual(
      new Set([
        "text-decoration-line dropped: no cell of the matrix shows `[&>a]`",
        "text-underline-offset dropped: no cell of the matrix shows `[&>a]`",
      ])
    );
  });
});

describe("the Field error component set", () => {
  it("holds one variant, the invalid Field it shows in, with the Error demo's message in its Text property", () => {
    const errors = set("field-error");
    expect([errors?.name, errors?.page]).toEqual(["Field error", "page/field"]);
    expect(errors?.axes).toEqual([{ name: "state", values: ["invalid"] }]);
    expect(errors?.columnAxis).toBe("state");
    expect([errors?.textProperties, errors?.swapProperties]).toEqual([
      [{ name: "Text", defaultValue: "Enter a work email." }],
      [],
    ]);
  });

  it("wraps the error text across the Field's 384px", () => {
    expect(variantRoot(spec, "field-error/state=invalid")).toEqual(
      block("field-error", text("Enter a work email.", labelType("Regular"), "error", WRAPPING))
    );
  });

  it("drops the invalid Field's own error color, which its own text-error overrides", () => {
    expect(reasons("Field error", "data-invalid:text-error")).toEqual(
      new Set(["color dropped: the root sets its own, so it does not inherit this"])
    );
  });
});

describe("the Field legend component set", () => {
  it("holds the legend and label variants, with the Field set demo's legend in its Text property", () => {
    const legends = set("field-legend");
    expect([legends?.name, legends?.page]).toEqual(["Field legend", "page/field"]);
    expect(legends?.axes).toEqual([{ name: "variant", values: ["legend", "label"] }]);
    expect(legends?.columnAxis).toBe("variant");
    expect([legends?.textProperties, legends?.swapProperties]).toEqual([
      [{ name: "Text", defaultValue: "Notifications" }],
      [],
    ]);
  });

  it.each([
    ["legend", { fontStyle: "Medium", fontSize: literal(16), lineHeight: literal(24) }],
    ["label", labelType("Medium")],
  ] as const)("wraps the %s variant's text across the Field set's 384px", (variant, type) => {
    expect(variantRoot(spec, `field-legend/variant=${variant}`)).toEqual(
      block("field-legend", text("Notifications", type, "foreground", WRAPPING))
    );
  });

  it("drops the margin below it and the balanced lines, each with its reason", () => {
    expect(reasons("Field legend", "mb-3")).toEqual(
      new Set([
        "margin-bottom dropped: the component's root sits alone in its component set, so its margin spaces it from nothing the set draws",
      ])
    );
    expect(reasons("Field legend", "text-balance")).toEqual(
      new Set([
        "text-wrap-mode literal: the label wraps at the box's width",
        "text-wrap-style dropped: a Figma text fills each line before it starts the next, so it cannot even out its lines",
      ])
    );
  });
});

describe("the Field title component set", () => {
  it("holds rest and disabled, with the Choice card demo's title in its Text property", () => {
    const titles = set("field-title");
    expect([titles?.name, titles?.page]).toEqual(["Field title", "page/field"]);
    expect(titles?.axes).toEqual([{ name: "state", values: ["rest", "disabled"] }]);
    expect(titles?.columnAxis).toBe("state");
    expect([titles?.textProperties, titles?.swapProperties]).toEqual([
      [{ name: "Text", defaultValue: "Fixed price" }],
      [],
    ]);
  });

  it.each([
    ["rest", 1],
    ["disabled", 0.5],
  ])("draws the %s title at opacity %s, hugging its text", (state, opacity) => {
    expect(variantRoot(spec, `field-title/state=${state}`)).toEqual({
      name: "field-title",
      ...CENTERED_BOX,
      itemSpacing: literal(8),
      opacity,
      sizing: { horizontal: HUG, vertical: HUG },
      clips: true,
      cornerRadius: literal(0),
      children: [text("Fixed price", labelType("Medium"), "foreground", HUGGING_LABEL)],
    });
  });
});
