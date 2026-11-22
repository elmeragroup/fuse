/**
 * What becomes of a box's `min-*` and `max-*` on one axis: a zero minimum drops, a limit beside a
 * length that hugs or fills becomes a Figma limit, and a limit beside a fixed length folds into the
 * length or drops. It also gives the length CSS uses within the limits, in pixels. `box-sizing.ts`
 * decides each axis's limits here, and `layer-bounds.ts` keeps a height within its limits.
 */

import type { AxisProperties } from "./box-axis";
import { describeNumber } from "./css-values";
import type { VariableIndex } from "./css-values";
import type { NumberSpec, SizeSpec } from "./kit-spec";
import type { CoverageNote } from "./layer-style";
import { limitsNeverMoveVariable } from "./variable-limits";

/**
 * An axis's used length in pixels, as CSS lays the box out: a literal fixed length, which holds its
 * limits already, or the room a fill takes, lowered to its maximum and raised to its minimum (CSS 2.1
 * §10.4), as Figma keeps a fill within its limits. Undefined where the axis hugs, the fill's room is
 * unknown, or a limit is no literal or stays unmapped, since CSS applies a limit whatever the build
 * makes of it.
 *
 * @param read - The axis as `readAxis` in `box-sizing.ts` read it.
 * @param room - The length in pixels a fill takes before its limits, or undefined where unknown.
 */
export function usedPixels(read: AxisRead, room: number | undefined): number | undefined {
  if ([...read.notes.values()].includes(undefined)) {
    return undefined;
  }
  switch (read.size.kind) {
    case "fixed":
      return read.size.length.kind === "literal" ? read.size.length.value : undefined;
    case "hug":
      return undefined;
    case "fill": {
      const bounds = [...read.notes.keys()];
      const min = comparable(bounds, "min");
      const max = comparable(bounds, "max");
      return room === undefined || min.kind === "incomparable" || max.kind === "incomparable"
        ? undefined
        : usedLength(room, pixelsOf(min), pixelsOf(max));
    }
  }
}

/** A `min-*` or `max-*` the box sets, and its value as a number field where it reads as one. */
export type Bound = {
  readonly side: "min" | "max";
  readonly property: string;
  readonly value: NumberSpec | undefined;
};

/**
 * One axis as the box reads it: its sizing, the limits Figma keeps it within, and what became of
 * each `min-*` and `max-*` the box sets, where undefined leaves it unmapped.
 */
export type AxisRead = {
  readonly size: SizeSpec;
  readonly min: NumberSpec | undefined;
  readonly max: NumberSpec | undefined;
  readonly notes: ReadonlyMap<Bound, CoverageNote | undefined>;
};

/** Why a zero minimum drops: `min-w-0` lets a flex item shrink below its content. */
const ZERO_MINIMUM = "Figma takes no zero minimum, and its auto layout never shrinks a layer";

/**
 * Decide an axis's limits. A zero minimum drops. Beside a length that hugs or fills, each other
 * limit becomes a Figma limit, except a maximum of zero or less, which Figma refuses, as the plugin
 * typings require a positive limit. Beside a fixed length, CSS resolves the length against its
 * limits (CSS 2.1 §10.4 and §10.7): lowered to the maximum, then raised to the minimum, so the
 * minimum wins a conflict. Figma would clamp a fixed length to a limit on every resize, so the
 * limits fold into the length: one that moves it sets it, and one that never moves it drops. A
 * length bound to a variable that every limit binds too never moves in any mode, as the md control
 * size's `min-h-(--control-h-md)` beside its `h-(--control-h-md)`, so those limits drop, and so do
 * literal limits its range never reaches, as `variable-limits.ts` decides. A fold to a
 * length of zero or less, and a limit that any other bound or non-literal value on either side keeps
 * from comparing, stay unmapped.
 */
export function resolveLimits(
  size: SizeSpec,
  bounds: readonly Bound[],
  axis: AxisProperties,
  variables: VariableIndex
): AxisRead {
  const isZeroMinimum = (bound: Bound): boolean =>
    bound.side === "min" && bound.value?.kind === "literal" && bound.value.value === 0;
  const kept = bounds.filter((bound) => !isZeroMinimum(bound));
  const zeroNotes = bounds
    .filter(isZeroMinimum)
    .map((bound): [Bound, CoverageNote] => [bound, { outcome: "dropped", detail: ZERO_MINIMUM }]);
  if (size.kind !== "fixed") {
    const positive = (bound: Bound): NumberSpec | undefined =>
      bound.side === "max" && bound.value?.kind === "literal" && bound.value.value <= 0
        ? undefined
        : bound.value;
    const limit = (side: Bound["side"]) => {
      const bound = kept.find((candidate) => candidate.side === side);
      return bound === undefined ? undefined : positive(bound);
    };
    return {
      size,
      min: limit("min"),
      max: limit("max"),
      notes: new Map([
        ...zeroNotes,
        ...kept.map((bound): [Bound, CoverageNote | undefined] => {
          const value = positive(bound);
          return [bound, value === undefined ? undefined : describeNumber(value)];
        }),
      ]),
    };
  }
  const { length } = size;
  const inertBesideVariable = limitsNeverMoveVariable(length, kept, variables);
  if (kept.length > 0 && (inertBesideVariable || kept.every((bound) => sameVariable(bound.value, length)))) {
    return {
      size,
      min: undefined,
      max: undefined,
      notes: new Map([
        ...zeroNotes,
        ...kept.map((bound): [Bound, CoverageNote] => [bound, neverMoves(bound, axis)]),
      ]),
    };
  }
  const min = comparable(kept, "min");
  const max = comparable(kept, "max");
  const unmapped: AxisRead = {
    size,
    min: undefined,
    max: undefined,
    notes: new Map([...zeroNotes, ...kept.map((bound): [Bound, undefined] => [bound, undefined])]),
  };
  // Whether a limit moves the length depends on the length and on the other limit, so every one of
  // them must be a literal before any limit folds or drops.
  if (length.kind !== "literal" || min.kind === "incomparable" || max.kind === "incomparable") {
    return unmapped;
  }
  const used = usedLength(length.value, pixelsOf(min), pixelsOf(max));
  if (used <= 0) {
    return unmapped;
  }
  const foldNote = (bound: Bound): CoverageNote => {
    const without = usedLength(
      length.value,
      bound.side === "min" ? undefined : pixelsOf(min),
      bound.side === "max" ? undefined : pixelsOf(max)
    );
    return without === used
      ? neverMoves(bound, axis)
      : { outcome: "literal", detail: `the fixed ${axis.length} resolves to ${used}px against it` };
  };
  return {
    size: { kind: "fixed", length: { kind: "literal", value: used } },
    min: undefined,
    max: undefined,
    notes: new Map([...zeroNotes, ...kept.map((bound): [Bound, CoverageNote] => [bound, foldNote(bound)])]),
  };
}

/** Why a limit that never moves a fixed length drops. */
function neverMoves(bound: Bound, axis: AxisProperties): CoverageNote {
  const [than, never] = bound.side === "min" ? ["more", axis.grows] : ["less", axis.shrinks];
  return {
    outcome: "dropped",
    detail: `it is no ${than} than the fixed ${axis.length}, so it never ${never} the box`,
  };
}

/** Whether a limit binds the variable a length binds, so it holds the length's value in every mode. */
export function sameVariable(limit: NumberSpec | undefined, length: NumberSpec): boolean {
  return (
    limit?.kind === "variable" &&
    length.kind === "variable" &&
    limit.variable.collection === length.variable.collection &&
    limit.variable.name === length.variable.name
  );
}

/** A limit as the fold compares it: unset, a literal length in pixels, or a value it cannot compare. */
type Comparable =
  | { readonly kind: "absent" }
  | { readonly kind: "literal"; readonly px: number }
  | { readonly kind: "incomparable" };

function comparable(bounds: readonly Bound[], side: Bound["side"]): Comparable {
  const bound = bounds.find((candidate) => candidate.side === side);
  if (bound === undefined) {
    return { kind: "absent" };
  }
  return bound.value?.kind === "literal"
    ? { kind: "literal", px: bound.value.value }
    : { kind: "incomparable" };
}

/** A comparable limit's pixels, or undefined where it is unset. */
function pixelsOf(limit: Comparable): number | undefined {
  return limit.kind === "literal" ? limit.px : undefined;
}

/** The used length CSS gives a length within its limits (CSS 2.1 §10.4). */
export function usedLength(length: number, min: number | undefined, max: number | undefined): number {
  const capped = max === undefined ? length : Math.min(length, max);
  return min === undefined ? capped : Math.max(capped, min);
}
