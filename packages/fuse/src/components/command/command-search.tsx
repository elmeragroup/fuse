"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { Autocomplete as AutocompletePrimitive } from "@base-ui/react";
import type {
  AutocompleteRootActions,
  AutocompleteRootHighlightEventDetails,
  AutocompleteRootProps,
} from "@base-ui/react";

import { useLocale } from "../../intl/locale-context";
import { CommandCompositionError } from "./command-error";
import { CommandSearchContext } from "./command-list-context";
import type { CommandSearchState, CommandVirtualScroller } from "./command-list-context";
import { highlightScrollAlign } from "./highlight-scroll";

/** A group of items as Base UI recognizes one, an object with its own `items` list. */
export type ItemGroup = { readonly items: readonly unknown[] };

/**
 * Whether an entry is a group, by the predicate Base UI uses, `isGroup` in its
 * `internals/resolveValueLabel`. A group is a non-null object whose `items` is an array. An object
 * with a null prototype counts too, as it does for Base UI.
 */
function isItemGroup<Entry>(entry: Entry): boolean {
  return (
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- matches Base UI's own group predicate, so the palette and Base UI agree on which entries are groups
    typeof entry === "object" && entry !== null && "items" in entry && Array.isArray(entry.items)
  );
}

/**
 * One item of the palette. It is an item of a group of `Groups` when `Grouped` is `true`, and
 * `Item` otherwise.
 *
 * @template Item - The item of a flat search.
 * @template Groups - The whole `items` array of a grouped search.
 * @template Grouped - Whether the search's `items` are groups.
 */
type CommandItemOf<
  Item,
  Groups extends readonly ItemGroup[],
  Grouped extends boolean | undefined,
> = Grouped extends true ? Groups[number]["items"][number] : Item;

/** Autocomplete Root props a search pins or leaves out. An inline list has no popup to open. */
type CommandSearchOmitted =
  | "items"
  | "locale"
  | "open"
  | "defaultOpen"
  | "onOpenChange"
  | "onOpenChangeComplete"
  | "modal"
  | "inline"
  | "actionsRef"
  | "children";

/**
 * The props of a palette's search, which `Command.Root` takes when it has no stack and each
 * `Command.Page` takes. They are Base UI Autocomplete Root's props. Without `grouped` they are
 * generic over one item, as Base UI's flat overload is. With `grouped` they are generic over the
 * whole array of groups, as its grouped overload is. `locale` comes from `LocaleProvider`, and the
 * popup props are gone, since the list is always open inline.
 *
 * @template Item - The item of a flat search.
 * @template Groups - The whole `items` array of a grouped search.
 * @template Grouped - Whether the search's `items` are groups.
 */
export type CommandSearchProps<
  Item = unknown,
  Groups extends readonly ItemGroup[] = readonly ItemGroup[],
  Grouped extends boolean | undefined = false,
> = Omit<
  AutocompleteRootProps<CommandItemOf<Item, Groups, Grouped>>,
  CommandSearchOmitted | "autoHighlight" | "keepHighlight"
> & {
  /**
   * Marks `items` as groups, each with its own `items`. The callbacks, such as
   * `itemToStringValue` and `onItemHighlighted`, then receive one item of a group. The search
   * throws when the first entry disagrees with it.
   * @default false
   */
  grouped?: Grouped;
  /**
   * Whether the search highlights the first matching item, as Base UI's prop of the same name
   * does. `true` highlights it after the user types, and `"always"` keeps it highlighted.
   * @default "always"
   */
  autoHighlight?: boolean | "always" | undefined;
  /**
   * Whether the highlighted item stays highlighted when the pointer leaves the list.
   * @default true
   */
  keepHighlight?: boolean | undefined;
} & (Grouped extends true
    ? {
        /** The groups of items, in the order the list shows them. */
        items: Groups;
      }
    : {
        /** The items, as a flat list, in the order the list shows them. */
        items?: readonly Item[] | undefined;
      });

/** The search props the module passes around inside, with the item type erased. */
type CommandSearchCoreProps = Omit<
  // oxlint-disable-next-line typescript/no-explicit-any -- SAFETY: the public props pair each callback with its items. This type erases the item type so one search serves every Root and Page, and `unknown` would reject the typed callbacks.
  AutocompleteRootProps<any>,
  CommandSearchOmitted
> & {
  grouped?: boolean | undefined;
  items?: readonly unknown[] | undefined;
};

/**
 * Throws the named error for an `items` list that disagrees with `grouped`, or for `virtualized`
 * beside `grouped`. It reads the first entry, as Base UI does.
 */
function assertGrouping(
  part: string,
  grouped: boolean,
  virtualized: boolean,
  entries: readonly unknown[] | undefined
): void {
  if (grouped && virtualized) {
    throw new CommandCompositionError(part, "virtualized-grouped");
  }
  if (entries === undefined || entries.length === 0) {
    return;
  }
  const isGroup = isItemGroup(entries[0]);
  if (isGroup && !grouped) {
    throw new CommandCompositionError(part, "groups-without-grouped");
  }
  if (!isGroup && grouped) {
    throw new CommandCompositionError(part, "grouped-without-groups");
  }
}

/**
 * One search, which is Base UI's Autocomplete, always open, with its list inline and the first
 * match always highlighted. Each new session of the palette sends an uncontrolled query back to
 * `defaultValue` and the highlight back to the first match. A virtualized search tracks the
 * highlighted row and scrolls its virtual list when the highlight jumps out of view.
 */
export function CommandSearch({
  part,
  session,
  grouped = false,
  virtualized = false,
  value,
  defaultValue,
  onValueChange,
  onItemHighlighted,
  autoHighlight,
  keepHighlight,
  children,
  ...props
}: CommandSearchCoreProps & {
  part: string;
  /**
   * The palette's count of sessions, which advances when a close animation ends or an opening
   * interrupts a close. A change resets an uncontrolled query and the highlight, including those
   * of a page that wraps `Command.Content` and so stays mounted while the dialog is closed.
   */
  session: number;
  autoHighlight: NonNullable<CommandSearchCoreProps["autoHighlight"]>;
  keepHighlight: boolean;
  children?: ReactNode;
}): ReactElement {
  assertGrouping(part, grouped, virtualized, props.items ?? props.filteredItems);
  const { locale } = useLocale();
  const [ownQuery, setOwnQuery] = useState(defaultValue ?? "");
  // Each close of the dialog starts the next opening fresh. The state changes during render, not
  // in an effect, as React's docs adjust state from a changed prop.
  const [seenSession, setSeenSession] = useState(session);
  if (seenSession !== session) {
    setSeenSession(session);
    setOwnQuery(defaultValue ?? "");
  }
  // Autocomplete keeps its highlighted row in its own store, above any rows that remount. Base UI
  // clears it in `unmount()`, which it calls itself when a close animation ends, but only while
  // the Autocomplete is closed, and this inline search is always open. So the search calls it
  // through `actionsRef` instead, which turns Base UI's own call off. `unmount()` clears the
  // highlight, and `autoHighlight="always"` then puts it back on the first row. It fires
  // `onItemHighlighted`, not `onValueChange`. It runs on each new session: after a finished
  // close it clears a highlight the next opening would reset anyway, and after an opening that
  // interrupted a close it is the only reset the highlight gets.
  const actionsRef = useRef<AutocompleteRootActions | null>(null);
  const highlightSession = useRef(session);
  useLayoutEffect(() => {
    if (highlightSession.current !== session) {
      highlightSession.current = session;
      actionsRef.current?.unmount();
    }
  }, [session]);
  const scroller = useRef<CommandVirtualScroller | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | undefined>(undefined);
  const state = useMemo<CommandSearchState>(
    () => ({ virtualized, highlightedIndex, scroller }),
    [virtualized, highlightedIndex]
  );
  return (
    <CommandSearchContext.Provider value={state}>
      <AutocompletePrimitive.Root
        inline
        open
        actionsRef={actionsRef}
        autoHighlight={autoHighlight}
        keepHighlight={keepHighlight}
        virtualized={virtualized}
        value={value ?? ownQuery}
        onValueChange={(next: string, details) => {
          setOwnQuery(next);
          onValueChange?.(next, details);
        }}
        onItemHighlighted={(item, details: AutocompleteRootHighlightEventDetails) => {
          onItemHighlighted?.(item, details);
          if (!virtualized) {
            return;
          }
          setHighlightedIndex(item === undefined ? undefined : details.index);
          const list = scroller.current;
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
        locale={locale}>
        {children}
      </AutocompletePrimitive.Root>
    </CommandSearchContext.Provider>
  );
}
