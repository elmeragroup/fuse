"use client";

import type { ReactElement } from "react";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { timelineListStrings } from "./intl";

/** The statuses the dictionary names. `current` has no default text: `aria-current` announces it. */
export type TimelineListLabeledStatus = "complete" | "upcoming" | "error";

/**
 * The dictionary's text for an Item's status, visually hidden and followed by a space so it does
 * not run into the Item's inline children. It is package-private. Only the client knows the locale,
 * through LocaleProvider, so this child is the only client module in TimelineList, and the Item
 * stays a server component.
 */
export function TimelineListStatusLabel({
  status,
}: {
  readonly status: TimelineListLabeledStatus;
}): ReactElement {
  const strings = useLocalizedStrings(timelineListStrings);
  return <span className="sr-only">{`${strings.format(status)} `}</span>;
}
