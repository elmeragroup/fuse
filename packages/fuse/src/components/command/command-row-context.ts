"use client";

import { createContext } from "react";
import type { CSSProperties } from "react";

/**
 * Package-private: what a virtual list tells the one row it renders. `Command.Item` reads it and
 * merges it into its own props, so the same part renders in `Command.List` and in
 * `CommandVirtual.List`. It names no virtualizer type, so the core entry never imports TanStack.
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
