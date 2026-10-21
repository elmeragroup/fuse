// An editor's draft and the one write it settles into. Pure, so every exit path of every kind
// editor commits through the same rules: a draft is a position per value, an incomplete draft
// writes nothing, and a draft that already says what the applied filter says writes nothing.

import type { FilterField } from "./filter-fields";
import { firstOperator } from "./filter-fields";
import type { FilterKind, FilterOperator, FilterValue } from "./filter-model";
import { isFiniteNumber, isIsoDate, targetOf } from "./filter-model";

/** An operator and its values, one per position. */
export type DraftValues = {
  readonly operator: FilterOperator;
  readonly values: readonly (string | number)[];
};

/**
 * A text, number or date editor's operator and values until they commit, and whether a person
 * has edited the values. A seeded draft, such as a new range over the facet range, is not edited
 * until someone changes it, and an operator change keeps the flag.
 */
export type EditorDraft = DraftValues & { readonly edited: boolean };

/**
 * A facet range widened out to whole steps: the slider's bounds, and the draft a new range starts
 * from, which must agree so the draft sits inside the slider.
 *
 * @param range - The facet's lowest and highest values.
 * @param step - The field's step.
 * @returns The range's low end floored and its high end ceiled to a multiple of `step`.
 */
export function stepBounds(range: readonly [number, number], step: number): [number, number] {
  return [Math.floor(range[0] / step) * step, Math.ceil(range[1] / step) * step];
}

/**
 * The draft an editor starts from: the applied filter, else the field's first operator with no
 * values. A new number range over a known facet range starts at that range, so the slider shows
 * it. A one-value operator starts empty, whatever the range.
 *
 * @param field - The edited field.
 * @param filter - The applied filter, if any.
 * @param range - The field's known number range, if any.
 * @returns The draft.
 */
export function draftFor(
  field: FilterField,
  filter: FilterValue | undefined,
  range: readonly [number, number] | undefined
): EditorDraft {
  if (filter !== undefined) {
    return { operator: filter.operator, values: filter.values, edited: false };
  }
  const operator = firstOperator(field);
  if (field.kind === "number" && range !== undefined && targetOf("number", operator) === "range") {
    return { operator, values: stepBounds(range, field.step ?? 1), edited: false };
  }
  return { operator, values: field.kind === "text" ? [""] : [], edited: false };
}

/**
 * Whether a draft already says what a filter says: the same operator and the same values, with a
 * text draft trimmed as it applies. No filter matches a draft with nothing to apply.
 *
 * @param kind - The field's kind.
 * @param draft - The draft.
 * @param filter - The applied filter, if any.
 * @returns Whether the draft says it.
 */
export function draftSays(kind: FilterKind, draft: DraftValues, filter: FilterValue | undefined): boolean {
  const values = kind === "text" ? draft.values.map((value) => String(value).trim()) : draft.values;
  if (filter === undefined) {
    return values.every((value) => value === "" || (kind === "number" && !isFiniteNumber(value)));
  }
  return draft.operator === filter.operator && values.join("\u0000") === filter.values.join("\u0000");
}

/**
 * The values a draft holds in the positions its operator takes, when each is complete: a non-empty
 * trimmed text, a finite number, an ISO date. A position never moves, so a range's end typed
 * first stays the end.
 *
 * @param kind - The field's kind.
 * @param draft - The draft.
 * @returns The values, or undefined while a position is incomplete.
 */
export function completeValues(
  kind: FilterKind,
  draft: DraftValues
): readonly (string | number)[] | undefined {
  const count = targetOf(kind, draft.operator) === "range" ? 2 : 1;
  const used = Array.from({ length: count }, (_, index) => draft.values[index]);
  switch (kind) {
    case "text": {
      const text = String(used[0] ?? "").trim();
      return text === "" ? undefined : [text];
    }
    case "number": {
      const numbers = used.filter(isFiniteNumber);
      return numbers.length === count ? numbers : undefined;
    }
    case "date": {
      const dates = used.filter(isIsoDate);
      return dates.length === count ? dates : undefined;
    }
    case "option":
    case "multiOption":
      return undefined;
  }
}

/**
 * The one write a draft settles into against the applied filter, or undefined when it writes
 * nothing. A draft nobody edited writes nothing without an applied filter. An emptied text
 * removes the filter. An incomplete or reversed range writes nothing, so
 * the last valid filter stays. A new number range across the whole known range filters nothing,
 * so it makes no filter. A draft that already says what is applied writes nothing.
 *
 * @param kind - The field's kind. Option kinds commit on each toggle and never settle a draft.
 * @param draft - The draft.
 * @param applied - The applied filter, if any.
 * @param range - The field's known number range, if any.
 * @returns The write, an operator and its values or no values to remove the filter, or undefined.
 */
export function draftWrite(
  kind: FilterKind,
  draft: EditorDraft,
  applied: FilterValue | undefined,
  range: readonly [number, number] | undefined
): DraftValues | undefined {
  if (kind === "option" || kind === "multiOption" || (applied === undefined && !draft.edited)) {
    return undefined;
  }
  if (kind === "text" && String(draft.values[0] ?? "").trim() === "") {
    return applied === undefined ? undefined : { operator: draft.operator, values: [] };
  }
  const values = completeValues(kind, draft);
  if (values === undefined) {
    return undefined;
  }
  const [low, high] = values;
  if (low !== undefined && high !== undefined && low > high) {
    return undefined;
  }
  if (
    kind === "number" &&
    applied === undefined &&
    draft.operator === "isBetween" &&
    range !== undefined &&
    isFiniteNumber(low) &&
    isFiniteNumber(high) &&
    low <= range[0] &&
    high >= range[1]
  ) {
    return undefined;
  }
  const write = { operator: draft.operator, values };
  return draftSays(kind, write, applied) ? undefined : write;
}
