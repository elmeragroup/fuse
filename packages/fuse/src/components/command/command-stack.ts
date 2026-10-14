"use client";

import { createContext, useCallback, useMemo, useState } from "react";

export type CommandStackContextValue = {
  /** The page ids from the first page to the one on top. */
  readonly stack: readonly string[];
  /** Puts a page on top of the stack. */
  readonly push: (page: string) => void;
  /** Takes the top page off the stack, unless it is the only one. */
  readonly pop: () => void;
};

export const CommandStackContext = createContext<CommandStackContextValue | null>(null);

/** The page on top. A focus request names its id, and its label names its input. */
type CommandPageContextValue = { readonly id: string; readonly label: string };

export const CommandPageContext = createContext<CommandPageContextValue | null>(null);

/**
 * The stack's request that a page's input take focus. It has its own context, separate from the
 * stack's, so clearing a request re-renders only `Command.Input`, not every part that reads the
 * stack.
 */
type CommandFocusRequestValue = {
  /**
   * The page whose input takes focus when it mounts, which is the page that came on top while the
   * palette was showing. It is `undefined` when no page swap is waiting for its input, so a page
   * that mounts when the palette loads or its dialog opens leaves focus alone.
   */
  readonly page: string | undefined;
  /** Drops the focus request once the named page's input has taken focus. */
  readonly clear: (page: string) => void;
};

export const CommandFocusRequestContext = createContext<CommandFocusRequestValue | null>(null);

/** Whether a stack holds a page below the one on top. */
export function canGoBack(stack: CommandStackContextValue | null): stack is CommandStackContextValue {
  return stack !== null && stack.stack.length > 1;
}

/**
 * The stack's state. `pages` controls it, or else it keeps its own, starting from `defaultPages`.
 * When a different page comes on top while the palette stays showing, the stack requests focus
 * for that page's input, which takes focus once it mounts, even after Suspense. A top that
 * changes as the dialog opens or closes requests nothing, so the dialog's `initialFocus` decides.
 * That holds when the opening also mounts `Command.Content`, which registers only after the
 * render that mounts it, so `showing` alone cannot tell that render from an inline palette's.
 * Closing the palette drops the request, so a stack reset while the palette is closed requests
 * nothing.
 */
export function useStack(
  pages: readonly string[] | undefined,
  defaultPages: readonly string[] | undefined,
  onPagesChange: ((pages: string[]) => void) | undefined,
  showing: boolean,
  open: boolean
) {
  const [ownStack, setOwnStack] = useState<readonly string[]>(defaultPages ?? []);
  const stack = pages ?? ownStack;
  const top = stack.at(-1);
  const [seenTop, setSeenTop] = useState(top);
  const [seenShowing, setSeenShowing] = useState(showing);
  const [seenOpen, setSeenOpen] = useState(open);
  const [focusPage, setFocusPage] = useState<string | undefined>(undefined);
  // The state changes during render, as React's docs adjust state from a changed prop, so the
  // input that the same render mounts reads the request.
  if (seenTop !== top || seenShowing !== showing || seenOpen !== open) {
    setSeenTop(top);
    setSeenShowing(showing);
    setSeenOpen(open);
    setFocusPage(seenTop !== top && seenShowing && showing && seenOpen === open ? top : undefined);
  }
  const clearFocusPage = useCallback((page: string) => {
    setFocusPage((current) => (current === page ? undefined : current));
  }, []);
  const context = useMemo<CommandStackContextValue>(() => {
    const change = (next: string[]) => {
      if (pages === undefined) {
        setOwnStack(next);
      }
      onPagesChange?.(next);
    };
    return {
      stack,
      push: (page: string) => {
        change([...stack, page]);
      },
      pop: () => {
        if (stack.length > 1) {
          change(stack.slice(0, -1));
        }
      },
    };
  }, [stack, pages, onPagesChange]);
  const focusRequest = useMemo<CommandFocusRequestValue>(
    () => ({ page: focusPage, clear: clearFocusPage }),
    [focusPage, clearFocusPage]
  );
  return {
    context,
    focusRequest,
    reset: () => {
      if (pages === undefined) {
        setOwnStack(defaultPages ?? []);
      }
    },
  };
}
