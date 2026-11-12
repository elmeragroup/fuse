"use client";

import { Component, Fragment } from "react";
import type { ReactNode } from "react";

import { LiveCodeContext } from "./lens";
import type { LiveCodeStore } from "./lens";

type LiveCodeBoundaryState = {
  /** What the stage threw, until the boundary recovers from it. */
  readonly thrown: { readonly error: unknown } | null;
  /** Counts recoveries; the stage remounts under a new key after each one. */
  readonly attempt: number;
};

/**
 * Keeps a Live code edit from breaking its stage. When the stage throws before it commits the
 * reader's last edit, the boundary reverts that edit, which leaves a notice in the code toolbar,
 * and remounts the stage. A throw with no edit to blame is the demo's own, and the boundary hands
 * it on to the frame's `RetryBoundary`. Outside a Live code frame no edit is ever unsettled, so
 * every throw goes on.
 */
export class LiveCodeBoundary extends Component<{ children: ReactNode }, LiveCodeBoundaryState> {
  static override contextType = LiveCodeContext;
  declare context: LiveCodeStore | null;
  override state: LiveCodeBoundaryState = { thrown: null, attempt: 0 };

  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- React hands a boundary whatever its children threw
  static getDerivedStateFromError(error: unknown): Partial<LiveCodeBoundaryState> {
    return { thrown: { error } };
  }

  override componentDidCatch(): void {
    if (this.context?.rejectUnsettled() === true) {
      this.setState((state) => ({ thrown: null, attempt: state.attempt + 1 }));
    }
  }

  override render(): ReactNode {
    const { thrown, attempt } = this.state;
    if (thrown !== null) {
      // The last edit is still unsettled while the boundary waits to revert it; otherwise the
      // throw is the demo's own.
      if (this.context?.hasUnsettled() !== true) throw thrown.error;
      return null;
    }
    return <Fragment key={attempt}>{this.props.children}</Fragment>;
  }
}
