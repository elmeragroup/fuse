import { Component } from "react";
import type { ReactElement, ReactNode } from "react";

import { expect, vi } from "vitest";

import { withLocale } from "./locale-matrix";
import { renderThemed } from "./themed-browser-render";

type CaughtErrorState = { name: string; message: string | null };

/**
 * Renders the message of an error its children throw while rendering, so a browser test can
 * assert which error a component raises at mount without an uncaught error ending the run. The
 * message's span carries the error's `name` in `data-error-name`.
 */
export class CaughtError extends Component<{ children: ReactNode }, CaughtErrorState> {
  state: CaughtErrorState = { name: "", message: null };

  static getDerivedStateFromError(error: Error): CaughtErrorState {
    return { name: error.name, message: error.message };
  }

  render() {
    if (this.state.message !== null) {
      return <span data-error-name={this.state.name}>{this.state.message}</span>;
    }
    return this.props.children;
  }
}

/** The name and message of the error a `CaughtError` caught, or `null`s while none is caught. */
export function caughtError() {
  // The caught message is the fixture's own span, which no role or name identifies.
  const caught = document.querySelector("[data-error-name]");
  return { name: caught?.getAttribute("data-error-name") ?? null, message: caught?.textContent ?? null };
}

/**
 * Renders each tree in turn, themed and in en-US, inside a `CaughtError`, and expects the last to
 * throw a `TypeError` while rendering whose message starts with `prefix`, and nothing before it.
 * React's report of the caught error is silenced on `console.error` until the trees are done,
 * whether or not the expectations hold.
 *
 * @param prefix - The start of the message, written out by hand.
 * @param trees - The trees, the last of which throws.
 */
export function expectRenderTypeError(prefix: string, ...trees: [ReactElement, ...ReactElement[]]): void {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    const caught = (tree: ReactElement) => withLocale("en-US", <CaughtError>{tree}</CaughtError>);
    const [first, ...rest] = trees;
    const { rerender } = renderThemed(caught(first));
    for (const tree of rest) {
      expect(caughtError().name).toBeNull();
      rerender(caught(tree));
    }
    const { name, message } = caughtError();
    expect(name).toBe("TypeError");
    expect(message?.slice(0, prefix.length)).toBe(prefix);
  } finally {
    error.mockRestore();
  }
}
