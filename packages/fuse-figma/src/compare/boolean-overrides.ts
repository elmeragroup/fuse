/**
 * The self-check's control for BOOLEAN overrides. Since #769 a preview places one extra instance per
 * BOOLEAN property at its non-default value, and the page mounts it with that property on or off.
 * The fake snapshot and the second render come from the same renderer, so the comparison passes a
 * renderer that ignores the property. This control judges each such instance on its own render
 * instead.
 *
 * The preview's own inventory, the instances the kit places, lists what to judge, so a plan that
 * drops an instance fails by name. Each override must render, beside a render of the same variant
 * with its default properties, and differ from it in box size or in at least one pixel of the
 * tolerant comparison. Each part a property turns on must be one laid-out element that holds the
 * part's text, if the part has text, and paints inside its own box, and the defaults twin must hold
 * no element for it. Each part a property turns off must be one laid-out element that holds its text
 * in the defaults twin, and the override must hold no element for it. A part the page finds by its
 * `place` passes there as well where the element at that place, a sibling that moved up, holds other
 * text than the part's. A part counts as a whole, so a part that keeps one of its children passes.
 */

import * as CssColor from "@elmeragroup/color/css-color";

import { propertiesOn } from "../components/optional-parts.ts";
import { DEVICE_SCALE } from "./browser-render.ts";
import type { CellRequest, MeasuredPart, RenderedCell, RenderedPreview } from "./browser-render.ts";
import { rootInCell, shownParts } from "./preview-page.ts";
import type { ShownPart } from "./preview-page.ts";
import { compose, crop, diffRasters } from "./raster.ts";
import type { Raster, Rgb } from "./raster.ts";
import type { CompareOptions, PlannedCell } from "./run-compare.ts";
import type { InstanceSnapshot } from "./snapshot.ts";

/** Where the preview's instance of an override's variant at its default properties stands. */
type DefaultsTwin =
  | { readonly _tag: "Unplaced" }
  | { readonly _tag: "Placed"; readonly planned: PlannedCell | undefined };

/**
 * One instance a preview places with a BOOLEAN property off its default: the line that names it, its
 * planned cell, its defaults twin, the parts its properties turn on and the parts they turn off. The
 * planned cell is undefined where the plan dropped the instance.
 */
type OverrideCheck = {
  readonly name: string;
  readonly planned: PlannedCell | undefined;
  readonly twin: DefaultsTwin;
  /** The parts the override shows and its defaults twin leaves out. */
  readonly turnedOn: readonly ShownPart[];
  /** The parts the defaults twin shows and the override leaves out. */
  readonly turnedOff: readonly ShownPart[];
};

/** A preview's BOOLEAN overrides, ready to render and judge. */
export type BooleanOverrides = {
  /**
   * The page requests: every planned cell, each override's and each defaults twin's with the parts
   * the page measures.
   */
  readonly requests: readonly CellRequest[];
  readonly checks: readonly OverrideCheck[];
};

/**
 * Prepare a preview's BOOLEAN overrides for the page.
 *
 * @param placed - Every instance the preview places, the kit's own inventory, independent of the plan.
 * @param planned - The plan's cells, each holding the placed instance it renders.
 * @param where - The preview's key, which each line names.
 * @returns The page requests and one check per placed override.
 * @throws When the page has no selector for a part a property turns on, as `shownParts` says.
 */
export function prepareBooleanOverrides(
  placed: readonly InstanceSnapshot[],
  planned: readonly PlannedCell[],
  where: string
): BooleanOverrides {
  // An instance's key names its preview, variant and overrides, so it says which placed instance a cell renders.
  const planOf = new Map(planned.map((cell) => [cell.instance.key, cell]));
  const checks = placed.flatMap((instance): OverrideCheck[] => {
    if (instance.booleans === undefined) {
      return [];
    }
    const twin = placed.find((other) => other.variant === instance.variant && other.booleans === undefined);
    const cell = planOf.get(instance.key);
    return [
      {
        name: `${where} ${instance.variant} ${JSON.stringify(instance.booleans)}`,
        planned: cell,
        twin: twin === undefined ? { _tag: "Unplaced" } : { _tag: "Placed", planned: planOf.get(twin.key) },
        turnedOn: cell === undefined ? [] : flippedParts(cell, instance.booleans, true),
        turnedOff: cell === undefined ? [] : flippedParts(cell, instance.booleans, false),
      },
    ];
  });
  const measured = new Map<string, Set<string>>();
  const measure = (cell: PlannedCell | undefined, parts: readonly ShownPart[]): void => {
    if (cell === undefined || parts.length === 0) {
      return;
    }
    const selectors = measured.get(cell.request.id) ?? new Set();
    for (const { selector } of parts) {
      selectors.add(selector);
    }
    measured.set(cell.request.id, selectors);
  };
  for (const { planned: cell, twin, turnedOn, turnedOff } of checks) {
    measure(cell, [...turnedOn, ...turnedOff]);
    measure(twin._tag === "Placed" ? twin.planned : undefined, [...turnedOn, ...turnedOff]);
  }
  const requests = planned.map(({ request }) => {
    const selectors = measured.get(request.id);
    return selectors === undefined ? request : { ...request, parts: [...selectors] };
  });
  return { requests, checks };
}

/**
 * The parts an instance's BOOLEAN properties set to `value` show where they are on: in the override
 * for `true`, in its defaults twin for `false`. Each selector comes from the render that shows the
 * part, which the other render must not match.
 */
function flippedParts(
  { definition, cell }: PlannedCell,
  booleans: Readonly<Record<string, boolean>>,
  value: boolean
): readonly ShownPart[] {
  const on = propertiesOn(definition, value ? booleans : undefined);
  return Object.entries(booleans).flatMap(([property, set]) =>
    set === value ? shownParts(rootInCell(definition, cell), cell, property, on) : []
  );
}

/**
 * Judge a preview's BOOLEAN overrides on the page's render.
 *
 * @param overrides - What {@link prepareBooleanOverrides} returned for the preview.
 * @param rendered - The page's render of its requests.
 * @param options - The layout, whose padding surrounds each crop's box, and the diff threshold.
 * @returns One line per failure, each naming the preview, the variant and its overrides.
 */
export function booleanOverrideFailures(
  overrides: BooleanOverrides,
  rendered: Pick<RenderedPreview, "background" | "cells">,
  options: Pick<CompareOptions, "layout" | "threshold">
): readonly string[] {
  const cellOf = (planned: PlannedCell | undefined): RenderedCell | undefined =>
    planned === undefined ? undefined : rendered.cells.get(planned.request.id);
  return overrides.checks.flatMap(({ name, planned, twin, turnedOn, turnedOff }) => {
    const cell = cellOf(planned);
    if (cell === undefined) {
      return [`${name}: the page renders no cell for it`];
    }
    const twinFailure = twinMismatch(cell, twin, cellOf, options);
    // A twin the page does not render already fails above, so its parts go unjudged.
    const atDefaults = twin._tag === "Placed" ? cellOf(twin.planned) : undefined;
    const lines = (where: string, part: ShownPart, failure: string | undefined): readonly string[] =>
      failure === undefined ? [] : [`${name} ${part.key}${where}: ${failure}`];
    const onFailures = turnedOn.flatMap((part) => [
      ...lines("", part, shownFailure(cell, part, rendered.background, options.threshold)),
      ...(atDefaults === undefined ? [] : lines(" at its defaults", part, absentFailure(atDefaults, part))),
    ]);
    const offFailures = turnedOff.flatMap((part) => [
      ...(atDefaults === undefined ? [] : lines(" at its defaults", part, laidFailure(atDefaults, part))),
      ...lines("", part, absentFailure(cell, part)),
    ]);
    return [...(twinFailure === undefined ? [] : [`${name}: ${twinFailure}`]), ...onFailures, ...offFailures];
  });
}

/**
 * Why an override fails against its defaults twin, or undefined when it differs from it. The build
 * places an override on a variant that draws the property's part, so the part must show or hide. The
 * same box size and no tolerant mismatch mean the property never reached the page, as when a
 * renderer ignores `turnedOn`. The count is the tolerant one, since two renders of one cell in
 * different slots differed in 11 to 128 bytes of its box, which it ignores.
 */
function twinMismatch(
  cell: RenderedCell,
  twin: DefaultsTwin,
  cellOf: (planned: PlannedCell | undefined) => RenderedCell | undefined,
  options: Pick<CompareOptions, "layout" | "threshold">
): string | undefined {
  if (twin._tag === "Unplaced") {
    return "the preview places no instance of the variant at its defaults to judge it by";
  }
  const atDefaults = cellOf(twin.planned);
  if (atDefaults === undefined) {
    return "the page renders no cell for the variant at its defaults";
  }
  const { padding } = options.layout;
  const same =
    atDefaults.box.width === cell.box.width &&
    atDefaults.box.height === cell.box.height &&
    diffRasters(boxPixels(cell, padding), boxPixels(atDefaults, padding), options.threshold).tolerant === 0;
  return same ? "renders the same box as the variant at its defaults" : undefined;
}

/**
 * A rendered cell's measured box, cut from its crop. The crop's padding is left out: two renders of
 * one cell in different slots of a page differed there.
 */
function boxPixels(cell: RenderedCell, padding: number): Raster {
  return crop(
    cell.raster,
    { x: padding * DEVICE_SCALE, y: padding * DEVICE_SCALE },
    {
      width: Math.floor(cell.box.width * DEVICE_SCALE),
      height: Math.floor(cell.box.height * DEVICE_SCALE),
    }
  );
}

/** The flat color an empty part shows, or why the self-check cannot tell one. */
type PaintReference =
  | { readonly _tag: "Flat"; readonly color: Rgb }
  | { readonly _tag: "Unknown"; readonly why: string };

/**
 * The color a part that paints nothing shows: the nearest painting ancestor's opaque
 * `background-color` inside the cell's slot, else the theme's background, which the page lays every
 * slot on.
 */
function paintReference(part: Extract<MeasuredPart, { _tag: "Laid" }>, background: Rgb): PaintReference {
  for (const { color, image } of part.backgrounds) {
    if (image !== "none") {
      return { _tag: "Unknown", why: `an ancestor paints the background image ${image}` };
    }
    const parsed = CssColor.parse(color);
    if (parsed._tag === "err") {
      return { _tag: "Unknown", why: `an ancestor's background color ${color} does not parse` };
    }
    const srgb = CssColor.toSrgb(parsed.value);
    if (srgb.alpha === 0) {
      continue;
    }
    if (srgb.alpha < 1) {
      return { _tag: "Unknown", why: `an ancestor's background color ${color} is translucent` };
    }
    const channel = (value: number): number => Math.min(255, Math.max(0, Math.round(value * 255)));
    return { _tag: "Flat", color: { r: channel(srgb.r), g: channel(srgb.g), b: channel(srgb.b) } };
  }
  return { _tag: "Flat", color: background };
}

/** A part a cell lays out as the check expects it, or why it does not. */
type LaidOutcome =
  | { readonly _tag: "Laid"; readonly part: Extract<MeasuredPart, { _tag: "Laid" }> }
  | { readonly _tag: "Fails"; readonly why: string };

/** Why the page measured no part for a selector in a cell. */
const unmeasured = (selector: string): string => `the page measured no ${selector}`;

/**
 * The part a cell lays out, or why it fails. Its selector must find one laid-out element, which holds
 * the part's text where the part has text, so a positional selector that lands on a neighbor fails by
 * name instead of judging the neighbor.
 */
function laidPart(cell: RenderedCell, { selector, text }: ShownPart): LaidOutcome {
  const part = cell.parts.find((measured) => measured.selector === selector);
  if (part === undefined) {
    return { _tag: "Fails", why: unmeasured(selector) };
  }
  if (part._tag === "Unlaid") {
    return {
      _tag: "Fails",
      why:
        part.matches === 1
          ? `the page does not lay out ${selector}`
          : `the page finds ${String(part.matches)} elements for ${selector}, where the part is one`,
    };
  }
  if (text !== undefined && part.text !== text) {
    return {
      _tag: "Fails",
      why: `${selector} holds ${JSON.stringify(part.text)}, where the part holds ${JSON.stringify(text)}`,
    };
  }
  return { _tag: "Laid", part };
}

/** Why a cell does not lay out a part as {@link laidPart} says, or undefined when it does. */
function laidFailure(cell: RenderedCell, part: ShownPart): string | undefined {
  const laid = laidPart(cell, part);
  return laid._tag === "Fails" ? laid.why : undefined;
}

/**
 * Why a cell that must leave a part out holds an element for it, or undefined when it holds none. A
 * part found by its position may have a sibling there instead, as Number field's steppers take the
 * denomination's place where it is off, so an element there that holds other text than the part's
 * passes. A part found by position with no text of its own cannot be told from that sibling and fails.
 */
function absentFailure(cell: RenderedCell, { selector, foundBy, text }: ShownPart): string | undefined {
  const part = cell.parts.find((measured) => measured.selector === selector);
  if (part === undefined) {
    return unmeasured(selector);
  }
  if (part._tag === "Laid") {
    if (foundBy === "position" && text !== undefined && part.text !== text) {
      return undefined;
    }
    return foundBy === "position" && text === undefined
      ? `the page lays out ${selector}, and a part found by its place with no text of its own cannot be told absent`
      : `the page lays out ${selector}, where the part is absent`;
  }
  return part.matches === 0
    ? undefined
    : `the page finds ${String(part.matches)} elements for ${selector}, where the part is absent`;
}

/**
 * Why a turned-on part fails in the override, or undefined when it passes. It must be laid out as
 * {@link laidPart} says and paint inside its own box. The box is rounded inward to whole device
 * pixels, so a neighbor's antialiased edge stays out, and a pixel past the threshold from the paint
 * reference counts. The count is the raw one, since the reference is flat and so carries no second
 * render's noise to tolerate.
 */
function shownFailure(
  cell: RenderedCell,
  expected: ShownPart,
  background: Rgb,
  threshold: number
): string | undefined {
  const laid = laidPart(cell, expected);
  if (laid._tag === "Fails") {
    return laid.why;
  }
  const { part } = laid;
  const { selector } = expected;
  const reference = paintReference(part, background);
  if (reference._tag === "Unknown") {
    return `the self-check cannot tell what an empty part shows: ${reference.why}`;
  }
  const { rect } = part;
  const left = Math.max(0, Math.ceil(rect.x * DEVICE_SCALE));
  const top = Math.max(0, Math.ceil(rect.y * DEVICE_SCALE));
  const right = Math.min(cell.raster.width, Math.floor((rect.x + rect.width) * DEVICE_SCALE));
  const bottom = Math.min(cell.raster.height, Math.floor((rect.y + rect.height) * DEVICE_SCALE));
  if (right <= left || bottom <= top) {
    return `${selector} covers no whole device pixel of the crop`;
  }
  const size = { width: right - left, height: bottom - top };
  const shown = compose(size, background, [
    { raster: crop(cell.raster, { x: left, y: top }, size), at: { x: 0, y: 0 } },
  ]);
  return diffRasters(shown, compose(size, reference.color, []), threshold).raw > 0
    ? undefined
    : `${selector} paints nothing inside its own box`;
}
