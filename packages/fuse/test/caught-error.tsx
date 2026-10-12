import { Component } from "react";
import type { ReactNode } from "react";

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
  // DOM audit: the caught message is the fixture's own span, which no role or name identifies.
  const caught = document.querySelector("[data-error-name]");
  return { name: caught?.getAttribute("data-error-name") ?? null, message: caught?.textContent ?? null };
}
