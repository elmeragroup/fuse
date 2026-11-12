import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { ScrollArea } from "@elmeragroup/fuse/scroll-area";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

const liveCodeFrame = tv({
  slots: {
    root: "relative isolate border-t border-border bg-card",
    toolbar: "flex h-10 items-center gap-1 border-b border-border/60 ps-4 pe-2",
    file: "text-xs me-auto truncate font-mono text-muted-foreground",
    scroll: "max-h-88",
  },
});

const styles = liveCodeFrame();

type LiveCodeFrameProps = {
  /** The demo's title, which names the toolbar. */
  title: string;
  /** The demo file name, shown at the toolbar's start. */
  file: string;
  /** The toolbar's notices and actions, after the file name. */
  actions?: ReactNode;
  /** The source block, which scrolls under the toolbar. */
  source: ReactNode;
  /** What the frame holds besides, such as the popover that edits a token. */
  children?: ReactNode;
};

/**
 * Live code's frame: a toolbar naming the file over the source, which scrolls past a fixed height.
 * The loaded view fills it, and the placeholder that holds the view's place while its code loads
 * draws the same frame, so the demo keeps its height when the view arrives.
 */
export function LiveCodeFrame({ title, file, actions, source, children }: LiveCodeFrameProps): ReactElement {
  return (
    <div className={styles.root()}>
      <Toolbar.Root aria-label={`${title} code`} className={styles.toolbar()}>
        <span className={styles.file()}>{file}</span>
        {actions}
      </Toolbar.Root>
      <ScrollArea.Root className={styles.scroll()}>{source}</ScrollArea.Root>
      {children}
    </div>
  );
}
