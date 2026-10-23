/**
 * Unit under test: the Alert component set as the build produces it. Oracle: the Fuse variable or
 * literal each Figma field of a cell must carry, read by hand from `alert-variants.ts`, `alert.tsx`
 * (the Item `outline` variant at the `sm` size, and `ALERT_ICONS`), `item-variants.ts`,
 * `inner-corner/item.ts`, `item-media-variants.ts`, `item-class.ts`, `item-title-classes.ts`,
 * `item-description-classes.ts`, the `item-described` variant in `fuse.css`, Tailwind's spacing and
 * line-height scales, and the docs Variants demo's first row.
 *
 * - The row is 512px wide, the docs column's `max-w-lg`, which its `w-full` fills, on `radius-md`
 *   with a 1px border. It pads `surface-pad-md` across and `row-px` down and spaces its layers with
 *   `surface-gap-sm`.
 * - Each tone fills and strokes the row and colors the text and the icon: default `background`,
 *   `border`, `foreground` and `foreground`; destructive `error/5`, `error`, `error` and `error`;
 *   warning `warning-soft`, `warning`, `warning-soft-foreground` and `warning`; success
 *   `success/5`, `success`, `foreground` and `success`; info `info-soft`, `info`,
 *   `info-soft-foreground` and `info`.
 * - The icon is 20px (`size-5`): Info, WarningOctagon, Warning, CheckCircle and Info by tone.
 * - Beside a description, `item-described:` tops the media and the content, and the media is one
 *   title line tall, `--label-text` times `--leading-snug`, the `label-line-snug` variable.
 * - The title is Medium and the description Regular, both in `label-text`, their lines 137.5%
 *   (`leading-snug`) and 150% (`leading-normal`) of it, a percent that follows the size at each
 *   density (PH). The content column fills the row's spare width with a 4px gap, and both texts
 *   fill it and wrap there. Alert does not clamp the description.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  density,
  FILL,
  fixed,
  HUG,
  literal,
  paint,
  token,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";
import type { ChildLayerSpec, ComponentRootSpec, FrameLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

function alert(variant: string, described: string): ComponentRootSpec {
  return variantRoot(spec, `alert/variant=${variant},described=${described}`);
}

/** The frame of a layer's children that carries a name, or a failure naming it. */
function frame(box: { readonly children: readonly ChildLayerSpec[] }, name: string): FrameLayerSpec {
  const found = box.children.find((child) => child.name === name);
  if (found?.kind !== "frame") {
    throw new Error(`no frame ${name}`);
  }
  return found;
}

/** The one layer a box holds, which a test reads by its kind. */
function only(box: { readonly children: readonly ChildLayerSpec[] }): ChildLayerSpec | undefined {
  expect(box.children).toHaveLength(1);
  return box.children[0];
}

/** Each tone's row fill, row stroke, text color, icon and icon color. */
const TONES = [
  ["default", "background", "border", "foreground", "Info", "foreground"],
  ["destructive", "error/5", "error", "error", "WarningOctagon", "error"],
  ["warning", "warning-soft", "warning", "warning-soft-foreground", "Warning", "warning"],
  ["success", "success/5", "success", "foreground", "CheckCircle", "success"],
  ["info", "info-soft", "info", "info-soft-foreground", "Info", "info"],
] as const;

describe("the Alert component set", () => {
  it("crosses five tones with a description, 10 cells, with columns by `described`", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "alert");
    expect(set?.axes).toEqual([
      { name: "variant", values: ["default", "destructive", "warning", "success", "info"] },
      { name: "described", values: ["off", "on"] },
    ]);
    expect(set?.columnAxis).toBe("described");
    expect(new Set(set?.variants.map((cell) => cell.key)).size).toBe(10);
    expect([set?.textProperties, set?.booleanProperties, set?.swapProperties]).toEqual([
      [
        { name: "Title", defaultValue: "Scheduled maintenance" },
        { name: "Description", defaultValue: "Read-only access tonight from 22:00 to 23:00." },
      ],
      undefined,
      [],
    ]);
  });

  it.each(TONES)(
    "fills the %s row with %s, strokes it with %s, and colors its text %s and its %s icon %s",
    (variant, fill, stroke, text, icon, iconColor) => {
      const root = alert(variant, "on");
      expect([root.sizing, root.cornerRadius, root.fill, root.stroke]).toEqual([
        { horizontal: fixed(literal(512)), vertical: HUG },
        token("radius-md"),
        paint(fill),
        { color: paint(stroke), weight: literal(1) },
      ]);
      expect(only(frame(root, "item-media"))).toMatchObject({
        kind: "icon",
        icon: `icon/${icon}`,
        swapProperty: undefined,
        size: literal(20),
        color: paint(iconColor),
      });
      const content = frame(root, "item-content");
      expect(
        ["item-title", "item-description"].map((name) => {
          const layer = only(frame(content, name));
          return layer?.kind === "text" ? layer.color : undefined;
        })
      ).toEqual([paint(text), paint(text)]);
    }
  );

  it("pads the sm row surface-pad-md across and row-px down, and spaces it with surface-gap-sm", () => {
    const root = alert("default", "off");
    expect([
      root.paddingLeft,
      root.paddingRight,
      root.paddingTop,
      root.paddingBottom,
      root.itemSpacing,
    ]).toEqual([
      density("surface-pad-md"),
      density("surface-pad-md"),
      density("row-px"),
      density("row-px"),
      density("surface-gap-sm"),
    ]);
  });

  it("centers its layers and hugs the icon without a description, and tops them on a label-line-snug media line beside one", () => {
    const off = alert("info", "off");
    const on = alert("info", "on");
    expect([off.counterAlign, frame(off, "item-media").sizing]).toEqual([
      "CENTER",
      { horizontal: HUG, vertical: HUG },
    ]);
    expect([on.counterAlign, frame(on, "item-media").sizing]).toEqual([
      "MIN",
      { horizontal: HUG, vertical: fixed(density("label-line-snug")) },
    ]);
  });

  it("sets the title and the description in label-text, lines 137.5% and 150% of it, wrapping across the column", () => {
    const content = frame(alert("default", "on"), "item-content");
    expect([content.direction, content.sizing, content.itemSpacing]).toEqual([
      "VERTICAL",
      { horizontal: FILL, vertical: HUG },
      literal(4),
    ]);
    expect(frame(content, "item-title").sizing).toEqual({ horizontal: FILL, vertical: HUG });
    expect(only(frame(content, "item-title"))).toMatchObject({
      kind: "text",
      characters: "Scheduled maintenance",
      textProperty: "Title",
      fontFamily: token("font-sans"),
      fontStyle: "Medium",
      fontSize: density("label-text"),
      lineHeight: { kind: "percent", value: 137.5 },
      sizing: { horizontal: FILL, vertical: HUG },
    });
    expect(only(frame(content, "item-description"))).toMatchObject({
      kind: "text",
      characters: "Read-only access tonight from 22:00 to 23:00.",
      textProperty: "Description",
      fontStyle: "Regular",
      fontSize: density("label-text"),
      lineHeight: { kind: "percent", value: 150 },
      sizing: { horizontal: FILL, vertical: HUG },
      truncation: undefined,
    });
    expect(frame(alert("default", "off"), "item-content").children.map((child) => child.name)).toEqual([
      "item-title",
    ]);
  });

  it("drops the rich-text spacing and the ring the warning and info tones set for a focus the row never takes", () => {
    const reasons = (className: string) =>
      new Set(
        coverage
          .filter((row) => row.component === "Alert" && row.className === className)
          .map((row) => `${row.property} ${row.outcome}: ${row.detail}`)
      );
    expect(reasons("rich-text-block:my-0")).toEqual(
      new Set([
        "margin-block dropped: the paragraphs and lists a rich-text description holds, which the set draws as one text",
      ])
    );
    expect(reasons("[--ring:var(--warning-soft-foreground)]")).toEqual(
      new Set(["--ring dropped: the box overrides the synced `ring`, which no layer at or below it reads"])
    );
  });
});
