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

/** The page on top: its id, which a focus request names, and its label, which names its input. */
type CommandPageContextValue = { readonly id: string; readonly label: string };

export const CommandPageContext = createContext<CommandPageContextValue | null>(null);

/**
 * The stack's request that a page's input take focus. Apart from the stack's own context, so
 * clearing a request re-renders only `Command.Input`, not every part that reads the stack.
 */
type CommandFocusRequestValue = {
  /**
   * The page whose input takes focus when it mounts: the page that came on top while the palette
   * was showing. `undefined` when no page swap is waiting for its input, so a page mounted when
   * the palette loads or its dialog opens leaves focus alone.
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
 * The stack's state: controlled by `pages`, else its own, starting from `defaultPages`. When a
 * different page comes on top while the palette stays showing, it requests focus for that page's
 * input, which takes it once it mounts, even after Suspense. A top that changes as the palette
 * opens requests nothing, so the dialog's `initialFocus` decides. Closing the palette drops the
 * request, so a stack reset while it is closed requests nothing.
 */
export function useStack(
  pages: readonly string[] | undefined,
  defaultPages: readonly string[] | undefined,
  onPagesChange: ((pages: string[]) => void) | undefined,
  showing: boolean
) {
  const [ownStack, setOwnStack] = useState<readonly string[]>(defaultPages ?? []);
  const stack = pages ?? ownStack;
  const top = stack.at(-1);
  const [seenTop, setSeenTop] = useState(top);
  const [seenShowing, setSeenShowing] = useState(showing);
  const [focusPage, setFocusPage] = useState<string | undefined>(undefined);
  // Adjusted during render, as React's docs adjust state from a changed prop, so the input that
  // the same render mounts reads the request.
  if (seenTop !== top || seenShowing !== showing) {
    setSeenTop(top);
    setSeenShowing(showing);
    setFocusPage(seenTop !== top && seenShowing && showing ? top : undefined);
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
