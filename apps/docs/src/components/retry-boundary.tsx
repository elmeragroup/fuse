"use client";

import { Component } from "react";
import type { ReactNode } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";

type RetryBoundaryProps = {
  /** What failed, as the start of a sentence: "The Dashboard", "This demo". */
  subject: string;
  children: ReactNode;
};

type RetryBoundaryState = { failed: boolean };

const retryBoundary = tv({
  slots: {
    root: "flex h-full min-h-32 w-full flex-col items-center justify-center gap-3 p-6 text-center",
    message: "text-sm m-0 text-muted-foreground",
  },
});

const { root, message } = retryBoundary();

/**
 * Keeps a render failure inside one part of a page, so the rest of it stays usable. The usual
 * cause is a code chunk that a redeploy removed while the tab stayed open: the part's `import()`
 * then fails while it renders. A loaded module caches that failure, so the fallback reloads the
 * page, which fetches the current build, rather than rendering the part again.
 */
export class RetryBoundary extends Component<RetryBoundaryProps, RetryBoundaryState> {
  override state: RetryBoundaryState = { failed: false };

  static getDerivedStateFromError(): RetryBoundaryState {
    return { failed: true };
  }

  override render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <div role="alert" className={root()}>
        <p className={message()}>{this.props.subject} could not load.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            window.location.reload();
          }}>
          Reload
        </Button>
      </div>
    );
  }
}
