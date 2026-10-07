import { Component } from "react";
import type { ReactNode } from "react";

type CaughtErrorState = { message: string | null };

/**
 * Renders the message of an error its children throw while rendering, so a browser test can
 * assert which error a component raises at mount without an uncaught error ending the run.
 */
export class CaughtError extends Component<{ children: ReactNode }, CaughtErrorState> {
  state: CaughtErrorState = { message: null };

  static getDerivedStateFromError(error: Error): CaughtErrorState {
    return { message: error.message };
  }

  render() {
    if (this.state.message !== null) {
      return <span>{this.state.message}</span>;
    }
    return this.props.children;
  }
}
