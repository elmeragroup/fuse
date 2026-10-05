import type { ComponentType } from "react";

import {
  FileMagnifyingGlass,
  ListChecks,
  NotePencil,
  PaperPlaneTilt,
  Prohibit,
  Tray,
  Warning,
  XCircle,
} from "@elmeragroup/fuse/icons";
import type { ElmeraIconProps } from "@elmeragroup/fuse/icons";

import type { View } from "./dashboard-state";

/**
 * A sidebar entry's label and icon; the labels are the sales tool's (`messages/no.po`, English column).
 * Every icon is distinct from the others and from Search's magnifier, so the collapsed rail reads
 * without labels.
 */
export type ViewEntry = {
  readonly view: View;
  readonly label: string;
  readonly icon: ComponentType<ElmeraIconProps>;
};

/**
 * The queues above the groups. The sales tool files Drafts and Sent under My orders; the demo
 * lifts Sent beside Drafts, since it builds none of the Orders group's other pages.
 */
export const PRIMARY_VIEWS: readonly ViewEntry[] = [
  { view: "inbox", label: "Inbox", icon: Tray },
  { view: "mine", label: "My orders", icon: ListChecks },
  { view: "drafts", label: "Drafts", icon: NotePencil },
  { view: "sent", label: "Sent", icon: PaperPlaneTilt },
];

/**
 * The sales tool's sidebar groups (`sidebar-dashboard.tsx`) the demo builds, in its order. Collect
 * keeps its one entry: Order search is a table rather than a queue, and the group names that.
 */
export const VIEW_GROUPS: readonly { readonly label: string; readonly entries: readonly ViewEntry[] }[] = [
  {
    label: "Deviations",
    entries: [
      { view: "establishment-stopped", label: "Establishment stopped", icon: Prohibit },
      { view: "errors", label: "Errors", icon: XCircle },
      { view: "deviations", label: "Deviations", icon: Warning },
    ],
  },
  {
    label: "Collect",
    entries: [{ view: "order-search", label: "Order search", icon: FileMagnifyingGlass }],
  },
];

const ALL_VIEWS: readonly ViewEntry[] = [...PRIMARY_VIEWS, ...VIEW_GROUPS.flatMap((group) => group.entries)];

/**
 * @param view - A sidebar entry.
 * @returns Its label and icon.
 * @throws When a view has no sidebar entry, which the types rule out.
 */
export function viewEntry(view: View): ViewEntry {
  const entry = ALL_VIEWS.find((candidate) => candidate.view === view);
  if (entry === undefined) {
    throw new Error(`dashboard: no sidebar entry for "${view}"`);
  }
  return entry;
}

/** Every sidebar entry, primary first. */
export const VIEW_ENTRIES: readonly ViewEntry[] = ALL_VIEWS;
