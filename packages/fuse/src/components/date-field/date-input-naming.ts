"use client";

// This module names and describes a date input. The group takes its name from the consumer's
// `aria-labelledby` or `aria-label`, or else from its Field's label. Every segment repeats that name
// after its own unit, as in "month, Start date". The group's description starts with the committed
// value spelled out in words, in a hidden element the Root renders. The consumer's
// `aria-describedby` follows, then the Field's description and error. The first editable segment
// carries the same description, and so does every segment while the input is invalid.

import { useCallback } from "react";

import { displayNames } from "../../internal/intl-cache";
import type { TemporalValue } from "../../temporal/temporal-value";
import type { EditableSegmentType } from "./date-draft";
import { describeValue } from "./date-field-format";
import type { FieldFormat } from "./date-field-format";
import type { DateFieldStrings } from "./date-input-validation";

/** The input values that naming reads. */
export type DateInputNamingOptions = {
  readonly strings: DateFieldStrings;
  /** The input's format. Its locale names the segments, and its scope picks the description. */
  readonly format: FieldFormat;
  /** The committed value, which the description spells out; `null` leaves it out. */
  readonly committed: TemporalValue | null;
  /** The zone's name that the segments write; see `useFieldZoneName`. */
  readonly zoneName: string;
  /** The Root's own id, which the description's id derives from. */
  readonly id: string;
  /** The consumer's `aria-labelledby`, ahead of the Field's label. */
  readonly ariaLabelledBy: string | undefined;
  /** The consumer's `aria-describedby`. */
  readonly ariaDescribedBy: string | undefined;
  /** The Field's label id. */
  readonly fieldLabelId: string | undefined;
  /** The Field's description and error ids. */
  readonly fieldDescribedBy: string | undefined;
};

/** The input's group-level names and descriptions. */
export type DateInputNames = {
  /** The committed value in words, for the hidden description; `undefined` while empty. */
  readonly description: string | undefined;
  /** The hidden description's id. */
  readonly descriptionId: string;
  /**
   * The group's `aria-describedby`. The segments also take it, where `date-input-segment.tsx` places
   * it.
   */
  readonly describedBy: string | undefined;
  /** The group's and every segment's `aria-labelledby`. */
  readonly labelledBy: string | undefined;
};

/** The input's names and descriptions, and its segments' spoken units. */
export type DateInputNaming = DateInputNames & {
  /** Returns a segment's spoken unit, such as "month". */
  readonly segmentName: (type: EditableSegmentType | "timeZoneName") => string;
};

/**
 * The input's names and descriptions. The value's description comes first, then the consumer's
 * describers, then the Field's, in the order a screen reader speaks them. The consumer's
 * `aria-labelledby` comes ahead of the Field's label.
 *
 * @param options - What naming reads.
 * @returns The names and descriptions.
 */
export function nameDateInput(options: DateInputNamingOptions): DateInputNames {
  const { strings, format, committed, zoneName, id } = options;
  const description =
    committed === null
      ? undefined
      : format.scope === "time"
        ? strings.format("selectedTimeDescription", { time: describeValue(format, committed, zoneName) })
        : strings.format("selectedDateDescription", { date: describeValue(format, committed, zoneName) });
  const descriptionId = `${id}-description`;
  const describedBy =
    [description === undefined ? undefined : descriptionId, options.ariaDescribedBy, options.fieldDescribedBy]
      .filter((describer) => describer !== undefined && describer !== "")
      .join(" ") || undefined;
  const labelledBy = options.ariaLabelledBy ?? options.fieldLabelId;
  return { description, descriptionId, describedBy, labelledBy };
}

/**
 * A segment's localized unit name from `Intl.DisplayNames`, including locales without a Fuse
 * dictionary. It falls back to the dictionary's word where the engine has none or rejects the
 * locale for display names.
 *
 * @param locale - The input's locale.
 * @param strings - The input's dictionary.
 * @param type - The segment's unit.
 * @returns The unit's name, such as "month".
 */
export function segmentName(
  locale: string,
  strings: DateFieldStrings,
  type: EditableSegmentType | "timeZoneName"
): string {
  try {
    return displayNames(locale, { type: "dateTimeField" }).of(type) ?? strings.format(type);
  } catch {
    return strings.format(type);
  }
}

/**
 * The input's names and descriptions this render, with a segment namer stable across renders of
 * one locale and dictionary.
 *
 * @param options - What naming reads.
 * @returns The names and descriptions.
 */
export function useDateInputNaming(options: DateInputNamingOptions): DateInputNaming {
  const { strings } = options;
  const { locale } = options.format;
  const name = useCallback(
    (type: EditableSegmentType | "timeZoneName"): string => segmentName(locale, strings, type),
    [locale, strings]
  );
  return { ...nameDateInput(options), segmentName: name };
}
