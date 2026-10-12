"use client";

import { createContext, use, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, ReactElement, ReactNode, RefObject } from "react";

// The package-root import, as in command.tsx: the combobox family's subpaths crash at runtime.
import { Autocomplete as AutocompletePrimitive } from "@base-ui/react";
import type { AutocompleteRootHighlightEventDetails } from "@base-ui/react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import type { Virtualizer } from "@tanstack/react-virtual";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { commandVirtualListShellClass } from "../../styles/inner-corner/command";
import { mergeClassName } from "../../styles/merge-class-name";
import { cssLengthToPx } from "../../theme/css-values";
import { CommandRoot } from "../command/command";
import type { CommandRootProps } from "../command/command";
import { CommandRowContext } from "../command/command-row-context";
import { commandVariants } from "../command/command-variants";
import { DENSE_ROW_METRICS } from "./row-metrics";
import type { RowMetrics } from "./row-metrics";
import { highlightScrollAlign, withHighlightedRow } from "./virtual-highlight";

const styles = commandVariants();

type ListVirtualizer = Virtualizer<HTMLDivElement, Element>;

type CommandVirtualContextValue = {
  /** The highlighted row's index, which the list keeps mounted. */
  readonly highlightedIndex: number | undefined;
  /** The list's virtualizer, which the Root scrolls when the highlight jumps. */
  readonly virtualizer: RefObject<ListVirtualizer | null>;
};

const CommandVirtualContext = createContext<CommandVirtualContextValue | null>(null);

/**
 * Props of `CommandVirtual.Root`: `Command.Root`'s, typed as Base UI's flat overload, which it
 * renders virtualized. `CommandVirtual.List` renders a flat list of items and throws on groups.
 *
 * @template ItemValue - The type of one item.
 */
export type CommandVirtualRootProps<ItemValue> = Omit<CommandRootProps<ItemValue>, "virtualized">;

/**
 * `Command.Root` for a long flat list: Base UI's virtualized Autocomplete. It tracks the
 * highlighted row and scrolls the list when the highlight jumps out of view, such as when
 * ArrowUp wraps from the first row to the last. Pass every item in `items`; render them in
 * `CommandVirtual.List`. An `onItemHighlighted` of yours runs first.
 */
export function CommandVirtualRoot<ItemValue>({
  onItemHighlighted,
  ...props
}: CommandVirtualRootProps<ItemValue>): ReactElement {
  const virtualizer = useRef<ListVirtualizer | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | undefined>(undefined);
  const context = useMemo(() => ({ highlightedIndex, virtualizer }), [highlightedIndex]);
  return (
    <CommandVirtualContext.Provider value={context}>
      <CommandRoot
        virtualized
        onItemHighlighted={(item: ItemValue | undefined, details: AutocompleteRootHighlightEventDetails) => {
          onItemHighlighted?.(item, details);
          setHighlightedIndex(item === undefined ? undefined : details.index);
          const list = virtualizer.current;
          if (item === undefined || list === null) {
            return;
          }
          const align = highlightScrollAlign(details.reason, details.index, list.options.count);
          if (align !== undefined) {
            // After Base UI commits the highlight, so the scroll lands on the row it rendered.
            queueMicrotask(() => {
              list.scrollToIndex(details.index, { align });
            });
          }
        }}
        {...props}
      />
    </CommandVirtualContext.Provider>
  );
}

/**
 * Whether a filtered entry is a group, by Base UI's own predicate (`isGroup` in its
 * `internals/resolveValueLabel`): a non-null object whose `items` is an array. An object with a
 * null prototype counts too, as it does for Base UI.
 */
function isItemGroup<ItemValue>(entry: ItemValue | undefined): boolean {
  return (
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- matches Base UI's own group predicate, so the list and Base UI's navigation agree on which entries are groups
    typeof entry === "object" && entry !== null && "items" in entry && Array.isArray(entry.items)
  );
}

/**
 * `fuse.css` declares the metrics as unregistered custom properties, so the browser reports one
 * as written, a `rem` length such as ` 2rem`, and the virtualizer needs pixels.
 */
function readRowMetrics(element: HTMLElement): RowMetrics {
  const style = getComputedStyle(element);
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const metric = (name: string) => cssLengthToPx(style.getPropertyValue(name).trim(), rootFontSize);
  return {
    row: metric("--row-h") ?? DENSE_ROW_METRICS.row,
    pad: metric("--surface-pad-sm") ?? DENSE_ROW_METRICS.pad,
  };
}

/**
 * Props of `CommandVirtual.List`: Base UI Autocomplete List's, with a row function as children.
 *
 * @template ItemValue - The type of one item.
 */
export type CommandVirtualListProps<ItemValue> = Omit<
  ComponentProps<typeof AutocompletePrimitive.List>,
  "children"
> & {
  /**
   * Renders one filtered item, usually as a `Command.Item`. The list keys each row by its
   * position, so the element you return sets no `key`: one keyed by item would remount the row
   * whenever filtering moves another item into its place.
   */
  children: (item: ItemValue, index: number) => ReactNode;
  /**
   * A row's height before it is measured. Defaults to the document density's row height, which a
   * single-line `Command.Item` takes.
   */
  estimateSize?: (index: number) => number;
  /**
   * Rows rendered beyond each edge of the visible window.
   * @default 8
   */
  overscan?: number;
};

/**
 * The scrolling list of a `CommandVirtual.Root`, rendering only the rows in view plus the
 * highlighted one. It is its own scroll element, so keep it out of a `ScrollArea`. Each row is
 * measured, so rows of any height stack without gaps. For flat item lists; it renders no groups.
 */
export function CommandVirtualList<ItemValue>({
  children,
  estimateSize,
  overscan = 8,
  className,
  ref,
  ...props
}: CommandVirtualListProps<ItemValue>): ReactElement {
  const virtual = use(CommandVirtualContext);
  if (virtual === null) {
    throw new Error("CommandVirtual.List must be used within CommandVirtual.Root.");
  }
  const items = AutocompletePrimitive.useFilteredItems<ItemValue>();
  if (isItemGroup(items[0])) {
    throw new Error(
      "CommandVirtual.List renders a flat list of items, and these items are groups. Pass groups to Command.GroupedRoot and render them with Command.List."
    );
  }
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const mergedRef = useMergedRefs(ref, setScrollElement);
  const [metrics, setMetrics] = useState(DENSE_ROW_METRICS);
  useLayoutEffect(() => {
    if (scrollElement !== null) {
      setMetrics(readRowMetrics(scrollElement));
    }
  }, [scrollElement]);
  const { highlightedIndex } = virtual;
  // oxlint-disable-next-line react/incompatible-library -- TanStack Virtual hands back one mutable instance by design; the list re-renders on each scroll update it reports, and nothing here memoizes its functions.
  const virtualizer = useVirtualizer<HTMLDivElement, Element>({
    count: items.length,
    getScrollElement: () => scrollElement,
    estimateSize: estimateSize ?? (() => metrics.row),
    overscan,
    paddingStart: metrics.pad,
    paddingEnd: metrics.pad,
    scrollPaddingStart: metrics.pad,
    scrollPaddingEnd: metrics.pad,
    rangeExtractor: (range) =>
      withHighlightedRow(defaultRangeExtractor(range), highlightedIndex, range.count),
  });
  useImperativeHandle(virtual.virtualizer, () => virtualizer, [virtualizer]);
  return (
    <AutocompletePrimitive.List
      data-slot="command-list"
      ref={mergedRef}
      className={mergeClassName(className, styles.list(), commandVirtualListShellClass)}
      {...props}>
      {items.length === 0 ? null : (
        <div
          role="presentation"
          className="relative h-(--command-virtual-height) w-full"
          style={{ "--command-virtual-height": `${String(virtualizer.getTotalSize())}px` }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = items[virtualItem.index];
            if (item === undefined) {
              return null;
            }
            return (
              <CommandRowContext.Provider
                key={virtualItem.key}
                value={{
                  index: virtualItem.index,
                  ref: virtualizer.measureElement,
                  style: {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${String(virtualItem.start)}px)`,
                  },
                  setSize: items.length,
                }}>
                {children(item, virtualItem.index)}
              </CommandRowContext.Provider>
            );
          })}
        </div>
      )}
    </AutocompletePrimitive.List>
  );
}

CommandVirtualRoot.displayName = "CommandVirtual.Root";
CommandVirtualList.displayName = "CommandVirtual.List";
