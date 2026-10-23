/**
 * Unit under test: the Select trigger component set as the build produces it. Oracle: the Fuse
 * variable or literal each Figma field of a cell must carry, read by hand from
 * `selectTriggerVariants` in `select-variants.ts`, the field box chrome in `field-box.ts`, the
 * state faces in `state-face.ts`, the control size label in `control-size.ts`, the focus ring in
 * `styles/utils.ts` and Tailwind's `shadow-xs`, and from Chromium's rendering of the docs Basic
 * demo's trigger with Fuse's built CSS on 2026-10-23:
 *
 * - The trigger hugs its value and caret: 110.5px dense, the 1px border, the 10px inset, the 66.5px
 *   placeholder, the 6px gap, the 16px caret, the inset and the border. Its height is the control
 *   height, 36px dense and 32px at sm.
 * - The value is as wide as its text, so its `flex-1` takes no room. The trigger's
 *   `*:data-[slot=select-value]:flex` sorts after its `line-clamp-1`, so the value computes
 *   `display: flex` with `-webkit-line-clamp: 1` and `text-overflow: clip`, and clips with no ellipsis.
 * - The text paints `muted-foreground` while the trigger carries `data-placeholder`, the page's
 *   `foreground` for a value, and the `error` an invalid Field root sets through
 *   `data-invalid:text-error` for an invalid value. The caret paints `muted-foreground` in every cell.
 * - The caret computes `rotate: 180deg` while the trigger carries `data-popup-open`, disabled too,
 *   and `none` otherwise.
 * - Disabled dims the trigger to 50% on its card fill.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  density,
  ERROR_RING,
  fixed,
  FOCUS_RING,
  HUG,
  literal,
  paint,
  SHADOW_XS,
  token,
  UNLIMITED,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";
import type { ChildLayerSpec, ComponentRootSpec, TextLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

const SIZES = ["default", "sm"];
const STATES = ["rest", "focus", "disabled", "invalid"];
const CONTENTS = ["placeholder", "value"];
const OPENS = ["off", "on"];

/** Every cell of the matrix, as its axis values. */
const CELLS = SIZES.flatMap((size) =>
  STATES.flatMap((state) =>
    CONTENTS.flatMap((content) => OPENS.map((open) => ({ size, state, content, open })))
  )
);

function trigger(size: string, state: string, content: string, open: string): ComponentRootSpec {
  return variantRoot(spec, `select-trigger/size=${size},state=${state},content=${content},open=${open}`);
}

/** The value's text, the one layer of the value frame, the trigger's first layer. */
function textOf(root: ComponentRootSpec): TextLayerSpec | undefined {
  const [value] = root.children;
  const [text] = value?.kind === "frame" ? value.children : [];
  return text?.kind === "text" ? text : undefined;
}

/** The caret, the trigger's last layer. */
function caretOf(root: ComponentRootSpec): ChildLayerSpec | undefined {
  return root.children.at(-1);
}

/** The muted 16px CaretDown the trigger always renders, unturned. */
const CARET = {
  kind: "icon",
  key: "caret",
  name: "Caret",
  icon: "icon/CaretDown",
  swapProperty: undefined,
  size: literal(16),
  color: paint("muted-foreground"),
} as const;

describe("the Select trigger component set", () => {
  it("holds 2 sizes in 4 states, placeholder and value, closed and open, on the Select page with one Value property", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "select-trigger");
    expect([set?.name, set?.page]).toEqual(["Select trigger", "page/select"]);
    expect(set?.axes).toEqual([
      { name: "size", values: SIZES },
      { name: "state", values: STATES },
      { name: "content", values: CONTENTS },
      { name: "open", values: OPENS },
    ]);
    expect(set?.columnAxis).toBe("state");
    expect(new Set(set?.variants.map((cell) => cell.key)).size).toBe(32);
    // The docs Basic demo's placeholder.
    expect([set?.textProperties, set?.swapProperties]).toEqual([
      [{ name: "Value", defaultValue: "Pick a fruit" }],
      [],
    ]);
  });

  it("draws a card field box that hugs its value and caret and spaces them to its ends", () => {
    expect(trigger("default", "rest", "placeholder", "off")).toEqual({
      name: "select-trigger",
      direction: "HORIZONTAL",
      sizing: { horizontal: HUG, vertical: fixed(density("control-h-md")) },
      limits: UNLIMITED,
      clips: true,
      paddingTop: literal(0),
      paddingRight: density("control-px-md"),
      paddingBottom: literal(0),
      paddingLeft: density("control-px-md"),
      itemSpacing: density("control-gap-md"),
      primaryAlign: "SPACE_BETWEEN",
      counterAlign: "CENTER",
      cornerRadius: token("radius-field-box"),
      fill: paint("card"),
      stroke: { color: paint("input"), weight: literal(1) },
      shadows: [SHADOW_XS],
      opacity: 1,
      children: [
        {
          kind: "frame",
          key: "value",
          name: "select-value",
          direction: "HORIZONTAL",
          sizing: { horizontal: HUG, vertical: HUG },
          limits: UNLIMITED,
          clips: true,
          paddingTop: literal(0),
          paddingRight: literal(0),
          paddingBottom: literal(0),
          paddingLeft: literal(0),
          itemSpacing: literal(6),
          primaryAlign: "CENTER",
          counterAlign: "CENTER",
          cornerRadius: literal(0),
          fill: undefined,
          stroke: undefined,
          shadows: [],
          opacity: 1,
          children: [
            {
              kind: "text",
              key: "value",
              name: "value",
              characters: "Pick a fruit",
              textProperty: "Value",
              fontFamily: token("font-sans"),
              fontStyle: "Regular",
              fontSize: density("control-text"),
              lineHeight: density("control-leading"),
              color: paint("muted-foreground"),
              underline: undefined,
              sizing: { horizontal: HUG, vertical: HUG },
              align: { horizontal: "LEFT", vertical: "TOP" },
              truncation: undefined,
            },
          ],
        },
        CARET,
      ],
    });
  });

  it("draws sm at the sm height, inset and gap, with its value in fixed 14/20 type", () => {
    const small = trigger("sm", "rest", "placeholder", "off");
    expect([small.sizing.vertical, small.paddingLeft, small.paddingRight, small.itemSpacing]).toEqual([
      fixed(density("control-h-sm")),
      density("control-px-sm"),
      density("control-px-sm"),
      density("control-gap-sm"),
    ]);
    const text = textOf(small);
    expect([text?.fontSize, text?.lineHeight]).toEqual([literal(14), literal(20)]);
  });

  it("paints the placeholder muted-foreground, a value foreground, an invalid value error, and the caret muted", () => {
    const colors = (content: string) =>
      STATES.map((state) => textOf(trigger("default", state, content, "off"))?.color);
    expect(colors("placeholder")).toEqual(STATES.map(() => paint("muted-foreground")));
    expect(colors("value")).toEqual([
      paint("foreground"),
      paint("foreground"),
      paint("foreground"),
      paint("error"),
    ]);
    for (const { size, state, content, open } of CELLS) {
      const caret = caretOf(trigger(size, state, content, open));
      expect(caret?.kind === "icon" && caret.color).toEqual(paint("muted-foreground"));
    }
  });

  it("rings focus, strokes and rings invalid with error, and dims disabled to 50% on the card fill", () => {
    for (const content of CONTENTS) {
      const focus = trigger("default", "focus", content, "off");
      expect([focus.stroke?.color, focus.shadows]).toEqual([paint("input"), [FOCUS_RING, SHADOW_XS]]);
      const invalid = trigger("default", "invalid", content, "off");
      expect([invalid.stroke?.color, invalid.shadows]).toEqual([paint("error"), [ERROR_RING, SHADOW_XS]]);
      const disabled = trigger("default", "disabled", content, "off");
      expect([disabled.opacity, disabled.fill]).toEqual([0.5, paint("card")]);
    }
  });

  it("draws each open cell as its closed cell with the caret turned half a turn", () => {
    for (const { size, state, content } of CELLS) {
      const closed = trigger(size, state, content, "off");
      expect(caretOf(closed), `${size} ${state} ${content}`).toEqual(CARET);
      expect(trigger(size, state, content, "on"), `${size} ${state} ${content}`).toEqual({
        ...closed,
        children: [...closed.children.slice(0, -1), { ...CARET, rotation: 180 }],
      });
    }
  });

  it("drops the value's grow and line clamp, the shell's custom properties and the Field's stretch, each with its reason", () => {
    const reasons = (part: string, match: (className: string) => boolean) =>
      new Set(
        coverage
          .filter((row) => row.component === "Select trigger" && row.part === part && match(row.className))
          .map((row) => `${row.property} ${row.outcome}: ${row.detail}`)
      );
    expect(reasons("select-value", (className) => className === "flex-1")).toEqual(
      new Set(["flex dropped: the row hugs its layers, so the one layer that grows has no room to grow into"])
    );
    expect(
      reasons("select-trigger", (className) => className === "*:data-[slot=select-value]:line-clamp-1")
    ).toEqual(
      new Set([
        "overflow literal: the box clips its content",
        "-webkit-box-orient dropped: the box's display is flex, and a line clamp takes effect only in a -webkit-box",
        "-webkit-line-clamp dropped: the box's display is flex, and a line clamp takes effect only in a -webkit-box",
      ])
    );
    expect(
      reasons("select-trigger", (className) =>
        ["[--shell-inner:", "[--shell-corner:", "[--inner-corner:"].some((prefix) =>
          className.startsWith(prefix)
        )
      )
    ).toEqual(
      new Set([
        "--shell-inner dropped: a custom property passes its value down, and no part or icon below reads it",
        "--shell-corner dropped: a custom property passes its value down, and no part or icon below reads it",
        "--inner-corner dropped: a custom property passes its value down, and no part or icon below reads it",
      ])
    );
    expect(reasons("field", (className) => className.startsWith("[&>:where("))).toEqual(
      new Set([
        "width dropped: the Field stretches the trigger across its own width, which the set does not draw, and the trigger hugs its value as it does outside a Field",
      ])
    );
  });
});
