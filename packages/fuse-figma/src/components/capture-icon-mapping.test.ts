/**
 * Where the build places an absolute icon out of its box's flow, and the reason it keeps every other
 * icon in the flow. The unit under test is `buildSetsInOrder` on hand-built captures of one-cell
 * `chip` sets (`test/capture-fixtures.ts`), shaped as Accordion's `infodropdown` item: a block root
 * holding a `flex` header, which holds a `relative flex items-center` trigger, which holds the label
 * `Shipping` and then a 16px `absolute right-0` caret, and, where a row says so, a panel after the
 * header. Each `<svg>` carries the facts the capture's page measures (`uncovered`, `still`,
 * `iconPlace`), which `absolute-icon-paint.chromium.test.ts` measures in Chromium, so each row here
 * reads the build's own rules alone. Oracles:
 *
 * - the closed shape `capture/icon-acceptance.ts` states: the properties the caret and the trigger win in
 *   the capture, and the elements around them, so any other property or element refuses with a
 *   reason that names it;
 * - CSS 2.1 §10.3.7 and CSS Flexbox 1 §4.1, under which `right-0` puts the caret 0px inside the
 *   trigger's right edge and its static position centres it in the row, which MAX and CENTER keep;
 * - CSS Transforms 2 §6, under which a half turn about its centre leaves its square box in place;
 * - the plan-against-fact rule of `absolute-icon.ts`, under which a measured place that differs from
 *   the plan in any length refuses with both lengths.
 *
 * Every refusal row asserts the whole reason the `position` row of the caret carries.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, ICON, instanceOf, notesOf, part, rest } from "../../test/capture-fixtures";
import type { FixtureElement, Written } from "../../test/capture-fixtures";
import type { MeasuredFacts } from "../capture/capture-format";
import type { LabelManifest, PartManifest } from "../capture/manifest";
import { makeVariableIndex } from "./css-values";
import type { VariableIndex } from "./css-values";
import type { AxisPlacementSpec, ChildLayerSpec, EdgePlacementSpec, VariantSpec } from "./kit-spec";

/** A place by the parent's edges on each axis. */
const edges = (horizontal: AxisPlacementSpec, vertical: AxisPlacementSpec): EdgePlacementSpec => ({
  kind: "edges",
  within: "parent",
  horizontal,
  vertical,
});

/** The caret's place: 0px inside the trigger's right edge, centred down. */
const CARET_PLACE = edges({ kind: "end", end: 0 }, { kind: "centre", offset: 0 });

/** Where the capture measures the caret in the trigger: 16px, 0px inside its right edge, centred. */
const PLACE = { width: 16, height: 16, right: 0, down: 0 } as const;

/** The facts the capture measures on the caret (`captures/accordion-item.json`). */
const FACTS: MeasuredFacts = { uncovered: true, still: true, iconPlace: PLACE };

/** The font variable the label binds. */
const FONT_SANS = { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" };

const CARET = { ...ICON, key: "caret", name: "caret", side: "end" as const };
const LABEL: LabelManifest = {
  key: "label",
  name: "label",
  characters: "Shipping",
  textProperty: "Label",
  shownIn: () => true,
};

/** The shape of one row: the classes of each element of the item and what it holds besides. */
type Item = {
  readonly root?: string;
  /** The declarations each generated box of the root wins, by its name. */
  readonly rootPseudo?: FixtureElement["pseudo"];
  readonly header?: string;
  readonly trigger?: string;
  readonly triggerWritten?: readonly Written[];
  readonly caret?: string;
  readonly caretWritten?: readonly Written[];
  readonly measured?: MeasuredFacts;
  /** Elements the trigger holds before the caret and after it, each a part with its own slot. */
  readonly beforeCaret?: readonly FixtureElement[];
  readonly afterCaret?: readonly FixtureElement[];
  /** Text after the caret in the trigger. */
  readonly textAfter?: string;
  /** Elements the root holds before the header and after it. */
  readonly beforeHeader?: readonly FixtureElement[];
  readonly afterHeader?: readonly FixtureElement[];
  /** Extra parts the manifest names below the root, for elements the row holds there. */
  readonly rootParts?: readonly PartManifest[];
  readonly variables?: VariableIndex;
};

const ROOT = "block w-[384px] font-sans text-[16px] leading-[24px] text-[#000000]";
const TRIGGER = "relative flex flex-1 items-center gap-2";
const CARET_CLASSES = "absolute right-0 size-4 shrink-0";

/**
 * The parts of the manifest for each slot an element below the trigger or the root names, after the
 * trigger's label where `at` says so.
 */
function partsOf(
  elements: readonly FixtureElement[],
  at: "before-label" | "after-label" = "before-label"
): readonly PartManifest[] {
  return elements.flatMap((element) => {
    if (element.slot === undefined) {
      return [];
    }
    const own = part({ key: element.slot, slot: element.slot, parts: partsOf(element.children ?? []) });
    return [at === "after-label" ? { ...own, after: "label" as const } : own];
  });
}

/** Build the item and read the caret's layer, its `position` row and the trigger's `position` row. */
async function buildItem(item: Item = {}) {
  const beforeCaret = item.beforeCaret ?? [];
  const afterCaret = item.afterCaret ?? [];
  const caret: FixtureElement = {
    tag: "svg",
    classes: item.caret ?? CARET_CLASSES,
    written: item.caretWritten ?? [],
    measured: item.measured ?? FACTS,
  };
  const children = [...beforeCaret, caret, ...afterCaret];
  const { textAfter } = item;
  const text =
    textAfter === undefined
      ? { text: "Shipping", textIndex: 0 }
      : {
          texts: [
            "Shipping",
            ...children.map((_, index) => (index === children.length - 1 ? textAfter : "")),
          ],
        };
  const trigger: FixtureElement = {
    slot: "trigger",
    classes: item.trigger ?? TRIGGER,
    written: item.triggerWritten ?? [],
    children,
    ...text,
  };
  const header: FixtureElement = { slot: "header", classes: item.header ?? "flex", children: [trigger] };
  const plain: FixtureElement = {
    slot: "chip",
    classes: item.root ?? ROOT,
    children: [...(item.beforeHeader ?? []), header, ...(item.afterHeader ?? [])],
  };
  const root = item.rootPseudo === undefined ? plain : { ...plain, pseudo: item.rootPseudo };
  const manifest = chip({
    parts: [
      ...partsOf(item.beforeHeader ?? []),
      part({
        key: "header",
        slot: "header",
        parts: [
          part({
            key: "trigger",
            slot: "trigger",
            label:
              item.textAfter === undefined ? LABEL : { ...LABEL, characters: `Shipping${item.textAfter}` },
            iconsFor: () => [CARET],
            parts: partsOf([...beforeCaret, ...afterCaret], "after-label"),
          }),
        ],
      }),
      ...partsOf(item.afterHeader ?? []),
      ...(item.rootParts ?? []),
    ],
  });
  const { variant, coverage } = await buildCaptured(manifest, rest(root), {
    variables: item.variables ?? makeVariableIndex([FONT_SANS]),
  });
  const layer = layersOf(variant).find((each) => each.key === "caret");
  const row = coverage.find((each) => each.part === "caret" && each.property === "position");
  return {
    placement: layer?.kind === "icon" ? layer.placement : "no caret",
    rotation: layer?.kind === "icon" ? layer.rotation : "no caret",
    size: layer?.kind === "icon" ? layer.size : "no caret",
    row: [row?.outcome, row?.detail],
    anchor: notesOf(coverage, "relative").find(([property]) => property === "position"),
    layers: layersOf(variant),
  };
}

/** Every layer of a variant, each frame's layers after it. */
function layersOf(variant: VariantSpec | undefined): readonly ChildLayerSpec[] {
  const below = (layers: readonly ChildLayerSpec[]): readonly ChildLayerSpec[] =>
    layers.flatMap((layer) => [layer, ...(layer.kind === "frame" ? below(layer.children) : [])]);
  return below(variant?.root.children ?? []);
}

const PLACED = ["literal", "an absolute layer placed by its distances to its parent's edges"];
const unmapped = (why: string) => ["unmapped", why];

describe("the infodropdown caret's shape, which the kit places", () => {
  // The trigger's `relative` only anchors the caret, whose MAX × CENTER constraints the kit draws.
  it("places the caret 0px inside the trigger's right edge and centred down", async () => {
    const built = await buildItem();
    expect([built.placement, built.row, built.anchor]).toEqual([
      CARET_PLACE,
      PLACED,
      [
        "position",
        "dropped",
        "it anchors the absolute icon it holds, whose MAX × CENTER constraints place it against this frame",
      ],
    ]);
  });

  it("keeps that place through the open item's half turn", async () => {
    const built = await buildItem({ caret: `${CARET_CLASSES} rotate-180` });
    expect([built.placement, built.rotation, built.row]).toEqual([CARET_PLACE, 180, PLACED]);
  });

  // The one control: `right-[4px]` puts the caret 4px inside the trigger's right edge, as the capture
  // measured it.
  it("places a caret at another right inset the capture measured alike", async () => {
    const built = await buildItem({
      caret: "absolute right-[4px] size-4 shrink-0",
      measured: { ...FACTS, iconPlace: { width: 16, height: 16, right: 4, down: 0 } },
    });
    expect([built.placement, built.row]).toEqual([
      edges({ kind: "end", end: 4 }, { kind: "centre", offset: 0 }),
      PLACED,
    ]);
  });
});

describe("an icon or a box that wins a property outside the caret's shape", () => {
  const ICON_WINS = (property: string) =>
    `the absolute icon wins \`${property}\`, which no absolute icon the kit places wins (\`ICON_PROPERTIES\`)`;
  const BOX_WINS = (property: string) =>
    `the absolute icon's box wins \`${property}\`, which no box of an icon the kit places wins (\`BOX_PROPERTIES\`)`;

  // Each row names the review finding it stages, onto the caret's shape with one change.
  it.each([
    ["a logical size limit (logical-limit)", "[max-inline-size:8px]", "max-inline-size"],
    ["a physical size limit", "max-w-[8px]", "max-width"],
    ["a minimum height", "min-h-[24px]", "min-height"],
    ["a logical margin (logical-margin)", "ms-[8px]", "margin-inline-start"],
    ["a margin shorthand (margin-shorthand)", "[margin:0_0_0_8px]", "margin"],
    ["a motion path (offset-path)", "[offset-path:path('M_8_8_L_32_8')]", "offset-path"],
    ["a zoom (zoom)", "[zoom:2]", "zoom"],
    ["a padding in a content box (content-box)", "box-content p-[4px]", "padding"],
    ["a translate", "translate-y-[1px]", "translate"],
    ["an align-self", "self-start", "align-self"],
    ["a place-self", "place-self-start", "place-self"],
    ["a grid line", "col-start-2", "grid-column-start"],
    ["an animation", "animate-spin", "animation"],
  ])("refuses an icon with %s", async (_case, extra, property) => {
    const built = await buildItem({ caret: `${CARET_CLASSES} ${extra}` });
    expect([built.placement, built.row]).toEqual([undefined, unmapped(ICON_WINS(property))]);
  });

  // `left-0` and `top-0` place an icon as the reviews' fixtures did, at the box's top left.
  it.each([
    ["a left offset (outside-static, resize)", "absolute left-0 size-4 shrink-0", "left"],
    ["a top offset", "absolute right-0 top-0 size-4 shrink-0", "top"],
  ])("refuses an icon with %s", async (_case, caret, property) => {
    const built = await buildItem({ caret });
    expect([built.placement, built.row]).toEqual([undefined, unmapped(ICON_WINS(property))]);
  });

  it.each([
    ["a logical top padding (logical-padding)", "[padding-block-start:16px]", "padding-block-start"],
    ["a padding shorthand (padding-shorthand)", "[padding:16px_0_0]", "padding"],
    ["a flex-flow (corner-padding)", "[flex-flow:column]", "flex-flow"],
    ["a reversed row", "flex-row-reverse", "flex-direction"],
    ["a wrapping row", "flex-wrap", "flex-wrap"],
    ["a place-items", "place-items-start", "place-items"],
    ["a right-to-left direction (rtlborder)", "[direction:rtl]", "direction"],
    ["a vertical writing mode (verticalborder)", "[writing-mode:vertical-rl]", "writing-mode"],
    ["a top border style (border-default, baseline-border)", "[border-top-style:solid]", "border-top-style"],
    ["a reverted top border width (revert-border)", "[border-top-width:revert]", "border-top-width"],
    // Tailwind writes a side's style before its width: `border-x` sets `border-inline-style`, then
    // `border-inline-width`.
    ["a right border", "border-r-[6px]", "border-right-style"],
    ["border-x, which placed in round one", "border-x-[6px]", "border-inline-style"],
    ["border-y (block border)", "border-y-[6px]", "border-block-style"],
    ["a block-start border (block start)", "[border-block-start-width:6px]", "border-block-start-width"],
    ["a scrolling overflow (right-positioner)", "overflow-y-scroll", "overflow-y"],
    ["a fixed height", "h-[40px]", "height"],
  ])("refuses a box with %s", async (_case, extra, property) => {
    const built = await buildItem({ trigger: `${TRIGGER} ${extra}` });
    expect([built.placement, built.row]).toEqual([undefined, unmapped(BOX_WINS(property))]);
  });
});

describe("an icon whose box or the elements around it leave the caret's shape", () => {
  const AROUND_WINS = (property: string) =>
    `an element between the absolute icon's box and the captured root wins \`${property}\`, which none around a placed icon wins (\`AROUND_PROPERTIES\`)`;
  const LATER_WINS = (property: string) =>
    `a layer after the absolute icon's box wins \`${property}\`, which no later layer beside a placed icon wins (\`LATER_PROPERTIES\`), and it can reach over the icon, where Figma draws it on top`;
  const EARLIER =
    "an element precedes the absolute icon, its box or an element around it, where CSS can paint it over the icon and Figma draws it under";
  const FOLLOWED =
    "an element or a text follows the absolute icon in its box, which Figma draws over the icon";
  const NO_COLUMN =
    "a layer follows the absolute icon's box, or an element around it, in a parent that is no block column, so it can sit beside the icon, where Figma draws it on top";
  const GENERATED =
    "the captured root styles a `::before` or `::after`, which can paint beside the absolute icon's box, where Figma draws it in the root's frame";
  const DOT = (classes: string): FixtureElement => ({
    slot: "dot",
    classes: `size-[16px] bg-[#ff0000] ${classes}`,
  });
  const PANEL = "block overflow-hidden pl-7";

  it("places the caret above the open item's panel", async () => {
    const built = await buildItem({
      afterHeader: [{ slot: "panel", classes: PANEL, children: [{ slot: "inner", classes: "pt-1.5" }] }],
    });
    expect([built.placement, built.row]).toEqual([CARET_PLACE, PLACED]);
  });

  it.each([
    // The header's writing mode is inherited by the trigger (inherited-writing).
    [
      "a header in a vertical writing mode",
      { header: "flex [writing-mode:vertical-rl]" },
      AROUND_WINS("writing-mode"),
    ],
    ["a header of a fixed height", { header: "flex h-[8px]" }, AROUND_WINS("height")],
    // CSS paints an earlier positioned box at level 0 by tree order, under the caret, but a later
    // `z-index` or `order` can lift it (level before, will-change before, transform-mode).
    [
      "a relative z-index: 0 element before it in the trigger (level before)",
      { beforeCaret: [DOT("relative z-0")] },
      EARLIER,
    ],
    [
      "an element with a will-change before its header (will-change before)",
      { beforeHeader: [DOT("will-change-transform")] },
      EARLIER,
    ],
    ["an element before its header (transform-mode)", { beforeHeader: [DOT("")] }, EARLIER],
    // The kit draws the trigger's later layers over the caret (normal-media, overridden-mode, the
    // reviews' animated dots).
    ["an element after it in the trigger (normal-media)", { afterCaret: [DOT("")] }, FOLLOWED],
    ["a text after it in the trigger", { textAfter: "more" }, FOLLOWED],
    // A flex row puts a later layer beside the header, where it can reach the caret at another
    // width (resize, overflow-svg, negative-margin-mode, clipped-dot, far-shadow, shadow-overlap).
    [
      "a root that lays the panel beside the header in a flex row",
      { root: `${ROOT.replace("block", "flex")}`, afterHeader: [{ slot: "panel", classes: PANEL }] },
      NO_COLUMN,
    ],
    [
      "a panel that casts a shadow (shadow-overlap)",
      { afterHeader: [{ slot: "panel", classes: `${PANEL} shadow-[0_-8px_0_#000000]` }] },
      LATER_WINS("box-shadow"),
    ],
    [
      "a panel whose child pulls itself up (negative-margin-mode)",
      {
        afterHeader: [
          { slot: "panel", classes: PANEL, children: [{ slot: "inner", classes: "-mt-[16px]" }] },
        ],
      },
      LATER_WINS("margin-top"),
    ],
    [
      "a relative panel at level 0",
      { afterHeader: [{ slot: "panel", classes: `${PANEL} relative z-0` }] },
      LATER_WINS("position"),
    ],
    // A generated box of the root follows the header in tree order, and the review's `clearAround`
    // refused one; its shadow or its negative margin reaches up over the caret.
    [
      "a root ::after that casts a shadow upward",
      { rootPseudo: { after: { classes: "block h-[8px] shadow-[0_-16px_0_#000000]" } } },
      GENERATED,
    ],
    [
      "a root ::after that pulls itself up",
      { rootPseudo: { after: { classes: "block h-[8px] -mt-[24px]" } } },
      GENERATED,
    ],
  ] as const)("refuses an icon beside %s", async (_case, item, why) => {
    const built = await buildItem(item);
    expect([built.placement, built.row]).toEqual([undefined, unmapped(why)]);
  });

  // The tag lifts into the root's frame as its last layer (`blockSteps`), and its column precedes the
  // header, so the caret stays in the flow and the tag keeps its place (injected both, real-lift).
  it("refuses an icon beside a part its root lifts to draw last, which keeps its place", async () => {
    const tagSet = chip({ key: "tagset", name: "Tag", slot: "tag" });
    const { variant, coverage } = await buildCaptured(
      chip({
        parts: [
          part({ key: "col", slot: "col", parts: [instanceOf("tag", tagSet)] }),
          part({
            key: "header",
            slot: "header",
            parts: [part({ key: "trigger", slot: "trigger", label: LABEL, iconsFor: () => [CARET] })],
          }),
        ],
      }),
      rest({
        slot: "chip",
        classes: `relative ${ROOT}`,
        children: [
          {
            slot: "col",
            classes: "flex size-[50px]",
            children: [
              {
                slot: "tag",
                classes: "absolute right-0 top-0",
                measured: { blockSteps: 2, oneLength: ["horizontal", "vertical"] },
              },
            ],
          },
          {
            slot: "header",
            classes: "flex",
            children: [
              {
                slot: "trigger",
                classes: TRIGGER,
                text: "Shipping",
                textIndex: 0,
                children: [{ tag: "svg", classes: CARET_CLASSES, measured: FACTS }],
              },
            ],
          },
        ],
      }),
      {
        variables: makeVariableIndex([FONT_SANS]),
        inner: [{ manifest: tagSet, cells: rest({ slot: "tag", classes: "size-[16px]" }) }],
      }
    );
    const placed = (key: string) => {
      const layer = layersOf(variant).find((each) => each.key === key);
      return layer?.kind === "icon" || layer?.kind === "instance" ? layer.placement : "no layer";
    };
    const row = coverage.find((each) => each.part === "caret" && each.property === "position");
    expect([placed("tag"), placed("caret"), [row?.outcome, row?.detail]]).toEqual([
      edges({ kind: "end", end: 0 }, { kind: "start", start: 0 }),
      undefined,
      unmapped(EARLIER),
    ]);
  });
});

describe("an icon whose measured facts the build's plan does not meet", () => {
  it.each([
    [
      "no uncovered",
      { still: true, iconPlace: PLACE },
      "the capture did not measure CSS painting nothing over the absolute icon in every mode (`uncovered`), while Figma draws the icon over every layer of its box",
    ],
    [
      "no still",
      { uncovered: true, iconPlace: PLACE },
      "the capture did not read `animation-name: none` on every element of the captured root in every mode, without and with reduced motion (`still`), so a consumer's page can run an animation the capture's page stops",
    ],
    [
      "no place",
      { uncovered: true, still: true },
      "the capture measured no one size for the absolute icon inside its box in every mode and as the box grows (`iconPlace`)",
    ],
    [
      "a right inset apart from the plan's",
      { ...FACTS, iconPlace: { width: 16, height: 16, right: 3, down: 0 } },
      "the build places the absolute icon's right edge 0px from its box's, where the capture measured 3px",
    ],
    [
      "no one right inset",
      { ...FACTS, iconPlace: { width: 16, height: 16, down: 0 } },
      "the build places the absolute icon's right edge 0px from its box's, where the capture measured no one length in every mode and as the box grows",
    ],
    [
      "a centre offset apart from the plan's",
      { ...FACTS, iconPlace: { width: 16, height: 16, right: 0, down: 2 } },
      "the build places the absolute icon's centre down 0px from its box's, where the capture measured 2px",
    ],
    [
      "a size apart from the kit's",
      { ...FACTS, iconPlace: { width: 8, height: 8, right: 0, down: 0 } },
      "the kit draws the absolute icon at 16px, where the capture measured it 8 × 8px",
    ],
  ] as const)("refuses an icon the capture measured with %s", async (_case, measured, why) => {
    const built = await buildItem({ measured });
    expect([built.placement, built.row]).toEqual([undefined, unmapped(why)]);
  });

  // A size variable binds a size the plan cannot hold to the measured pixels in every mode, which
  // placed in round one where its bounds were equal.
  it("refuses an icon whose size is a variable", async () => {
    const variables = makeVariableIndex([
      FONT_SANS,
      {
        ref: { collection: "Fuse density", name: "icon-size" },
        webSyntax: "var(--icon-size)",
        minimum: 16,
        maximum: 16,
      },
    ]);
    const built = await buildItem({ caret: "absolute right-0 size-(--icon-size) shrink-0", variables });
    expect([built.placement, built.row]).toEqual([
      undefined,
      unmapped("the kit draws the absolute icon at a variable, where the capture measured it 16 × 16px"),
    ]);
  });

  // A turn other than a quarter or half moves the box off its offsets, so the kit draws the caret
  // unturned in the flow, its turn unmapped with the reason.
  it("refuses an icon that turns 45°, drawing it unturned in the flow", async () => {
    const built = await buildItem({ caret: `${CARET_CLASSES} rotate-45` });
    expect([built.placement, built.rotation, built.row]).toEqual([
      undefined,
      undefined,
      unmapped(
        "the absolute icon turns other than a quarter or half turn about its centre, which moves its box off its offsets"
      ),
    ]);
  });
});
