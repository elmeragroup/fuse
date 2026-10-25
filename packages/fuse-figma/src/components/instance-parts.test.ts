/**
 * Instance parts in the spec build. Unit under test: `buildSetsInOrder`, through the fixture build,
 * on a `chip` that holds a `badge` as an instance part. Oracle: the badge's own set, which the build
 * makes first from the same classes, and Figma's instance model: an instance takes everything from its
 * main component but its property values, the paints, corners and shadows it overrides, and its own
 * sizing in its parent's auto layout (N1, N3, N4). So where the composite draws the badge as its own
 * set does, the instance is plain; where it draws a label's characters, an icon or a part's presence
 * another way, the instance sets the property; where it paints another way, it overrides at the
 * layer's key path; where the outer layout sizes the badge, the instance takes that sizing; and any
 * other difference has no instance field, so it lands in the coverage table as unmapped.
 */
import { describe, expect, it } from "vitest";

import { FILL, fixed, HUG, literal } from "../../test/built-kit";
import { buildFixtures, chip, dot, ICON } from "../../test/fixture-sets";
import type { FixtureContext } from "../../test/fixture-sets";
import type {
  BuiltComponent,
  ComponentDefinition,
  InstanceDefinition,
  PartDefinition,
} from "./component-spec";
import type { CoverageRow } from "./coverage";
import { makeVariableIndex } from "./css-values";
import type { ChildLayerSpec, InstanceLayerSpec } from "./kit-spec";
import { PAGINATION_EDGE } from "./pagination-kit";
import { SWITCH } from "./switch-kit";

/** A build context whose `font-sans` binds the synced family, as every kit label's does. */
const FONT_SANS: FixtureContext = {
  variables: makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
  ]),
};

/**
 * The inner fixture: a badge whose root fills, strokes, rounds and pads a row of an optional dot, a
 * start icon an `Icon` property picks, and a label a `Label` property sets.
 */
const BADGE = chip(
  "font-sans text-[14px] leading-[20px] text-[rgb(0_0_0)] inline-flex items-center gap-1 rounded-[4px] border border-[rgb(0_0_0)] bg-[rgb(255_0_0)] px-2 py-1",
  {
    key: "badge",
    name: "Badge",
    slot: "badge",
    label: { key: "label", name: "label", characters: "Badge", textProperty: "Label", shownIn: () => true },
    iconsFor: () => [{ ...ICON, swapProperty: "Icon", classes: "size-4" }],
    swapProperties: [{ name: "Icon", defaultIcon: "Plus" }],
    parts: [{ ...dot("size-[6px] bg-[rgb(0_0_0)]"), optional: { name: "Show dot", defaultValue: true } }],
  }
);

/** The badge's one variant, which every instance of it shows. */
const BADGE_VARIANT = "badge/state=rest";

/** The badge as the chip's `action` part, in its one cell, with the given fields. */
function badgePart(fields: Partial<InstanceDefinition> = {}): InstanceDefinition {
  return {
    kind: "instance",
    key: "action",
    of: BADGE,
    cell: () => ({ state: "rest" }),
    shownIn: () => true,
    ...fields,
  };
}

/** A chip whose root carries `classes` and holds the badge part. */
function holding(part: InstanceDefinition, classes = "flex items-center"): ComponentDefinition {
  return chip(classes, { parts: [part] });
}

/** Build the badge's set and then the chip's. */
async function buildBoth(chipDefinition: ComponentDefinition): Promise<{
  readonly badge: BuiltComponent;
  readonly chip: BuiltComponent;
  readonly layer: ChildLayerSpec | undefined;
}> {
  const [badge, built] = await buildFixtures([BADGE, chipDefinition], FONT_SANS);
  if (badge === undefined || built === undefined) {
    throw new Error("the fixture build made fewer sets than it was given");
  }
  return { badge, chip: built, layer: built.componentSet.variants[0]?.root.children[0] };
}

/** The instance layer the badge's own variant would draw as a plain instance, with its own sizing. */
const PLAIN: InstanceLayerSpec = {
  kind: "instance",
  key: "action",
  name: "badge",
  componentSet: "badge",
  variant: BADGE_VARIANT,
  sizing: { horizontal: HUG, vertical: HUG },
};

/** A literal color, from 8-bit channels. */
const rgb = (r: number, g: number, b: number) =>
  ({ kind: "literal", color: { r: r / 255, g: g / 255, b: b / 255, a: 1 } }) as const;

/** Pagination's previous edge, as an instance part in its resting cell. */
const PREVIOUS_EDGE: InstanceDefinition = {
  kind: "instance",
  key: "edge",
  of: PAGINATION_EDGE,
  cell: () => ({ direction: "previous", state: "rest" }),
  shownIn: () => true,
};

/**
 * A build context in which Pagination's edge builds: its label and caret take the page's text color
 * and family, as a Fuse host's `<body>` sets them, and its label's size and line height and its hover
 * color bind synced variables, as the kit's do.
 */
const EDGE_CONTEXT: FixtureContext = {
  variables: makeVariableIndex(
    ["font-sans", "control-text", "control-leading", "foreground"].map((name) => ({
      ref: { collection: "Fuse tokens", name },
      webSyntax: `var(--${name})`,
    }))
  ),
  page: [
    { className: "body", property: "color", value: "rgb(0 0 0)" },
    { className: "body", property: "font-family", value: "var(--font-sans)" },
  ],
};

/** The unmapped rows of a coverage table. */
function unmappedOf(coverage: readonly CoverageRow[]): readonly CoverageRow[] {
  return coverage.filter((row) => row.outcome === "unmapped");
}

describe("an instance part", () => {
  it("is a plain instance where the composite draws the inner root as its own set does", async () => {
    const { chip: built, layer } = await buildBoth(holding(badgePart()));
    expect(layer).toEqual(PLAIN);
    expect(unmappedOf(built.coverage)).toEqual([]);
  });

  describe("sets a property", () => {
    it("to the characters the outer cell gives a label its TEXT property sets", async () => {
      const { layer } = await buildBoth(
        holding(badgePart({ properties: () => ({ text: { Label: "Undo" } }) }))
      );
      expect(layer).toEqual({ ...PLAIN, properties: { text: { Label: "Undo" } } });
    });

    it("to the icon the outer cell picks for its INSTANCE_SWAP property, by the icon's key", async () => {
      const { layer } = await buildBoth(
        holding(badgePart({ properties: () => ({ swap: { Icon: "Star" } }) }))
      );
      expect(layer).toEqual({ ...PLAIN, properties: { swap: { Icon: "icon/Star" } } });
    });

    it("to the BOOLEAN value that hides a part the outer cell leaves out, and leaves out a default", async () => {
      const { layer } = await buildBoth(
        holding(badgePart({ properties: () => ({ boolean: { "Show dot": false } }) }))
      );
      expect(layer).toEqual({ ...PLAIN, properties: { boolean: { "Show dot": false } } });
      const shown = await buildBoth(
        holding(badgePart({ properties: () => ({ boolean: { "Show dot": true } }) }))
      );
      expect(shown.layer).toEqual(PLAIN);
    });
  });

  // Oracle: the definition, whose `optional` names a BOOLEAN of the chip's set that shows the part, as
  // an optional frame's does, and whose `exposed` lets a designer set the badge's properties from the
  // chip's panel.
  it("links its visibility to the outer set's BOOLEAN property, which the set lists, and is exposed", async () => {
    const { chip: built, layer } = await buildBoth(
      holding(badgePart({ optional: { name: "Action", defaultValue: false }, exposed: true }))
    );
    expect(layer).toEqual({ ...PLAIN, exposed: true, visibleProperty: "Action" });
    expect(built.componentSet.booleanProperties).toEqual([{ name: "Action", defaultValue: false }]);
  });

  // Oracle: Tailwind's compiled values for the classes the chip passes, which the badge's own set
  // draws as its fill, stroke color, corner and ring, and its label and glyph color.
  it("overrides the fill, stroke color, corner, shadows, text color and glyph color the composite paints another way", async () => {
    const { chip: built, layer } = await buildBoth(
      holding(
        badgePart({
          classesFor: () =>
            "bg-[rgb(0_255_0)] border-[rgb(0_0_255)] rounded-[2px] ring-2 ring-[rgb(0_0_0)] text-[rgb(255_255_255)]",
        })
      )
    );
    const overrides = layer?.kind === "instance" ? layer.overrides : undefined;
    expect(overrides).toHaveLength(6);
    expect(overrides).toEqual(
      expect.arrayContaining([
        { path: [], field: "fill", color: rgb(0, 255, 0) },
        { path: [], field: "strokeColor", color: rgb(0, 0, 255) },
        { path: [], field: "cornerRadius", value: literal(2) },
        {
          path: [],
          field: "effects",
          shadows: [{ color: rgb(0, 0, 0), offsetX: 0, offsetY: 0, radius: literal(0), spread: literal(2) }],
        },
        { path: ["label"], field: "textColor", color: rgb(255, 255, 255) },
        { path: ["icon"], field: "glyph", color: rgb(255, 255, 255) },
      ])
    );
    expect(unmappedOf(built.coverage)).toEqual([]);
  });

  describe("sizes itself", () => {
    // Oracle: CSS Flexbox 1 §9.4 step 11, under which a column with an unset `align-items` stretches
    // a layer that sets no width across its definite width, which Figma's fill draws.
    it("to fill the width a column stretches it across", async () => {
      const { chip: built, layer } = await buildBoth(holding(badgePart(), "flex flex-col w-[200px]"));
      expect(layer).toEqual({ ...PLAIN, sizing: { horizontal: FILL, vertical: HUG } });
      expect(unmappedOf(built.coverage)).toEqual([]);
    });

    // Oracle: CSS Flexbox 1 §9.2, under which a flex item that sets no width sizes to its content in a
    // row that hugs, while the inner set's block-level root takes the 200px preview width, and N4,
    // under which an instance of a fixed variant hugs once its sizing says so. The diff of the layers
    // inside guards the hug: a part that fills the variant's width has no width to fill in place.
    describe("to hug where its variant takes the preview width", () => {
      const wide = (part: string) =>
        chip("flex", { key: "wide", name: "Wide", slot: "wide", previewWidth: 200, parts: [dot(part)] });
      const widePart = (of: ComponentDefinition): InstanceDefinition => ({
        kind: "instance",
        key: "wide",
        of,
        cell: () => ({ state: "rest" }),
        shownIn: () => true,
      });

      it("as the outer row sizes it to its content", async () => {
        const WIDE = wide("size-[6px] bg-[rgb(0_0_0)]");
        const [variant, built] = await buildFixtures([WIDE, holding(widePart(WIDE))]);
        expect(variant?.componentSet.variants[0]?.root.sizing.horizontal).toEqual(fixed(literal(200)));
        expect(built?.componentSet.variants[0]?.root.children).toEqual([
          {
            kind: "instance",
            key: "wide",
            name: "wide",
            componentSet: "wide",
            variant: "wide/state=rest",
            sizing: { horizontal: HUG, vertical: HUG },
          },
        ]);
        expect(unmappedOf(built?.coverage ?? [])).toEqual([]);
      });

      // Oracle: PH2. A text that fills its variant's 200px row draws at its own width once the
      // instance hugs across, as the row's text does in place in an outer row that hugs it.
      it("and draws a text that fills the variant's width at its own width, as the hugging text in place", async () => {
        const WORDS = chip("flex font-sans text-[14px] leading-[20px] text-[rgb(0_0_0)]", {
          key: "wide",
          name: "Wide",
          slot: "wide",
          previewWidth: 200,
          label: {
            key: "label",
            name: "label",
            characters: "Two words",
            textProperty: "Label",
            shownIn: () => true,
          },
        });
        const [variant, built] = await buildFixtures([WORDS, holding(widePart(WORDS))], FONT_SANS);
        const text = variant?.componentSet.variants[0]?.root.children[0];
        expect(text?.kind === "text" ? text.sizing.horizontal : text).toEqual(FILL);
        expect(unmappedOf(built?.coverage ?? [])).toEqual([]);
      });

      it("and leaves a part that fills the variant's width unmapped", async () => {
        const WIDE = wide("h-[6px] w-full bg-[rgb(0_0_0)]");
        const [, built] = await buildFixtures([WIDE, holding(widePart(WIDE))]);
        const differences = (built?.coverage ?? []).filter((row) => row.className === "");
        expect(differences.map((row) => [row.property, row.detail.split(" ").slice(0, 3).join(" ")])).toEqual(
          [["sizing", "dot draws sizing"]]
        );
      });
    });

    it("at the length the outer component gives it", async () => {
      const { layer } = await buildBoth(holding(badgePart({ classesFor: () => "w-[120px]" })));
      expect(layer).toEqual({ ...PLAIN, sizing: { horizontal: fixed(literal(120)), vertical: HUG } });
    });

    // Oracle: CSS Box Alignment 3 §6.1, under which `self-start` tops the first instance at its own
    // 40px while the row's `items-center` centers the second. A Figma row aligns its layers one way, so
    // the second can sit centered only by stretching across the row, which draws what CSS draws only
    // for a layer no taller than the first. A hugging instance takes its variant's height, which the
    // composite's spec does not hold, so the row cannot stretch the second, and `items-center` stays
    // unmapped. Both instances show one set, so only their keys tell them apart.
    it("by its own occurrence where a sibling instance of the same set sets its own alignment", async () => {
      const SEGMENT = chip("flex items-center", { key: "segment", name: "Segment", slot: "segment" });
      const segment = (key: string, classes: string): InstanceDefinition => ({
        kind: "instance",
        key,
        of: SEGMENT,
        cell: () => ({ state: "rest" }),
        classesFor: () => classes,
        shownIn: () => true,
      });
      const [, built] = await buildFixtures([
        SEGMENT,
        chip("flex items-center h-[80px]", {
          parts: [segment("first", "self-start h-[40px]"), segment("second", "")],
        }),
      ]);
      expect(
        built?.componentSet.variants[0]?.root.children.map((layer) =>
          layer.kind === "instance" ? [layer.key, layer.sizing] : [layer.key, layer.kind]
        )
      ).toEqual([
        ["first", { horizontal: HUG, vertical: fixed(literal(40)) }],
        ["second", { horizontal: HUG, vertical: HUG }],
      ]);
      expect(
        built?.coverage
          .filter((row) => row.className === "items-center" && row.part === "chip")
          .map((row) => [row.property, row.outcome])
      ).toEqual([["align-items", "unmapped"]]);
    });
  });

  // Oracle: CSS Text 3 §7.1, where `text-align` places each line of a text across its box, and probe
  // NA, where a real file kept a `textAlignHorizontal` override on an instance's label through the
  // main's alignment and character edits. A label's TEXT property can give it more lines than the
  // composite shows, which the alignment places, so the instance carries the composite's alignment as
  // an override wherever it differs, as Empty's `text-center` reaches its Button labels.
  it("overrides the label's alignment where an outer `text-center` reaches it, and keeps the class's read", async () => {
    const { chip: built, layer } = await buildBoth(holding(badgePart(), "flex items-center text-center"));
    expect(layer).toEqual({
      ...PLAIN,
      overrides: [{ path: ["label"], field: "textAlign", horizontal: "CENTER" }],
    });
    expect(unmappedOf(built.coverage)).toEqual([]);
    expect(
      built.coverage
        .filter((row) => row.className === "text-center")
        .map((row) => [row.part, row.property, row.outcome])
    ).toEqual([["chip", "text-align", "literal"]]);
  });

  // Oracle: Figma's instance model, under which an instance's padding is its main component's, so a
  // padding the composite gives the badge has no instance field.
  it("leaves a padding the composite draws another way unmapped, naming the field, the inner variant and the fix", async () => {
    const { chip: built } = await buildBoth(holding(badgePart({ classesFor: () => "px-4" })));
    const unmapped = unmappedOf(built.coverage);
    const differences = unmapped.filter((row) => row.className === "");
    expect(differences.map((row) => `${row.part} ${row.property} ${row.value}`).toSorted()).toEqual([
      'badge paddingLeft {"kind":"literal","value":16}',
      'badge paddingRight {"kind":"literal","value":16}',
    ]);
    for (const { property, detail } of differences) {
      expect(detail).toBe(
        `the root draws ${property} {"kind":"literal","value":16} where the composite holds it and {"kind":"literal","value":8} in ${BADGE_VARIANT}, and an instance carries only property values, paints, corners, shadows, text alignments and its own sizing, so give Badge an axis that draws it, or draw the part as a frame`
      );
    }
    expect(
      unmapped
        .filter((row) => row.className === "px-4")
        .map((row) => row.property)
        .toSorted()
    ).toEqual(["padding-left", "padding-right"]);
  });
});

// Unit under test: the in-place diff of an instance whose root holds one layer. Oracle: CSS Box
// Alignment 3 §8, a gap sits only between adjacent items, so a box with fewer than two items draws no
// gap whatever its `gap` says, as an icon button holds its one icon. A hidden optional layer is still a
// layer a designer can show, so it counts.
describe("a gap the composite passes to an instance", () => {
  /** An inner set whose root holds the given dot parts and one icon, with a 4px gap. */
  function lone(parts: readonly PartDefinition[]): ComponentDefinition {
    return chip("text-[rgb(0_0_0)] inline-flex items-center gap-1 rounded-[4px] bg-[rgb(255_0_0)] p-1", {
      key: "lone",
      name: "Lone",
      slot: "lone",
      iconsFor: () => [{ ...ICON, classes: "size-4" }],
      parts,
    });
  }

  async function itemSpacingRows(inner: ComponentDefinition): Promise<readonly string[]> {
    const part: InstanceDefinition = {
      kind: "instance",
      key: "action",
      of: inner,
      cell: () => ({ state: "rest" }),
      classesFor: () => "gap-2",
      shownIn: () => true,
    };
    const [, built] = await buildFixtures([inner, holding(part)], FONT_SANS);
    return unmappedOf(built?.coverage ?? []).map((row) => `${row.className} ${row.property}`);
  }

  it("is no difference where the inner root holds one layer", async () => {
    expect(await itemSpacingRows(lone([]))).toEqual([]);
  });

  it("stays unmapped where the inner root holds two layers", async () => {
    expect(await itemSpacingRows(lone([dot("size-[6px] bg-[rgb(0_0_0)]")]))).toEqual([
      "gap-2 gap",
      " itemSpacing",
    ]);
  });

  it("stays unmapped where the second layer hides behind a property that starts false", async () => {
    const hidden = { ...dot("size-[6px] bg-[rgb(0_0_0)]"), optional: { name: "Dot", defaultValue: false } };
    expect(await itemSpacingRows(lone([hidden]))).toEqual(["gap-2 gap", " itemSpacing"]);
  });
});

// Unit under test: the coverage table of a set that holds an instance part. Oracle: the rule that the
// inner component's own classes are the inner set's coverage, while the composite lists the classes it
// passes: as the override they draw, or as dropped where the inner variant draws the same.
describe("the coverage of an instance part", () => {
  it("lists a passed class that the instance overrides as its read, and one the variant repeats as dropped", async () => {
    const { chip: built } = await buildBoth(
      holding(badgePart({ classesFor: () => "bg-[rgb(0_255_0)] rounded-[4px]" }))
    );
    expect(built.coverage.filter((row) => row.className === "bg-[rgb(0_255_0)]")).toEqual([
      {
        component: "Chip",
        part: "badge",
        className: "bg-[rgb(0_255_0)]",
        property: "background-color",
        value: "rgb(0 255 0)",
        outcome: "literal",
        detail: "rgba(0, 255, 0, 1)",
      },
    ]);
    expect(built.coverage.filter((row) => row.className === "rounded-[4px]")).toEqual([
      expect.objectContaining({
        part: "badge",
        property: "border-radius",
        outcome: "dropped",
        detail: `the instance's variant ${BADGE_VARIANT} draws the same, so the class repeats it`,
      }),
    ]);
  });

  // Oracle: Tailwind compiles `*:data-[slot=badge]:` to `:is(.… > *)[data-slot="badge"]`, at (0,2,0),
  // which beats the badge's own (0,1,0) fill on the element whose `data-slot` is `badge`.
  it("lists a class of an outer box that reaches the inner root as the override it draws", async () => {
    const reaching = "*:data-[slot=badge]:bg-[rgb(0_0_255)]";
    const { chip: built, layer } = await buildBoth(holding(badgePart(), `flex items-center ${reaching}`));
    expect(layer).toEqual({ ...PLAIN, overrides: [{ path: [], field: "fill", color: rgb(0, 0, 255) }] });
    expect(built.coverage.filter((row) => row.className === reaching)).toEqual([
      {
        component: "Chip",
        part: "chip",
        className: reaching,
        property: "background-color",
        value: "rgb(0 0 255)",
        outcome: "literal",
        detail: "rgba(0, 0, 255, 1)",
      },
    ]);
  });

  // Oracle: CSS Custom Properties 1 §2, under which the passed `[--radius-button:8px]` gives the
  // Button's root a local value of the synced `radius-button`, which its `rounded-(--radius-button)`
  // resolves through, so the corner paints 8px where the Button's own variant binds the variable.
  it("lists a passed custom property as the corner override it draws", async () => {
    const radius = {
      ref: { collection: "Fuse tokens", name: "radius-button" },
      webSyntax: "var(--radius-button)",
    };
    const context: FixtureContext = {
      variables: makeVariableIndex([
        { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
        radius,
      ]),
    };
    const BUTTON = chip("inline-flex rounded-(--radius-button) bg-[rgb(255_0_0)] px-2", {
      key: "button",
      name: "Button",
      slot: "button",
    });
    const passed = "[--radius-button:8px]";
    const action: InstanceDefinition = {
      kind: "instance",
      key: "action",
      of: BUTTON,
      cell: () => ({ state: "rest" }),
      classesFor: () => passed,
      shownIn: () => true,
    };
    const [, built] = await buildFixtures([BUTTON, holding(action)], context);
    const [layer] = built?.componentSet.variants[0]?.root.children ?? [];
    expect(layer?.kind === "instance" ? layer.overrides : undefined).toEqual([
      { path: [], field: "cornerRadius", value: literal(8) },
    ]);
    expect(built?.coverage.filter((row) => row.className === passed)).toEqual([
      {
        component: "Chip",
        part: "button",
        className: passed,
        property: "--radius-button",
        value: "8px",
        outcome: "literal",
        detail: "8px",
      },
    ]);
  });

  // Oracle: Tailwind compiles `*:data-[slot=badge]:` to `:is(.… > *)[data-slot="badge"]`, so the class
  // of an outer frame that shares the badge's slot reaches the badge's root, a child of that frame,
  // and paints it, which the composite owns whatever the two layers are named.
  it("lists a class of an outer frame that shares the inner root's slot as the composite's", async () => {
    const reaching = "*:data-[slot=badge]:bg-[rgb(0_0_255)]";
    const frame = { ...dot(`flex ${reaching}`), key: "frame", slot: "badge", parts: [badgePart()] };
    const { chip: built } = await buildBoth(chip("flex items-center", { parts: [frame] }));
    expect(built.coverage.filter((row) => row.className === reaching)).toEqual([
      {
        component: "Chip",
        part: "badge",
        className: reaching,
        property: "background-color",
        value: "rgb(0 0 255)",
        outcome: "literal",
        detail: "rgba(0, 0, 255, 1)",
      },
    ]);
  });

  // Oracle: the rule that the composite owns the classes it passes. The badge's `hover:` arm never
  // holds in its resting cell, so where the chip passes the same class in its second cell, the
  // composite's coverage drops it for the `hover` no cell shows, whoever else declares the class.
  it("lists a passed class whose variant no inner cell shows as dropped, though the inner root declares it too", async () => {
    const arm = "hover:bg-[rgb(0_255_0)]";
    const HOVERED = chip(`inline-flex bg-[rgb(255_0_0)] ${arm}`, {
      key: "badge",
      name: "Badge",
      slot: "badge",
      axes: [{ name: "state", values: ["rest", "hover"] }],
    });
    const part: InstanceDefinition = {
      kind: "instance",
      key: "action",
      of: HOVERED,
      cell: () => ({ state: "rest" }),
      classesFor: (outer) => (outer.tone === "passing" ? arm : ""),
      shownIn: () => true,
    };
    const holder = chip("flex items-center", {
      axes: [{ name: "tone", values: ["plain", "passing"] }],
      columnAxis: "tone",
      parts: [part],
    });
    const [, built] = await buildFixtures([HOVERED, holder]);
    expect(built?.coverage.filter((row) => row.className === arm)).toEqual([
      {
        component: "Chip",
        part: "badge",
        className: arm,
        property: "background-color",
        value: "rgb(0 255 0)",
        outcome: "dropped",
        detail: "no cell that gives the box this class shows `hover`",
      },
    ]);
  });

  // Oracle: Tailwind compiles `[&_img]:rounded-[8px]` to `.… img`, so the class of the outer frame and
  // the same class on the inner root both reach the inner `<img>`, and neither styles nothing.
  it("counts an outer frame's tag class as taken where the inner root shares its slot and class", async () => {
    const rounds = "[&_img]:rounded-[8px]";
    const picture: PartDefinition = {
      key: "picture",
      slot: undefined,
      element: { tag: "img", attributes: {} },
      shownIn: () => true,
      classesFor: () => "size-[8px]",
      label: undefined,
      iconsFor: () => [],
    };
    const FRAMED = chip(`inline-flex ${rounds}`, {
      key: "badge",
      name: "Badge",
      slot: "badge",
      parts: [picture],
    });
    const part: InstanceDefinition = {
      kind: "instance",
      key: "action",
      of: FRAMED,
      cell: () => ({ state: "rest" }),
      shownIn: () => true,
    };
    const frame = { ...dot(`flex ${rounds}`), key: "frame", slot: "badge", parts: [part] };
    const [, built] = await buildFixtures([FRAMED, chip("flex", { parts: [frame] })]);
    expect(unmappedOf(built?.coverage ?? []).filter((row) => row.className === rounds)).toEqual([]);
  });

  // Oracle: CSS Custom Properties 1 §2, under which the inner root's `var(--p,8px)` takes the `--p`
  // the chip sets, so the root pads 16px on the left where the inner set's variant pads 8px, and an
  // instance carries no padding.
  it("lists an outer custom property that an inner declaration reads as unmapped where the instance cannot carry what it changes", async () => {
    const PADDED = chip("inline-flex [padding-left:var(--p,8px)]", {
      key: "padded",
      name: "Padded",
      slot: "padded",
    });
    const part: InstanceDefinition = {
      kind: "instance",
      key: "action",
      of: PADDED,
      cell: () => ({ state: "rest" }),
      shownIn: () => true,
    };
    const [, built] = await buildFixtures([PADDED, chip("flex [--p:16px]", { parts: [part] })]);
    expect(
      built?.coverage
        .filter((row) => row.className === "[--p:16px]")
        .map((row) => [row.property, row.value, row.outcome, row.detail])
    ).toEqual([
      [
        "--p",
        "16px",
        "unmapped",
        expect.stringContaining(`draws paddingLeft ${JSON.stringify(literal(16))}`),
      ],
    ]);
  });

  /** An instance part of `of` passed `classes`, in its one cell. */
  const passing = (of: ComponentDefinition, classes: string): InstanceDefinition => ({
    kind: "instance",
    key: "action",
    of,
    cell: () => ({ state: "rest" }),
    classesFor: () => classes,
    shownIn: () => true,
  });

  /** The outcome of each composite row of a class, by property. */
  const outcomesOf = (built: BuiltComponent | undefined, className: string) =>
    built?.coverage.filter((row) => row.className === className).map((row) => [row.property, row.outcome]);

  // Oracle: CSS Flexbox 1 §9.4 step 11, under which a column whose `align-items` is unset stretches a
  // layer with no width across its definite width, and `items-start` leaves the layer as wide as its
  // content. Both columns align their layers at the start across, so only the dot's width tells the
  // passed class apart from the variant, and an instance carries no width of a layer inside it.
  it("lists a passed `items-start` as unmapped where it stops an inner column stretching its layer", async () => {
    const COLUMN = chip("flex flex-col w-[200px]", {
      key: "column",
      name: "Column",
      slot: "column",
      parts: [dot("h-[8px] bg-[rgb(255_0_0)]")],
    });
    const [, built] = await buildFixtures([
      COLUMN,
      chip("flex", { parts: [passing(COLUMN, "items-start")] }),
    ]);
    expect(outcomesOf(built, "items-start")).toEqual([["align-items", "unmapped"]]);
  });

  // Oracle: CSS Box Alignment 3 §5.1 and §6.1, under which `place-content: center` centers a grid's one
  // track on both axes, while the inner row centers its dot along and puts it at the start across.
  it("lists a passed `place-content-center` as unmapped where the inner variant aligns across another way", async () => {
    const ROW = chip("flex justify-center items-start w-[100px] h-[40px]", {
      key: "row",
      name: "Row",
      slot: "row",
      parts: [dot("size-[8px] bg-[rgb(255_0_0)]")],
    });
    const [, built] = await buildFixtures([
      ROW,
      chip("flex", { parts: [passing(ROW, "grid place-content-center")] }),
    ]);
    expect(outcomesOf(built, "place-content-center")).toEqual([["place-content", "unmapped"]]);
  });

  // Oracle: CSS Flexbox 1 §9.4 step 11, under which a column stretches a layer with no width only
  // across a definite width. The instance carries its own width, but not the dot's, which hugs in the
  // inner variant and fills once the passed width makes the column's width definite.
  it("lists a passed width as unmapped where it makes an inner column stretch its layer", async () => {
    const COLUMN = chip("flex flex-col", {
      key: "column",
      name: "Column",
      slot: "column",
      parts: [dot("h-[8px] bg-[rgb(255_0_0)]")],
    });
    const [, built] = await buildFixtures([COLUMN, chip("flex", { parts: [passing(COLUMN, "w-[200px]")] })]);
    expect(outcomesOf(built, "w-[200px]")).toEqual([["width", "unmapped"]]);
  });

  // Oracle: CSS 2.1 §10.3.3 and CSS Flexbox 1 §8.3, under which a block box stacks its block-level
  // parts at its start, each as wide as the box, where the inner column centers its dot across and
  // leaves it as wide as its content. Both lay out top to bottom, so only the alignment and the dot's
  // width tell the passed `block` apart from the variant.
  it("lists a passed `block` as unmapped where it changes how an inner column places its layer, not its direction", async () => {
    const COLUMN = chip("flex flex-col items-center w-[200px]", {
      key: "column",
      name: "Column",
      slot: "column",
      parts: [dot("block h-[8px] bg-[rgb(255_0_0)]")],
    });
    const [, built] = await buildFixtures([COLUMN, chip("flex", { parts: [passing(COLUMN, "block")] })]);
    expect(outcomesOf(built, "block")).toEqual([["display", "unmapped"]]);
  });

  // Oracle: Tailwind compiles `*:data-[slot=pagination-previous]:` to `:is(.… > *)[data-slot=…]`, which
  // matches the `<a data-slot="pagination-previous">` the previous edge renders, so the chip's fill
  // reaches the instance's root, where an override carries it.
  it("lists an outer slot class that reaches an instance root by the slot its cell renders as the override it draws", async () => {
    const fills = "*:data-[slot=pagination-previous]:bg-[rgb(0_0_255)]";
    const [, built] = await buildFixtures(
      [PAGINATION_EDGE, chip(`flex ${fills}`, { parts: [PREVIOUS_EDGE] })],
      EDGE_CONTEXT
    );
    expect(outcomesOf(built, fills)).toEqual([["background-color", "literal"]]);
  });

  it("leaves the inner component's own classes to the inner set's coverage", async () => {
    const { badge, chip: built } = await buildBoth(holding(badgePart()));
    expect(badge.coverage.filter((row) => row.className === "px-2")).not.toEqual([]);
    expect(
      built.coverage.filter((row) => ["px-2", "gap-1", "size-4", "size-[6px]"].includes(row.className))
    ).toEqual([]);
  });
});

// Oracle: CSS, where an outer `:has([data-slot=…])` stops matching once the part that carries the slot is
// gone, which hiding a layer behind a BOOLEAN property cannot draw. Tailwind compiles
// `has-[[data-slot=badge]]:` to `:has([data-slot=badge])`.
describe("the presence check around an instance", () => {
  it("stops the build when an outer selector reads whether the instance's root is there", async () => {
    const reads = "has-[[data-slot=badge]]";
    const holder = chip(`flex ${reads}:gap-[2px]`, {
      facts: new Map([[reads, () => true]]),
      parts: [{ ...dot("flex"), optional: { name: "Detail", defaultValue: true }, parts: [badgePart()] }],
    });
    await expect(buildFixtures([BADGE, holder], FONT_SANS)).rejects.toThrow(
      `Chip: chip-dot cannot hide behind the Detail property, since \`${reads}:gap-[2px]\` reads whether badge, which chip-dot holds, is there`
    );
  });

  // Oracle: CSS, where the chip's `:has([data-slot=chip-dot])` stops matching once the badge's dot is
  // gone, which the badge's own Show dot property hides on the instance, exposed or not, and which no
  // property of the chip can restyle.
  it("stops the build when an outer selector reads whether an inner set's optional part is there", async () => {
    const reads = "has-[[data-slot=chip-dot]]";
    const holder = chip(`flex ${reads}:gap-[2px]`, {
      facts: new Map([[reads, () => true]]),
      parts: [badgePart({ exposed: true })],
    });
    await expect(buildFixtures([BADGE, holder], FONT_SANS)).rejects.toThrow(
      `Chip: chip-dot in the action instance cannot hide behind Badge's Show dot property, since \`${reads}:gap-[2px]\` reads whether it is there`
    );
  });

  // Oracle: Fuse's markup, where `Pagination.Previous` renders an `<a data-slot="pagination-previous">`
  // that Pagination's edge definition finds by its tag, since the edge's slot changes with its
  // direction.
  it("stops the build when an outer selector reads the slot an instance root renders in its cell, not its set's own slot", async () => {
    const reads = "has-[[data-slot=pagination-previous]]";
    const holder = chip(`flex ${reads}:gap-[2px]`, {
      facts: new Map([[reads, () => true]]),
      parts: [{ ...dot("flex"), optional: { name: "Detail", defaultValue: true }, parts: [PREVIOUS_EDGE] }],
    });
    await expect(buildFixtures([PAGINATION_EDGE, holder], EDGE_CONTEXT)).rejects.toThrow(
      `Chip: chip-dot cannot hide behind the Detail property, since \`${reads}:gap-[2px]\` reads whether pagination-previous, which chip-dot holds, is there`
    );
  });
});

// Oracle: CSS 2.1 Appendix E and CSS Flexbox 1 §4.3, under which a flex block's layers paint as an
// inline block does, so the ring a header's dot casts paints over the next block's fill, while a
// positioned block paints above it. Figma paints the first layer on top only with
// `itemReverseZIndex` (PZ2). The header is an instance here, as the frame part is in the Accordion.
describe("an instance part in a box that stacks blocks", () => {
  const HEADER = chip("flex", {
    key: "header",
    name: "Header",
    slot: "header",
    parts: [dot("size-[4px] bg-[rgb(255_0_0)] ring-2 ring-[rgb(0_0_0)]")],
  });
  const header: InstanceDefinition = {
    kind: "instance",
    key: "header",
    of: HEADER,
    cell: () => ({ state: "rest" }),
    shownIn: () => true,
  };
  const panel = (key: string, classes: string) => ({
    ...dot(`block h-[20px] ${classes}`),
    key,
    slot: `chip-${key}`,
  });
  const STACK = "block w-[200px]";

  it("puts its first layer on top, so the header's ring paints over the panel's fill", async () => {
    const [, built] = await buildFixtures([
      HEADER,
      chip(STACK, { parts: [header, panel("panel", "bg-[rgb(0_0_255)]")] }),
    ]);
    expect(built?.componentSet.variants[0]?.root.firstOnTop).toBe(true);
  });

  it("leaves the box's display unmapped where a later positioned block paints above the ring", async () => {
    const [, built] = await buildFixtures([
      HEADER,
      chip(STACK, {
        parts: [header, panel("panel", "bg-[rgb(0_0_255)]"), panel("badge", "relative bg-[rgb(0_255_0)]")],
      }),
    ]);
    expect(built?.componentSet.variants[0]?.root.firstOnTop).toBeUndefined();
    expect(
      built?.coverage
        .filter((row) => row.className === "block" && row.part === "chip" && row.outcome === "unmapped")
        .map((row) => [row.property, row.detail])
    ).toEqual([
      [
        "display",
        "the ring a flex block's layer casts paints above a later block's fill and below chip-badge, a positioned box or a stacking context (CSS 2.1 Appendix E), and Figma paints a box's layers in one order",
      ],
    ]);
  });

  // The ring is an instance's own now, at a depth the stacking reaches only through what each
  // instance draws in place.
  const RINGED = chip("size-[4px] bg-[rgb(255_0_0)] ring-2 ring-[rgb(0_0_0)]", {
    key: "ringed",
    name: "Ringed",
    slot: "ringed",
  });
  const ringed: InstanceDefinition = {
    kind: "instance",
    key: "ringed",
    of: RINGED,
    cell: () => ({ state: "rest" }),
    shownIn: () => true,
  };
  const headerFrame = { ...dot("flex"), key: "header", slot: "chip-header", parts: [ringed] };

  it("puts its first layer on top where a flex header frame holds a ringed instance", async () => {
    const [, built] = await buildFixtures([
      RINGED,
      chip(STACK, { parts: [headerFrame, panel("panel", "bg-[rgb(0_0_255)]")] }),
    ]);
    expect(built?.componentSet.variants[0]?.root.firstOnTop).toBe(true);
  });

  it("puts its first layer on top where a header instance holds a ringed instance", async () => {
    const NESTING = chip("flex", { key: "header", name: "Header", slot: "header", parts: [ringed] });
    const [, , built] = await buildFixtures([
      RINGED,
      NESTING,
      chip(STACK, { parts: [{ ...header, of: NESTING }, panel("panel", "bg-[rgb(0_0_255)]")] }),
    ]);
    expect(built?.componentSet.variants[0]?.root.firstOnTop).toBe(true);
  });

  it("leaves the box's display unmapped where a later positioned block paints above a nested instance's ring", async () => {
    const [, built] = await buildFixtures([
      RINGED,
      chip(STACK, {
        parts: [
          headerFrame,
          panel("panel", "bg-[rgb(0_0_255)]"),
          panel("badge", "relative bg-[rgb(0_255_0)]"),
        ],
      }),
    ]);
    expect(built?.componentSet.variants[0]?.root.firstOnTop).toBeUndefined();
    expect(
      built?.coverage
        .filter((row) => row.className === "block" && row.part === "chip" && row.outcome === "unmapped")
        .map((row) => [row.property, row.detail])
    ).toEqual([
      [
        "display",
        "the ring a flex block's layer casts paints above a later block's fill and below chip-badge, a positioned box or a stacking context (CSS 2.1 Appendix E), and Figma paints a box's layers in one order",
      ],
    ]);
  });
});

// Unit under test: the composite build of a Switch instance, whose thumb draws as a slot around a dot.
// Oracle: the Switch's own set, built first from the same classes, whose resting off variant the
// instance shows: where the composite passes nothing, the instance draws that variant as it is.
describe("an instance of a set with a part that scales", () => {
  it("is a plain instance of a resting Switch, with the variant's own sizing", async () => {
    const toggle: InstanceDefinition = {
      kind: "instance",
      key: "toggle",
      of: SWITCH,
      cell: () => ({ size: "default", checked: "off", state: "rest" }),
      shownIn: () => true,
    };
    const [switches, built] = await buildFixtures([SWITCH, chip("flex items-center", { parts: [toggle] })]);
    const variant = "switch/size=default,checked=off,state=rest";
    const resting = switches?.componentSet.variants.find((candidate) => candidate.key === variant);
    expect(built?.componentSet.variants[0]?.root.children).toEqual([
      {
        kind: "instance",
        key: "toggle",
        name: "switch",
        componentSet: "switch",
        variant,
        sizing: resting?.root.sizing,
      },
    ]);
    // The in-place diff names no class, and lists what it cannot carry as unmapped.
    expect(built?.coverage.filter((row) => row.className === "" && row.outcome === "unmapped")).toEqual([]);
  });
});

/** A one-cell fixture with a key, name and slot of its own, holding the given parts. */
function named(key: string, classes: string, parts: readonly InstanceDefinition[] = []): ComponentDefinition {
  const name = key.charAt(0).toUpperCase() + key.slice(1);
  return chip(classes, { key, name, slot: key, parts });
}

/** An instance part of a one-cell fixture. */
function partOf(of: ComponentDefinition): InstanceDefinition {
  return {
    kind: "instance",
    key: `${of.key}-part`,
    of,
    cell: () => ({ state: "rest" }),
    shownIn: () => true,
  };
}

// Unit under test: `buildSetsInOrder`, which builds the sets in the list's order. Oracle: an instance
// reads its inner set's variants, so an inner set must build before the set that holds it, and a
// cycle of instance parts leaves no set to build first.
describe("the order sets with instance parts build in", () => {
  const DOT = named("dot", "size-[6px] bg-[rgb(0_0_0)]");
  const PILL = named("pill", "flex items-center", [partOf(DOT)]);
  const CARD = named("card", "flex items-center", [partOf(PILL)]);

  it("builds an inner set that holds instances itself before the set that holds it", async () => {
    const [, pill, card] = await buildFixtures([DOT, PILL, CARD]);
    const sizing = { horizontal: fixed(literal(6)), vertical: fixed(literal(6)) };
    expect(pill?.componentSet.variants[0]?.root.children).toEqual([
      {
        kind: "instance",
        key: "dot-part",
        name: "dot",
        componentSet: "dot",
        variant: "dot/state=rest",
        sizing,
      },
    ]);
    expect(card?.componentSet.variants[0]?.root.children).toEqual([
      {
        kind: "instance",
        key: "pill-part",
        name: "pill",
        componentSet: "pill",
        variant: "pill/state=rest",
        sizing: { horizontal: HUG, vertical: HUG },
      },
    ]);
  });

  it("refuses a set whose instance part shows a set it lists later", async () => {
    await expect(buildFixtures([DOT, CARD, PILL])).rejects.toThrow(
      "Card holds Pill as pill-part, whose set the build makes after it, so list Pill first"
    );
  });

  it("refuses a set whose instance part shows a set it does not list", async () => {
    await expect(buildFixtures([DOT, CARD])).rejects.toThrow(
      "Card holds Pill as pill-part, whose set the build does not make"
    );
  });

  it("refuses instance parts that form a cycle, naming it", async () => {
    // Each reads the other's part when the build asks for its parts, which a cycle needs.
    const LOOP: ComponentDefinition = {
      ...named("loop", "flex"),
      get parts(): readonly InstanceDefinition[] {
        return [partOf(KNOT)];
      },
    };
    const KNOT: ComponentDefinition = {
      ...named("knot", "flex"),
      get parts(): readonly InstanceDefinition[] {
        return [partOf(LOOP)];
      },
    };
    await expect(buildFixtures([LOOP, KNOT])).rejects.toThrow(
      "the instance parts form a cycle, Loop holds Knot, Knot holds Loop, so none of their sets can build first"
    );
  });
});

// Oracle: CSS Transforms 2 §5, where `rotate-180` turns the glyph half a turn about its centre, and
// probe PT, where Figma refuses a turn on a layer inside an instance. A half-turned CaretDown draws
// the shape CaretUp draws unturned, as `glyph-mirrors.test.ts` proves from the icon library, so the
// instance swaps to CaretUp. A turn with no proven mirror has no instance field.
describe("a glyph the composite gives classes", () => {
  it("takes the classes the composite gives the icon a swap property places, as an override", async () => {
    const { chip: built, layer } = await buildBoth(
      holding(
        badgePart({
          properties: () => ({ swap: { Icon: "Star" } }),
          swapClasses: () => ({ Icon: "text-[rgb(0_0_255)]" }),
        })
      )
    );
    expect(layer).toEqual({
      ...PLAIN,
      properties: { swap: { Icon: "icon/Star" } },
      overrides: [{ path: ["icon"], field: "glyph", color: rgb(0, 0, 255) }],
    });
    expect(unmappedOf(built.coverage)).toEqual([]);
  });

  it("swaps a half-turned CaretDown to CaretUp, its half-turn mirror", async () => {
    const { chip: built, layer } = await buildBoth(
      holding(
        badgePart({
          properties: () => ({ swap: { Icon: "CaretDown" } }),
          swapClasses: () => ({ Icon: "rotate-180" }),
        })
      )
    );
    expect(layer).toEqual({ ...PLAIN, properties: { swap: { Icon: "icon/CaretUp" } } });
    expect(unmappedOf(built.coverage)).toEqual([]);
  });

  it.each([
    ["a half-turned glyph with no proven mirror", "CaretRight", "rotate-180"],
    ["a quarter-turned CaretDown", "CaretDown", "rotate-90"],
  ])("leaves %s unmapped", async (_what, icon, turn) => {
    const { chip: built } = await buildBoth(
      holding(
        badgePart({ properties: () => ({ swap: { Icon: icon } }), swapClasses: () => ({ Icon: turn }) })
      )
    );
    expect(unmappedOf(built.coverage).map((row) => row.property)).toContain("rotation");
  });

  // Tailwind compiles `in-data-popup-open:` to `:where([data-popup-open]) .class`: the class holds
  // below any element that carries `data-popup-open` (Selectors 4 §15.1, the descendant combinator).
  it.each([
    [true, { ...PLAIN, properties: { swap: { Icon: "icon/CaretUp" } } }],
    [false, { ...PLAIN, properties: { swap: { Icon: "icon/CaretDown" } } }],
  ])("turns a glyph whose ancestor's popup is open where that holds (%s)", async (open, expected) => {
    const { chip: built, layer } = await buildBoth(
      holding(
        badgePart({
          properties: () => ({ swap: { Icon: "CaretDown" } }),
          swapClasses: () => ({ Icon: "in-data-popup-open:rotate-180" }),
          facts: new Map([["in-data-popup-open", () => open]]),
        })
      )
    );
    expect(layer).toEqual(expected);
    expect(unmappedOf(built.coverage)).toEqual([]);
  });

  // The classes the composite gives the glyph are the composite's, so their rows are the composite's
  // too, as the classes it passes the inner root are.
  it("records the classes it gives the glyph in its own coverage, the turn carried by the mirror swap", async () => {
    const { chip: built } = await buildBoth(
      holding(
        badgePart({
          properties: () => ({ swap: { Icon: "CaretDown" } }),
          swapClasses: () => ({ Icon: "text-[rgb(0_0_255)] in-data-popup-open:rotate-180" }),
          facts: new Map([["in-data-popup-open", () => true]]),
        })
      )
    );
    expect(
      built.coverage
        .filter((row) => ["text-[rgb(0_0_255)]", "in-data-popup-open:rotate-180"].includes(row.className))
        .map((row) => [row.className, row.property, row.outcome, row.detail])
    ).toEqual([
      ["text-[rgb(0_0_255)]", "color", "literal", expect.any(String)],
      [
        "in-data-popup-open:rotate-180",
        "rotate",
        "literal",
        "the instance swaps the glyph to icon/CaretUp, its half-turn mirror, since Figma turns no layer inside an instance (PT)",
      ],
    ]);
  });

  it("refuses classes for a swap property the inner set does not define", async () => {
    await expect(
      buildBoth(holding(badgePart({ swapClasses: () => ({ Glyph: "rotate-180" }) })))
    ).rejects.toThrow("Glyph");
  });
});
