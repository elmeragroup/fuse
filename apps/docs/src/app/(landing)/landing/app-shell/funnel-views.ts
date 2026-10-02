import type { ComponentType } from "react";

import {
  Calculator,
  ChartLine,
  FileArrowUp,
  FileMagnifyingGlass,
  Files,
  Gauge,
  ListChecks,
  NotePencil,
  PaperPlaneTilt,
  Prohibit,
  ShoppingCart,
  Tray,
  Truck,
  Warning,
  XCircle,
} from "@elmeragroup/fuse/icons";
import type { ElmeraIconProps } from "@elmeragroup/fuse/icons";

import type { View } from "./funnel-state";

/**
 * A sidebar entry's label and icon; the labels are Funnel's (`messages/no.po`, English column).
 * Every icon is distinct from the others and from Search's magnifier, so the collapsed rail reads
 * without labels.
 */
export type ViewEntry = {
  readonly view: View;
  readonly label: string;
  readonly icon: ComponentType<ElmeraIconProps>;
};

/** The three entries above the groups. */
export const PRIMARY_VIEWS: readonly ViewEntry[] = [
  { view: "inbox", label: "Inbox", icon: Tray },
  { view: "mine", label: "My orders", icon: ListChecks },
  { view: "drafts", label: "Drafts", icon: NotePencil },
];

/** Funnel's sidebar groups (`sidebar-dashboard.tsx`), in its order. */
export const VIEW_GROUPS: readonly { readonly label: string; readonly entries: readonly ViewEntry[] }[] = [
  {
    label: "Orders",
    entries: [
      { view: "sent", label: "Sent", icon: PaperPlaneTilt },
      { view: "checkout", label: "Checkout", icon: ShoppingCart },
      { view: "statistics", label: "Seller statistics", icon: ChartLine },
      { view: "import", label: "Order import", icon: FileArrowUp },
      { view: "competitor-price", label: "Competitor price calculator", icon: Calculator },
    ],
  },
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
    entries: [
      { view: "order-search", label: "Order search", icon: FileMagnifyingGlass },
      { view: "batch-search", label: "Order batch search", icon: Files },
      { view: "move-out", label: "Move out", icon: Truck },
      { view: "meter-point-search", label: "Meter point search", icon: Gauge },
    ],
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
    throw new Error(`funnel: no sidebar entry for "${view}"`);
  }
  return entry;
}

/** Every sidebar entry, primary first. */
export const VIEW_ENTRIES: readonly ViewEntry[] = ALL_VIEWS;
