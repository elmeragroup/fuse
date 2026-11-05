"use client";

/**
 * The readout port: what every Root that has a readout provides to the parts every family shares,
 * the Tooltip's and the Legend's parts, Empty, Swatch, SeriesLabel, SeriesIcon and `useChartPoint`.
 * A shared part reads its Root through this port alone, so a family ships its own model and pick
 * and never another family's. Each Root memoises its port on its own context, which changes with
 * data, config and the effective window and never with the pointer, so a pointer move commits no
 * shared part that reads only the port.
 *
 * Two capabilities ride with a family's own part instead, so a route that renders neither ships
 * neither: the Tooltip part hands the shared tooltip body its `TooltipPlacer`, and the Table part
 * hands the shared table body its `ChartTableModel`.
 *
 * An index names what the readout steps through: a slot on a cartesian Root, an item such as a
 * slice or a ring on a pie or radial Root. A key names a config key, a series or a category.
 */
import { createContext } from "react";
import type { ReactNode, RefObject } from "react";

import type { SupportedLocale } from "../../intl/locale-context";
import type { ChartFollowers } from "./chart-followers";
import type { ChartStore } from "./chart-store";
import type { GlideRoute } from "./chart-tooltip-glide";
import type {
  ChartFallback,
  ChartPoint,
  ChartScalar,
  ChartSelectionChangeReason,
  ChartThresholdSide,
  ValueFormat,
  XFormat,
} from "./chart-types";
import type { FormattedText } from "./format/formatted-text";
import type { ChartDataRule, ChartHintRule } from "./layout/errors";
import type { SlotWindow } from "./layout/slot-window";

/** One legend entry or tooltip row's subject: a series on a cartesian Root, a category on a polar one. */
export type ReadoutItem = {
  /** Its position among the Root's items, which `data-series` carries. */
  readonly index: number;
  /** Its name in both forms. */
  readonly label: FormattedText;
  /** Its config `icon`, or undefined. */
  readonly icon: ReactNode;
  /** Whether the default LegendToggleGroup lists a toggle for it. */
  readonly selectable: boolean;
  /**
   * The two sides of a threshold colour, above first as the value axis reads, each with its own
   * legend entry, or null for every other colour, which has one entry with no side.
   */
  readonly sides: readonly [ChartThresholdSide, ChartThresholdSide] | null;
};

/** The index under a pointer and the series nearest to it, or null when none draws there. */
export type PointerSlot = { readonly slot: number; readonly near: number | null };

/** One measure of a tooltip anchor, in client pixels. */
export type AnchorMeasure = {
  /** The box the popup touches. */
  readonly box: DOMRect;
  /** How far the popup moves along its side from the box's centre to stay inside the Root's box. */
  readonly shift: number;
  /** How a step's glide travels to this place. */
  readonly route: GlideRoute;
};

/**
 * The virtual anchor Base UI positions the popup against. It measures at position time and names
 * the plot surface as its context element, so Base UI follows the scroll containers around it.
 */
export type TooltipVirtualAnchor = {
  readonly getBoundingClientRect: () => DOMRect;
  readonly contextElement: Element | undefined;
  /** The anchor's last measure, or a fresh one before Base UI asked for any. */
  readonly placed: () => AnchorMeasure;
};

/** What the tooltip hands its Root's anchor on every render. */
export type AnchorInput = {
  /** The active index inside the effective window, or null while the tooltip is closed. */
  readonly active: number | null;
  /** The tooltip's positioner, whose size the anchor reads and on which it writes. */
  readonly positioner: RefObject<HTMLDivElement | null>;
  /** The Tooltip's `anchor` prop. */
  readonly placement: "point" | "top";
  /** A count the tooltip raises to ask Base UI to place the popup again over a fresh measure. */
  readonly measures: number;
};

/** A point in client pixels. */
export type ClientPoint = { readonly x: number; readonly y: number };

/** How a family places its tooltip: the anchor, its side, and what the anchor remembers. */
export type TooltipAnchor = {
  /** Base UI's anchor, or null while nothing is active or the plot is unmeasured. */
  readonly virtual: TooltipVirtualAnchor | null;
  /** The side the popup prefers. */
  readonly side: "top" | "bottom" | "left" | "right";
  /** Whether the popup carries the bridge a pointer crosses from the plot to a popup resting above it. */
  readonly bridge: boolean;
  /**
   * What the anchor measures against: a new value, as after a data update or a resize, moves the
   * popup at once instead of gliding it there.
   */
  readonly revision: object;
  /**
   * Forget what the anchor read. "moved" forgets what it read of the marks, as the popup opens or
   * the revision changes, and "closed" also forgets where the popup rested.
   */
  readonly forget: (reason: "moved" | "closed") => void;
  /**
   * Watch the marks while the popup shows, and call `again` when they draw something the anchor
   * should measure afresh. It returns the watch's teardown, and a new function stands for a new
   * revision, so the tooltip watches again after one.
   */
  readonly watch: (again: () => void) => (() => void) | undefined;
  /**
   * Whether a pointer that entered the popup at `to`, from `from` on the plot, moved straight toward
   * it from the active datum, which holds the active index while it crosses the popup.
   */
  readonly freezes: (from: ClientPoint, to: ClientPoint, side: string | null) => boolean;
  /**
   * How far the popup sits from its anchor on the side Base UI tries, in CSS pixels, negative to
   * reach over it.
   */
  readonly sideOffset: (side: string, size: { readonly width: number; readonly height: number }) => number;
  /** How far the popup moves along that side, in the positioner's own pixels. */
  readonly alignOffset: (side: string, positioner: HTMLElement) => number;
};

/** One table page: its key, the indexes it lists, and its period as the pagination shows and speaks it. */
export type ChartTablePage = {
  readonly key: number;
  readonly slots: readonly number[];
  readonly label: string;
  readonly spoken: string;
};

/**
 * One body cell under its column's key. A "value" cell shows its text with each word in parentheses
 * after it, a "silent" one speaks its words to screen readers alone, as a pending reading does, and
 * a "covered" one renders nothing under a span from a row above. A cell spans `rows` rows.
 */
export type ChartTableCell =
  | {
      readonly kind: "value";
      readonly key: string;
      readonly text: FormattedText;
      readonly words: readonly string[];
      readonly rows: number;
    }
  | { readonly kind: "silent"; readonly key: string; readonly spoken: string; readonly rows: number }
  | { readonly kind: "covered"; readonly key: string };

/** One body row: its React key, the index it lists, its head cell and its cells. */
export type ChartTableRow = {
  readonly key: string | number;
  readonly slot: number;
  readonly head: FormattedText;
  readonly cells: readonly ChartTableCell[];
};

/** The rows a family's Table part hands the shared table, built a page at a time. */
export type ChartTableModel = {
  /** The pages, built on first read. */
  readonly pages: () => readonly ChartTablePage[];
  /** The generated caption, the chart name and the period the rows span. */
  readonly caption: () => string;
  /** The first column's header. */
  readonly xHeader: () => string;
  /** The column headers after the first. */
  readonly heads: () => readonly FormattedText[];
  /** The rows of one page. */
  readonly rows: (page: ChartTablePage) => readonly ChartTableRow[];
  /** A TableColumn's cell: the Root's own row column at an index. */
  readonly cell: (slot: number, column: string) => ChartScalar;
  /** Whether any of the Root's rows holds a column. */
  readonly hasColumn: (column: string) => boolean;
  /** The zone a TableColumn's `Date` cells print in. */
  readonly timeZone: string;
};

/** What a Root's readout gives the shared parts. */
export type ChartReadout = {
  /** The id prefix every generated id of the Root starts with. */
  readonly id: string;
  /** Root's `aria-label`, or undefined when `aria-labelledby` names the chart. */
  readonly name: string | undefined;
  readonly locale: SupportedLocale;
  /** The Root's figure once it has mounted. */
  readonly root: () => HTMLElement | null;
  readonly store: ChartStore;
  readonly followers: ChartFollowers;
  /** The indexes the readout steps through, or null when there are none. */
  readonly window: SlotWindow | null;
  /** Whether no datum draws, which Empty shows. */
  readonly empty: boolean;
  /** The legend's keys in legend order. */
  readonly legendKeys: readonly string[];
  /**
   * The LegendToggleGroup's default name: the series word, or the category word where the toggles
   * list a pie's or a radial chart's categories (S9).
   */
  readonly toggleGroupName: string;
  /** A key's item, or undefined for a key the Root lacks. */
  readonly item: (key: string) => ReadoutItem | undefined;
  /**
   * Check a key a part names explicitly.
   *
   * @throws {ChartCompositionError} `unknown-key` for a key the config lacks.
   */
  readonly assertKey: (part: string, key: string) => void;
  /**
   * The key a readout part without its own prints at the active point: the nearest or focused
   * series, or the active item, and null under "all series" or with nothing active.
   */
  readonly pointKey: (active: number | null, near: number | null) => string | null;
  /** Whether TooltipItems renders a row per active item, so it follows the active index. */
  readonly itemsFollowActive: boolean;
  /** The keys TooltipItems renders a row for. */
  readonly tooltipKeys: (active: number | null) => readonly string[];
  /** The active index's label. */
  readonly activeLabel: (active: number, format: XFormat | undefined) => string;
  /** A key's reading at an index, as a tooltip row or a legend value prints it. */
  readonly valueText: (key: string, at: number, format: ValueFormat | undefined) => string;
  /** A key's share in percent at an index, or null for a zero denominator. */
  readonly share: (key: string, at: number, digits: number) => number | null;
  /** The index a LegendValue prints: the active one, else the one its fallback keyword selects. */
  readonly legendAt: (key: string, active: number | null, fallback: ChartFallback) => number | null;
  /** A key's legend share in percent, or null for a zero denominator. */
  readonly legendShare: (key: string, digits: number) => number | null;
  /** A key's swatch paint at an index, or over everything at null, and the look its marks draw in. */
  readonly swatch: (
    key: string,
    at: number | null
  ) => { readonly paint: string; readonly look: string | undefined };
  /** The active point `useChartPoint` reports. */
  readonly point: (active: number, near: number | null) => ChartPoint;
  /** Select a key, or clear the selection with null, and announce it. */
  readonly select: (key: string | null, reason: ChartSelectionChangeReason, event: Event | undefined) => void;
  /** A LegendToggleGroup registers while it is mounted, and the returned function unregisters it. */
  readonly registerToggleGroup: () => () => void;
  /** Highlight a key through Root's attributes with no React render, or clear it with null. */
  readonly highlight: (key: string | null) => void;
  /** Warn once per Root for each rule and subject. */
  readonly warnOnce: (rule: ChartDataRule | ChartHintRule, subject: string, message: string) => void;
  /**
   * The pick a pointer over the plot or the tooltip makes. It is a hook with the same calls for the
   * Root's whole life.
   */
  readonly usePick: () => (clientX: number, clientY: number) => PointerSlot | null;
};

/**
 * A family's tooltip placement, which its Tooltip part hands the shared tooltip body. It rides with
 * the Tooltip part instead of the Root's readout, so a route that renders no Tooltip ships no
 * anchor.
 */
export type TooltipPlacer = {
  /** The tooltip's anchor. It is a hook with the same calls for the Tooltip's whole life. */
  readonly useAnchor: (input: AnchorInput) => TooltipAnchor;
};

/** The enclosing Root's readout, or null outside every Root that has one. */
export const ChartReadoutContext = createContext<ChartReadout | null>(null);

/**
 * Root's selected config key, or null. It lives apart from the readout, so a selection renders the
 * legend, the tooltip and the surface that show it, and no mark.
 */
export const ChartSelectionContext = createContext<string | null>(null);
