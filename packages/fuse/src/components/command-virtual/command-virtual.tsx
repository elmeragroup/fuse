"use client";

import { use, useImperativeHandle, useLayoutEffect, useState } from "react";
import type { ComponentProps, ReactElement } from "react";

// The package-root import, as in command.tsx: the combobox family's subpaths crash at runtime.
import { Autocomplete as AutocompletePrimitive } from "@base-ui/react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { cssLengthToPx } from "../../theme/css-values";
import { CommandCompositionError } from "../command/command-error";
import {
  CommandListTargetContext,
  CommandRowContext,
  CommandSearchContext,
} from "../command/command-list-context";
import type { CommandListRows } from "../command/command-list-context";
import { DENSE_ROW_METRICS } from "./row-metrics";
import type { RowMetrics } from "./row-metrics";
import { withHighlightedRow } from "./virtual-highlight";

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
 * Props of `CommandVirtual.List`: a `div`'s, which `Command.List` fills with Base UI's listbox
 * props and its row function, plus the virtualizer's two settings. Write it with no children:
 * `<Command.List render={<CommandVirtual.List />}>` passes its own row function as `children`.
 */
export type CommandVirtualListProps = Omit<ComponentProps<"div">, "children"> & {
  /**
   * The row function, which `Command.List` passes from its own children. Renders one filtered
   * item, usually as a `Command.Item`.
   */
  children?: CommandListRows;
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
 * The render element of a virtualized search's `Command.List`, as in
 * `<Command.List render={<CommandVirtual.List />}>`. It renders only the rows in view plus the
 * highlighted one, through the row function `Command.List` passes as `children`, and registers
 * its virtualizer with the search, which scrolls it when the highlight jumps out of view. It keys
 * each row by its position, so the row function's element sets no `key`. It is its own scroll
 * element, so keep it out of a `ScrollArea`. Each row is measured, so rows of any height stack
 * without gaps. Throws outside `Command.List`'s `render`, and in a search without `virtualized`.
 */
export function CommandVirtualList({
  children: rows,
  estimateSize,
  overscan = 8,
  ref,
  ...props
}: CommandVirtualListProps): ReactElement {
  if (!use(CommandListTargetContext) || rows === undefined) {
    throw new CommandCompositionError("CommandVirtual.List", "virtual-list-outside-list");
  }
  const search = use(CommandSearchContext);
  if (search === null || !search.virtualized) {
    throw new CommandCompositionError("CommandVirtual.List", "virtual-list-without-virtualized");
  }
  const items = AutocompletePrimitive.useFilteredItems<unknown>();
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const mergedRef = useMergedRefs(ref, setScrollElement);
  const [metrics, setMetrics] = useState(DENSE_ROW_METRICS);
  useLayoutEffect(() => {
    if (scrollElement !== null) {
      setMetrics(readRowMetrics(scrollElement));
    }
  }, [scrollElement]);
  const { highlightedIndex } = search;
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
  useImperativeHandle(search.scroller, () => virtualizer, [virtualizer]);
  return (
    <div ref={mergedRef} {...props}>
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
                <CommandListTargetContext.Provider value={false}>
                  {rows(item, virtualItem.index)}
                </CommandListTargetContext.Provider>
              </CommandRowContext.Provider>
            );
          })}
        </div>
      )}
    </div>
  );
}

CommandVirtualList.displayName = "CommandVirtual.List";
