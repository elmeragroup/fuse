"use client";

import { createContext } from "react";
import type { ComponentProps, CSSProperties, ReactNode, RefObject } from "react";

// The package-root import, as in command.tsx: the combobox family's subpaths crash at runtime.
import type { Autocomplete as AutocompletePrimitive } from "@base-ui/react";

/**
 * Package-private: what a virtual list tells the one row it renders. `Command.Item` reads it and
 * merges it into its own props, so the same part renders in an ordinary list and in a virtual
 * one. No context in this file names a virtualizer type, so the core entry never imports
 * TanStack.
 */
export type CommandRow = {
  /** The row's index in the filtered items, which Base UI's navigation and Enter key read. */
  readonly index: number;
  /** Measures the rendered row, so rows of any height stack without gaps. */
  readonly ref: (element: Element | null) => void;
  /** Places the row in the list's scroll space. */
  readonly style: CSSProperties;
  /** How many items the filtered list holds, for `aria-setsize`. */
  readonly setSize: number;
};

/** The row a virtual list is rendering, or `null` in an ordinary list. */
export const CommandRowContext = createContext<CommandRow | null>(null);

/** The row function Base UI's Autocomplete List takes as children. */
export type CommandListRows = Extract<
  ComponentProps<typeof AutocompletePrimitive.List>["children"],
  (...args: never[]) => ReactNode
>;

/**
 * `true` inside the element `Command.List` renders from its `render` value, which receives the
 * row function as `children`. `CommandVirtual.List` checks it to throw a named error anywhere else.
 */
export const CommandListTargetContext = createContext(false);

/** What a virtual list registers with its search: TanStack's `Virtualizer` satisfies it. */
export type CommandVirtualScroller = {
  /** The list's settings; `count` is how many rows it holds. */
  readonly options: { readonly count: number };
  /** Scrolls the list until the row at `index` sits at `align`. */
  scrollToIndex: (index: number, options: { align: "start" | "end" }) => void;
};

/** What a search tells its list: whether it is virtualized, and the virtual list's state. */
export type CommandSearchState = {
  /** Whether the search passes `virtualized` to Base UI, so its list must mount rows by index. */
  readonly virtualized: boolean;
  /** The highlighted row's index, which a virtual list keeps mounted. Tracked only when virtualized. */
  readonly highlightedIndex: number | undefined;
  /** The virtual list's scroller, which the search scrolls when the highlight jumps out of view. */
  readonly scroller: RefObject<CommandVirtualScroller | null>;
};

/** The enclosing search's state, or `null` outside a search. */
export const CommandSearchContext = createContext<CommandSearchState | null>(null);
