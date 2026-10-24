/**
 * Unit under test: the Empty component set as the build produces it. Oracle: the Fuse variable or
 * literal each Figma field of a cell must carry, read by hand from `empty-variants.ts`,
 * `inner-corner/empty.ts`, Tailwind's spacing, type and tracking scales, the docs Basic demo's copy,
 * the lengths Chromium draws a 1px dashed border with (3px dashes, 2px gaps), and probe P7, where a
 * hugging Figma text with a `maxWidth` wraps there.
 *
 * - The root is a centered `flex flex-col` column, 512px wide, the preview width a block-level root
 *   takes, with a 24px gap and `rounded-lg`. A desktop window holds `md:`, so the padding is
 *   `calc(2 * var(--surface-pad-lg))`, which binds `empty-pad-desktop`.
 * - `outline` strokes the root 1px with `border`, and `outline-dashed` with the same stroke in 3px
 *   dashes and 2px gaps.
 * - The header is a column at the start of its length that centers its layers across, with an 8px
 *   gap, hugging up to `max-w-sm`, 384px.
 * - The icon media is a 40px `muted` square on `radius-lg` holding a 24px Tray in `foreground`. Its
 *   `mb-2` is the 8px bottom padding of a frame around it, which the `Media` property hides.
 * - The title is 18/28 Medium in the page's `foreground` with `tracking-tight`, -0.025em, and the
 *   description 14/22.75 Regular in `muted-foreground`, behind the `Description` property. Both hug
 *   their text up to the header's 384px, their lines centered.
 * - The content is the docs With actions demo's: `Empty.Content`'s `w-full max-w-sm flex flex-col
 *   items-center gap-4` column, filling the root's width up to 384px, around a default and a secondary
 *   Button at the default size, `Create order` and `Import orders`. Their own classes draw them, but
 *   the root's `text-center` reaches their labels, where the Button set draws its labels at the left,
 *   so each instance centers its label with an override (NA). The docs Basic demo shows no content, so the
 *   `Actions` property starts false, which hides the content in every cell (PQ).
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  CENTERED_BOX,
  density,
  FILL,
  fixed,
  fixedSize,
  HUG,
  literal,
  paint,
  token,
  UNLIMITED,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";
import type { StrokeSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

/** A frame with no padding, gap, paint or corner that hugs both ways and does not clip. */
const FRAME = {
  ...CENTERED_BOX,
  sizing: { horizontal: HUG, vertical: HUG },
  clips: false,
  cornerRadius: literal(0),
  fill: undefined,
  stroke: undefined,
} as const;

/** A text that hugs up to the header's 384px, its lines centered, in a type and color. */
const text = (
  characters: string,
  textProperty: string,
  type: { fontStyle: string; fontSize: number; lineHeight: number },
  color: string
) => ({
  kind: "text",
  key: "text",
  name: "text",
  characters,
  textProperty,
  fontFamily: token("font-sans"),
  fontStyle: type.fontStyle,
  fontSize: literal(type.fontSize),
  lineHeight: literal(type.lineHeight),
  color: paint(color),
  underline: undefined,
  sizing: { horizontal: HUG, vertical: HUG },
  align: { horizontal: "CENTER", vertical: "TOP" },
  truncation: undefined,
  maxWidth: literal(384),
});

/** The header every cell holds: the icon media, the title and the description. */
const HEADER = {
  ...FRAME,
  kind: "frame",
  key: "header",
  name: "empty-header",
  direction: "VERTICAL",
  limits: { ...UNLIMITED, maxWidth: literal(384) },
  itemSpacing: literal(8),
  primaryAlign: "MIN",
  counterAlign: "CENTER",
  children: [
    {
      ...FRAME,
      kind: "frame",
      key: "media",
      name: "empty-media",
      visibleProperty: "Media",
      paddingBottom: literal(8),
      children: [
        {
          ...FRAME,
          kind: "frame",
          key: "box",
          name: "box",
          sizing: fixedSize(literal(40), literal(40)),
          cornerRadius: token("radius-lg"),
          fill: paint("muted"),
          children: [
            {
              kind: "icon",
              key: "icon",
              name: "Icon",
              icon: "icon/Tray",
              swapProperty: "Icon",
              size: literal(24),
              color: paint("foreground"),
            },
          ],
        },
      ],
    },
    {
      ...FRAME,
      kind: "frame",
      key: "title",
      name: "empty-title",
      children: [
        {
          ...text(
            "No orders yet",
            "Title",
            { fontStyle: "Medium", fontSize: 18, lineHeight: 28 },
            "foreground"
          ),
          letterSpacing: { unit: "PERCENT", value: -2.5 },
        },
      ],
    },
    {
      ...FRAME,
      kind: "frame",
      key: "description",
      name: "empty-description",
      visibleProperty: "Description",
      children: [
        text(
          "Orders you create will show up here.",
          "Description text",
          { fontStyle: "Regular", fontSize: 14, lineHeight: 22.75 },
          "muted-foreground"
        ),
      ],
    },
  ],
};

/** A Button of a variant at the default size, at rest with no icon, as an exposed instance. */
const action = (key: string, variant: string, label: string) => ({
  kind: "instance",
  key,
  name: "button",
  componentSet: "button",
  variant: `button/variant=${variant},size=default,state=rest,icon=none`,
  sizing: { horizontal: HUG, vertical: fixed(density("control-h-md")) },
  properties: { text: { Label: label } },
  overrides: [{ path: ["label"], field: "textAlign", horizontal: "CENTER" }],
  exposed: true,
});

/** The content, behind the `Actions` property, holding the With actions demo's two Buttons. */
const CONTENT = {
  ...FRAME,
  kind: "frame",
  key: "content",
  name: "empty-content",
  visibleProperty: "Actions",
  direction: "VERTICAL",
  sizing: { horizontal: FILL, vertical: HUG },
  limits: { ...UNLIMITED, maxWidth: literal(384) },
  itemSpacing: literal(16),
  primaryAlign: "MIN",
  counterAlign: "CENTER",
  children: [action("primary", "default", "Create order"), action("secondary", "secondary", "Import orders")],
};

/** The root of a cell with its stroke. */
const root = (stroke: StrokeSpec | undefined) => ({
  name: "empty",
  ...CENTERED_BOX,
  direction: "VERTICAL",
  sizing: { horizontal: fixed(literal(512)), vertical: HUG },
  clips: true,
  paddingTop: density("empty-pad-desktop"),
  paddingRight: density("empty-pad-desktop"),
  paddingBottom: density("empty-pad-desktop"),
  paddingLeft: density("empty-pad-desktop"),
  itemSpacing: literal(24),
  cornerRadius: token("radius-lg"),
  fill: undefined,
  stroke,
  children: [HEADER, CONTENT],
});

/** The 1px `border` stroke the outline frames draw. */
const BORDER = { color: paint("border"), weight: literal(1) };

/** The rows of Empty's coverage for a class, as property, outcome and detail. */
function rows(className: string): ReadonlySet<string> {
  return new Set(
    coverage
      .filter((row) => row.component === "Empty" && row.className === className)
      .map((row) => `${row.property} ${row.outcome}: ${row.detail}`)
  );
}

describe("the Empty component set", () => {
  it("holds the three frames on the Empty page, with the media, the description and the actions behind properties", () => {
    const empty = spec.componentSets.find((set) => set.key === "empty");
    expect([empty?.name, empty?.page, empty?.axes, empty?.columnAxis]).toEqual([
      "Empty",
      "page/empty",
      [{ name: "variant", values: ["default", "outline", "outline-dashed"] }],
      "variant",
    ]);
    expect([empty?.textProperties, empty?.booleanProperties, empty?.swapProperties]).toEqual([
      [
        { name: "Title", defaultValue: "No orders yet" },
        { name: "Description text", defaultValue: "Orders you create will show up here." },
      ],
      [
        { name: "Media", defaultValue: true },
        { name: "Description", defaultValue: true },
        { name: "Actions", defaultValue: false },
      ],
      [{ name: "Icon", defaultIcon: "icon/Tray" }],
    ]);
  });

  it.each([
    ["default", undefined],
    ["outline", BORDER],
    ["outline-dashed", { ...BORDER, dashPattern: [3, 2] }],
  ])("draws the %s frame", (variant, stroke) => {
    expect(variantRoot(spec, `empty/variant=${variant}`)).toEqual(root(stroke));
  });

  it("drops the root's flex, the even lines, the Buttons' even lines and the shell's inner corner, each with its reason", () => {
    expect(rows("flex-1")).toEqual(
      new Set(["flex dropped: the component's root sits in no flex line, so nothing grows or shrinks it"])
    );
    expect(rows("text-balance")).toEqual(
      new Set([
        "text-wrap-mode literal: the label wraps at the max width the boxes around it set",
        "text-wrap-style dropped: a Figma text fills each line before it starts the next, so it cannot even out its lines",
        "text-wrap-mode dropped: the cell shows no text",
        "text-wrap-style dropped: the label keeps to one line, so it breaks no lines to choose",
      ])
    );
    expect(rows("[--inner-corner:var(--shell-inner)]")).toEqual(
      new Set([
        "--inner-corner dropped: a custom property passes its value down, and no part or icon below reads it",
      ])
    );
  });
});
