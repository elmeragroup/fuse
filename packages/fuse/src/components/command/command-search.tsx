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
  CommandSearchOmitted | "autoHighlight" | "keepHighlight" | "value" | "defaultValue" | "virtualized"
> & {
  /**
   * Marks `items` as groups, each with its own `items`. The callbacks, such as
   * `itemToStringValue` and `onItemHighlighted`, then receive one item of a group. Give each
   * `Command.Group` its group's `items`, and name it with `Command.Label`. The search throws
   * when the first entry disagrees with `grouped`.
   */
  grouped?: Grouped;
  /**
   * Whether the search highlights the first matching item, as Base UI's prop of the same name
   * does. `true` highlights it after the user types, and `"always"` keeps it highlighted.
   * Closing `Command.Content` clears the highlight. With `"always"`, the next opening highlights
   * the first match again. With `true` or `false`, it opens with no row highlighted.
   */
  autoHighlight?: boolean | "always" | undefined;
  /** Whether the highlighted item stays highlighted when the pointer leaves the list. */
  keepHighlight?: boolean | undefined;
  /**
   * The query, to control the search with `onValueChange`. A `Command.Page` mounts fresh each
   * time it comes on top, with an empty query. To keep a page's query when the user goes back,
   * hold it above `Command.Root` and pass it here. A query held there also lasts from one opening
   * of `Command.Content` to the next.
   */
  value?: AutocompleteRootProps<CommandItemOf<Item, Groups, Grouped>>["value"];
  /**
   * The query an uncontrolled search starts with. A `Command.Page` starts with it each time it
   * comes on top. In a Root with `Command.Content`, the query goes back to `defaultValue` when
   * the close animation ends or an opening interrupts the close, even while the Root stays
   * mounted.
   */
  defaultValue?: AutocompleteRootProps<CommandItemOf<Item, Groups, Grouped>>["defaultValue"];
  /**
   * Renders only the rows in view, for thousands of items. Install `@tanstack/react-virtual`
   * 3.14 or later, and pass `<CommandVirtual.List />` as `Command.List`'s `render`. Import it
   * from `@elmeragroup/fuse/command-virtual`, which the root barrel leaves out, so an app without
   * the virtualizer never loads it. A virtual list renders flat items only, so `virtualized`
   * beside `grouped` throws.
   */
  virtualized?: AutocompleteRootProps<CommandItemOf<Item, Groups, Grouped>>["virtualized"];
} & (Grouped extends true
    ? {
        /** The groups of items, in the order the list shows them. */
        items: Groups;
      }
    : {
        /**
         * The items, as a flat list, in the order the list shows them. The search filters them
         * as the user types, in the locale of `LocaleProvider`. For results from a server, pass
         * them here and set `filter={null}`, so the list shows them as the server sent them. In
         * a palette that stays mounted, keep `items` unchanged while the dialog closes, so the
         * closing dialog keeps the rows the user chose from.
         */
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
 * One search, which is Base UI's Autocomplete, always open, with its list inline. Each new
 * session of the palette sends an uncontrolled query back to `defaultValue` and clears the
 * highlight, which `autoHighlight="always"` puts back on the first match. A virtualized search
 * tracks the highlighted row and scrolls its virtual list when the highlight jumps out of view.
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
  // Each new session starts fresh. The state changes during render, not in an effect, as React's
  // docs adjust state from a changed prop.
  // Autocomplete keeps its highlighted row in its own store, above any rows that remount. Base UI
  // clears it in `unmount()`, which it calls itself when a close animation ends, but only while
  // the Autocomplete is closed, and this inline search is always open. Base UI ignores an
  // `unmount()` call while the Autocomplete is open, so each new session closes the search for
  // one commit. The layout effect of that commit calls `unmount()`, and its cleanup reports
  // `onOpenChangeComplete(false)`, which opens the search again before the browser paints.
  // `unmount()` clears the highlight, and `autoHighlight="always"` then puts it back on the first
  // row. It fires `onItemHighlighted`, not `onValueChange`. After a finished close it clears a
  // highlight the next opening would reset anyway, and after an opening that interrupted a close
  // it is the only reset the highlight gets.
  const [resetting, setResetting] = useState(false);
  const [seenSession, setSeenSession] = useState(session);
  if (seenSession !== session) {
    setSeenSession(session);
    setOwnQuery(defaultValue ?? "");
    setResetting(true);
  }
  const actionsRef = useRef<AutocompleteRootActions | null>(null);
  useLayoutEffect(() => {
    if (resetting) {
      actionsRef.current?.unmount();
    }
  }, [resetting]);
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
        open={!resetting}
        onOpenChangeComplete={(isOpen) => {
          if (!isOpen) {
            setResetting(false);
          }
        }}
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
