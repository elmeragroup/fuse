"use client";

import { useState } from "react";
import type { ReactElement } from "react";

import type { SupportedLocale } from "../../intl/locale-context";
import type { ValueFormat } from "./chart-types";
import { labelWidth } from "./layout/label-width";

/** The widest label a sizer has held, and the locale and format it printed in. */
type Held = { readonly text: string | null; readonly locale: SupportedLocale; readonly format: ValueFormat };

/** The widest of some labels by their width estimate, the first on a tie, or null for none. */
function widestOf(texts: readonly string[]): string | null {
  let widest: string | null = null;
  for (const text of texts) if (widest === null || labelWidth(text) > labelWidth(widest)) widest = text;
  return widest;
}

/**
 * The widest label shown so far under one locale and format, by its width estimate: the widest of
 * the labels shown now, or a wider one shown before. Another locale or format starts over, since
 * its labels print differently.
 */
function useWidest(texts: readonly string[], locale: SupportedLocale, format: ValueFormat): string | null {
  const now = widestOf(texts);
  const [held, setHeld] = useState<Held>({ text: now, locale, format });
  const same = held.locale === locale && held.format === format;
  const keeps = same && held.text !== null && (now === null || labelWidth(held.text) >= labelWidth(now));
  const text = keeps ? held.text : now;
  if (!same || text !== held.text) setHeld({ text, locale, format });
  return text;
}

/**
 * A hidden sizer that gives a column beside the plot the width of the labels it prints: the ones
 * it shows now and the widest it has shown under the same locale and format, so a value that prints
 * narrower than the last one leaves the column, and the plot beside it, where they were.
 *
 * @param props - The labels shown now, what they print in, and `"pill"` to size them as the
 *   badge's pill.
 * @returns The sizer.
 */
export function WidestSizer({
  texts,
  locale,
  format,
  part,
}: {
  readonly texts: readonly string[];
  readonly locale: SupportedLocale;
  readonly format: ValueFormat;
  readonly part?: "pill";
}): ReactElement {
  const widest = useWidest(texts, locale, format);
  // Two labels that print alike take the same width, so each prints once.
  const shown = new Set(widest === null ? texts : [...texts, widest]);
  return (
    <span data-slot="chart-axis-sizer">
      {[...shown].map((text) => (
        <span key={text} data-part={part}>
          {text}
        </span>
      ))}
    </span>
  );
}
