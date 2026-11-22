import { createElement } from "react";
import type { ComponentProps } from "react";

/**
 * Unit under test: the Segmented toggle group set as the kit builds it, a row of `Toggle` instances
 * at the `first`, `middle` and `last` values of the Toggle set's `segment` axis, each drawn by that
 * Toggle variant's padding, minimum width, height, strokes and corners, and the group root's
 * corner and shadow.
 * Oracle: Chromium's layout of the real Fuse `<ToggleGroup.Root spacing={0}>` of the docs Segmented
 * demos, Day, Week and Month, at every variant and size, in every mode the capture measures. The
 * test resolves each length of the built spec in that mode through the CSS its synced variable
 * stands for, lays the row out as Figma's auto layout does, each item hugging its label inside its
 * padding and the room its strokes take above its minimum width, and checks each item's label, pressed value, padding, place,
 * size and side strokes, its four corners as Figma caps them against the corners Chromium draws once
 * CSS scales them (CSS Backgrounds 3 §5.5), and the root's shadow against Chromium's. It goes red
 * where the build draws an item's label, inset, left border or corners other than a segmented group
 * does.
 */
import { Result } from "effect";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ToggleGroup } from "../../../fuse/dist/toggle-group.js";
import { builtKit } from "../../test/built-kit.ts";
import { openFusePage } from "../../test/fuse-page.ts";
import { EVERY_MODE } from "../capture/page-modes.ts";
import { fuseVariableSet } from "../fuse-variable-set.ts";
import { cornerLengths } from "./corner-spec.ts";
import { strokeRoom } from "./kit-spec.ts";
import type { ComponentSetSpec, NumberSpec, StrokeSide } from "./kit-spec.ts";

/** How far apart, in CSS pixels, a Figma length and Chromium's may sit: a few 64ths of a pixel. */
const TOLERANCE_PX = 0.05;

/** The docs Segmented demos' items, Week pressed. */
const ITEMS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
] as const;

const VARIANTS = ["default", "outline"] as const;

const SIZES = ["default", "xs", "sm", "lg"] as const;

/** A sample: one variant and size, as the Segmented set's cell names them. */
type Sample = { readonly variant: (typeof VARIANTS)[number]; readonly size: (typeof SIZES)[number] };

const SAMPLES: readonly Sample[] = VARIANTS.flatMap((variant) => SIZES.map((size) => ({ variant, size })));

const SIDES = ["top", "right", "bottom", "left"] as const satisfies readonly StrokeSide[];

/** Every sample group, each in a slot of its own, and the probe the page measures lengths with. */
function segmentedSlots(): readonly string[] {
  const slots = SAMPLES.map(({ variant, size }) => {
    const props: ComponentProps<typeof ToggleGroup.Root> = {
      "aria-label": "Period",
      defaultValue: ["week"],
      spacing: 0,
    };
    if (variant !== "default") {
      props.variant = variant;
    }
    if (size !== "default") {
      props.size = size;
    }
    const group = createElement(
      ToggleGroup.Root,
      props,
      ...ITEMS.map((item) =>
        createElement(ToggleGroup.Item, { key: item.value, value: item.value }, item.label)
      )
    );
    return `<div data-sample="${variant}/${size}" style="display:flex;margin:8px">${renderToStaticMarkup(group)}</div>`;
  });
  return [...slots, `<div id="probe" style="position:absolute;height:0"></div>`];
}

/** What the page measures of one item in one mode, in CSS pixels. */
type MeasuredItem = {
  /** The item's left edge from the group's. */
  readonly x: number;
  readonly width: number;
  readonly height: number;
  /** The label's text. */
  readonly label: string;
  /** The button's `aria-pressed`. */
  readonly pressed: string | null;
  readonly padding: Readonly<Record<"left" | "right", number>>;
  /** The width of the label's text. */
  readonly text: number;
  readonly borders: Readonly<Record<StrokeSide, number>>;
  /** The corners Chromium draws, top left first, clockwise, after CSS scales them. */
  readonly corners: readonly number[];
};

/** What the page measures of one sample group in one mode. */
type Measured = {
  readonly sample: string;
  readonly mode: string;
  readonly width: number;
  readonly height: number;
  readonly shadow: boolean;
  /** The group's top left corner as Chromium draws it, which its others match. */
  readonly corner: number;
  readonly items: readonly MeasuredItem[];
  /** The pixels each CSS length the built spec names computes to in this mode, by its CSS. */
  readonly lengths: Readonly<Record<string, number>>;
};

/**
 * Measure every sample group in every mode, once its fonts have loaded there, and compute each of
 * the given CSS lengths in that mode on a probe.
 */
function measureEveryMode(page: Page, lengths: readonly string[]): Promise<readonly Measured[]> {
  return page.evaluate(
    async ({ modes, lengths: css }) => {
      const out: Measured[] = [];
      for (const mode of modes) {
        for (const [name, value] of Object.entries(mode.root)) {
          document.documentElement.setAttribute(name, value);
        }
        for (const [name, value] of Object.entries(mode.body)) {
          document.body.setAttribute(name, value);
        }
        const items = [...document.querySelectorAll('[data-slot="toggle-group-item"]')];
        await Promise.all(items.map((item) => document.fonts.load(getComputedStyle(item).font)));
        await document.fonts.ready;
        const probe = document.querySelector("#probe");
        if (!(probe instanceof HTMLElement)) {
          throw new Error("the page holds no probe");
        }
        const computed = Object.fromEntries(
          css.map((length) => {
            probe.style.width = length;
            return [length, probe.getBoundingClientRect().width];
          })
        );
        for (const slot of document.querySelectorAll("[data-sample]")) {
          const group = slot.querySelector('[data-slot="toggle-group"]');
          if (group === null) {
            throw new Error("a sample lacks its group");
          }
          const box = group.getBoundingClientRect();
          out.push({
            sample: slot.getAttribute("data-sample") ?? "",
            mode: JSON.stringify(mode),
            width: box.width,
            height: box.height,
            shadow: getComputedStyle(group).boxShadow !== "none",
            corner: Math.min(
              Number.parseFloat(getComputedStyle(group).borderTopLeftRadius),
              Math.min(box.width, box.height) / 2
            ),
            items: [...group.querySelectorAll('[data-slot="toggle-group-item"]')].map((item) => {
              const style = getComputedStyle(item);
              const px = (property: string) => Number.parseFloat(style.getPropertyValue(property));
              const own = item.getBoundingClientRect();
              const range = document.createRange();
              range.selectNodeContents(item);
              const radii = ["top-left", "top-right", "bottom-right", "bottom-left"].map((corner) =>
                px(`border-${corner}-radius`)
              );
              const [topLeft = 0, topRight = 0, bottomRight = 0, bottomLeft = 0] = radii;
              // CSS Backgrounds 3 §5.5: one factor scales every radius where the radii along a side overrun it.
              const ratio = (length: number, sum: number) => (sum === 0 ? 1 : length / sum);
              const factor = Math.min(
                1,
                ratio(own.width, topLeft + topRight),
                ratio(own.height, topRight + bottomRight),
                ratio(own.width, bottomRight + bottomLeft),
                ratio(own.height, bottomLeft + topLeft)
              );
              return {
                x: own.left - box.left,
                width: own.width,
                height: own.height,
                label: item.textContent,
                pressed: item.getAttribute("aria-pressed"),
                padding: { left: px("padding-left"), right: px("padding-right") },
                text: range.getBoundingClientRect().width,
                borders: {
                  top: px("border-top-width"),
                  right: px("border-right-width"),
                  bottom: px("border-bottom-width"),
                  left: px("border-left-width"),
                },
                corners: radii.map((radius) => radius * factor),
              };
            }),
            lengths: computed,
          });
        }
      }
      return out;
    },
    { modes: EVERY_MODE, lengths }
  );
}

/** The CSS each synced variable stands for, by `collection/name`, as the sync writes its code syntax. */
function variableCss(): ReadonlyMap<string, string> {
  const set = fuseVariableSet();
  if (Result.isFailure(set)) {
    throw new Error("the Fuse variable set does not build");
  }
  return new Map(
    set.success.collections.flatMap((collection) =>
      collection.variables.flatMap((variable) =>
        variable.webSyntax === undefined ? [] : [[`${collection.name}/${variable.name}`, variable.webSyntax]]
      )
    )
  );
}

/** The CSS a spec length draws: a literal's pixels, or the CSS its variable stands for. */
function cssOf(number: NumberSpec, css: ReadonlyMap<string, string>): string {
  if (number.kind === "literal") {
    return `${String(number.value)}px`;
  }
  const syntax = css.get(`${number.variable.collection}/${number.variable.name}`);
  if (syntax === undefined) {
    throw new Error(`no CSS for ${number.variable.name}`);
  }
  return syntax;
}

/**
 * What the built set gives one item: the label its instance shows, its variant root's lengths, as
 * CSS, the room its strokes take in the row's layout on each side, and the weight each side paints.
 */
type BuiltItem = {
  readonly segment: string | undefined;
  /** The Toggle variant's `pressed` value. */
  readonly pressed: string | undefined;
  readonly label: string;
  readonly paddingLeft: string;
  readonly paddingRight: string;
  readonly minWidth: string;
  readonly height: string;
  readonly room: Readonly<Record<"left" | "right", string>>;
  readonly strokes: Readonly<Record<StrokeSide, number>>;
  /** The four corners, top left first, clockwise, a uniform radius on each. */
  readonly corners: readonly string[];
};

/** What the built set gives one sample group: its root's corner and shadow, and its items. */
type BuiltGroup = {
  readonly itemSpacing: string;
  readonly corner: string;
  readonly shadow: boolean;
  readonly items: readonly BuiltItem[];
};

/** Read the built Segmented toggle group set's sample groups, by `variant/size`. */
function builtGroups(
  sets: readonly ComponentSetSpec[],
  css: ReadonlyMap<string, string>
): ReadonlyMap<string, BuiltGroup> {
  const set = sets.find((each) => each.key === "segmented-toggle-group");
  const toggle = sets.find((each) => each.key === "toggle");
  if (set === undefined || toggle === undefined) {
    throw new Error("the build holds no Segmented toggle group or Toggle set");
  }
  const toggleRoots = new Map(toggle.variants.map((variant) => [variant.key, variant] as const));
  const defaultLabel = toggle.textProperties.find((property) => property.name === "Label")?.defaultValue;
  const length = (number: NumberSpec | undefined): string => {
    if (number === undefined) {
      throw new Error("a built item lacks a length the row reads");
    }
    return cssOf(number, css);
  };
  return new Map(
    set.variants.map((variant) => {
      const { root } = variant;
      const items = root.children.map((child): BuiltItem => {
        if (child.kind !== "instance") {
          throw new Error("a segmented group holds a layer that is no instance");
        }
        const inner = toggleRoots.get(child.variant);
        if (inner === undefined) {
          throw new Error(`the Toggle set holds no ${child.variant}`);
        }
        const { stroke, sizing, limits } = inner.root;
        const every =
          stroke === undefined
            ? 0
            : "sides" in stroke || stroke.weight.kind !== "literal"
              ? Number.NaN
              : stroke.weight.value;
        const strokes =
          stroke !== undefined && "sides" in stroke
            ? stroke.sides
            : { top: every, right: every, bottom: every, left: every };
        const corners = cornerLengths(inner.root.cornerRadius);
        return {
          segment: inner.properties.segment,
          pressed: inner.properties.pressed,
          label: child.properties?.text?.Label ?? defaultLabel ?? "",
          paddingLeft: length(inner.root.paddingLeft),
          paddingRight: length(inner.root.paddingRight),
          minWidth: length(limits.minWidth),
          height: length(sizing.vertical.kind === "fixed" ? sizing.vertical.length : undefined),
          room: { left: length(strokeRoom(stroke, "left")), right: length(strokeRoom(stroke, "right")) },
          strokes,
          corners: (corners.length === 1 ? [0, 1, 2, 3].map(() => corners[0]) : corners).map((corner) =>
            length(corner)
          ),
        };
      });
      const [corner, ...others] = cornerLengths(root.cornerRadius);
      if (corner === undefined || others.length > 0) {
        throw new Error("the built group root holds no one corner");
      }
      return [
        `${variant.properties.variant ?? ""}/${variant.properties.size ?? ""}`,
        {
          itemSpacing: length(root.itemSpacing),
          corner: cssOf(corner, css),
          shadow: root.shadows.length > 0,
          items,
        },
      ] as const;
    })
  );
}

let browser: Browser;
let measured: readonly Measured[];
let built: ReadonlyMap<string, BuiltGroup>;

beforeAll(async () => {
  const { spec } = await builtKit();
  built = builtGroups(spec.componentSets, variableCss());
  const lengths = [
    ...new Set(
      [...built.values()].flatMap((group) => [
        group.itemSpacing,
        group.corner,
        ...group.items.flatMap((item) => [
          item.paddingLeft,
          item.paddingRight,
          item.room.left,
          item.room.right,
          item.minWidth,
          item.height,
          ...item.corners,
        ]),
      ])
    ),
  ];
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await openFusePage(page, { body: segmentedSlots().join("\n") });
  measured = await measureEveryMode(page, lengths);
}, 300_000);

afterAll(async () => {
  await browser.close();
});

describe("the segmented toggle group, placed as Figma lays out the built set", () => {
  it("builds every sample from the first, middle and last Toggle segments", () => {
    expect(
      SAMPLES.map(({ variant, size }) => built.get(`${variant}/${size}`)?.items.map((item) => item.segment))
    ).toEqual(SAMPLES.map(() => ["first", "middle", "last"]));
  });

  it("measures every sample in every mode", () => {
    expect(measured).toHaveLength(SAMPLES.length * EVERY_MODE.length);
  });

  it("matches Chromium's items, their strokes and corners, and the group's size and shadow", () => {
    const apart = measured.flatMap((sample) => {
      const group = built.get(sample.sample);
      if (group === undefined) {
        throw new Error(`the build holds no ${sample.sample} group`);
      }
      const px = (css: string): number => sample.lengths[css] ?? Number.NaN;
      const where = `${sample.sample} ${sample.mode}`;
      const differ = (field: string, figma: number, chromium: number): string[] =>
        Math.abs(figma - chromium) <= TOLERANCE_PX
          ? []
          : [`${where}: ${field} ${String(figma)} in Figma, ${String(chromium)} in Chromium`];
      let x = 0;
      const items = group.items.flatMap((item, index) => {
        const chromium = sample.items[index];
        if (chromium === undefined) {
          return [`${where}: Chromium draws no item ${String(index)}`];
        }
        // The instance shows Chromium's label, so the label's measured advance is its text's width.
        if (item.label !== chromium.label) {
          return [
            `${where}: item ${String(index)} shows "${item.label}" in Figma, "${chromium.label}" in Chromium`,
          ];
        }
        if (item.pressed !== chromium.pressed) {
          return [
            `${where}: item ${String(index)} is pressed=${String(item.pressed)} in Figma, aria-pressed=${String(chromium.pressed)} in Chromium`,
          ];
        }
        // A stroke takes the room `strokeRoom` gives it in the layout (PS), and the item hugs its
        // label above its minimum.
        const width = Math.max(
          px(item.minWidth),
          px(item.room.left) +
            px(item.paddingLeft) +
            chromium.text +
            px(item.paddingRight) +
            px(item.room.right)
        );
        const height = px(item.height);
        // Figma caps each corner at half the shorter side (probe P10).
        const corners = item.corners.map((corner) => Math.min(px(corner), Math.min(width, height) / 2));
        const placed = x;
        x += width + px(group.itemSpacing);
        return [
          ...differ(`item ${String(index)} x`, placed, chromium.x),
          ...differ(`item ${String(index)} width`, width, chromium.width),
          ...differ(`item ${String(index)} height`, height, chromium.height),
          ...differ(`item ${String(index)} left padding`, px(item.paddingLeft), chromium.padding.left),
          ...differ(`item ${String(index)} right padding`, px(item.paddingRight), chromium.padding.right),
          ...differ(`item ${String(index)} left stroke room`, px(item.room.left), chromium.borders.left),
          ...differ(`item ${String(index)} right stroke room`, px(item.room.right), chromium.borders.right),
          ...SIDES.flatMap((side) =>
            differ(`item ${String(index)} ${side} stroke`, item.strokes[side], chromium.borders[side])
          ),
          ...corners.flatMap((corner, at) =>
            differ(`item ${String(index)} corner ${String(at)}`, corner, chromium.corners[at] ?? Number.NaN)
          ),
        ];
      });
      const rowHeight = Math.max(...group.items.map((item) => px(item.height)));
      return [
        ...items,
        ...differ("group width", x - px(group.itemSpacing), sample.width),
        ...differ("group height", rowHeight, sample.height),
        ...differ("group corner", Math.min(px(group.corner), Math.min(x, rowHeight) / 2), sample.corner),
        ...(group.shadow === sample.shadow
          ? []
          : [
              `${where}: the group casts ${group.shadow ? "a" : "no"} shadow in Figma and the reverse in Chromium`,
            ]),
      ];
    });
    expect(apart).toEqual([]);
  });
});
