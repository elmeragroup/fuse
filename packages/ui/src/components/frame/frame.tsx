import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";

export type FrameRootProps = ComponentProps<"div"> & {
  /**
   * Fuse adjacent `Frame.Panel`s into one card (shared radii and hairline). Default
   * `false` keeps a 4px muted gutter between panels (frame.md §4).
   */
  stackedPanels?: boolean;
};
export type FramePanelProps = ComponentProps<"div">;
export type FrameHeaderProps = ComponentProps<"header">;
export type FrameTitleProps = ComponentProps<"div">;
export type FrameDescriptionProps = ComponentProps<"div">;
export type FrameFooterProps = ComponentProps<"footer">;

function FrameRoot({ className, stackedPanels = false, ...props }: FrameRootProps): ReactElement {
  return (
    <div
      data-slot="frame"
      className={cn(
        "relative flex flex-col rounded-xl bg-muted/72 p-1",
        stackedPanels
          ? "*:has-[+[data-slot=frame-panel]]:rounded-b-none *:has-[+[data-slot=frame-panel]]:before:hidden *:[[data-slot=frame-panel]+[data-slot=frame-panel]]:rounded-t-none *:[[data-slot=frame-panel]+[data-slot=frame-panel]]:border-t-0"
          : "*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-1",
        className
      )}
      {...props}
    />
  );
}

function FramePanel({ className, ...props }: FramePanelProps): ReactElement {
  return (
    <div
      data-slot="frame-panel"
      className={cn(
        "shadow-xs/5 before:shadow-[0_1px_--theme(--color-black/6%)] relative rounded-xl border bg-background bg-clip-padding p-5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)]",
        className
      )}
      {...props}
    />
  );
}

function FrameHeader({ className, ...props }: FrameHeaderProps): ReactElement {
  return (
    <header data-slot="frame-panel-header" className={cn("flex flex-col px-5 py-4", className)} {...props} />
  );
}

function FrameTitle({ className, ...props }: FrameTitleProps): ReactElement {
  return <div data-slot="frame-panel-title" className={cn("text-sm font-semibold", className)} {...props} />;
}

function FrameDescription({ className, ...props }: FrameDescriptionProps): ReactElement {
  return (
    <div
      data-slot="frame-panel-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function FrameFooter({ className, ...props }: FrameFooterProps): ReactElement {
  return (
    <footer
      data-slot="frame-panel-footer"
      className={cn("flex flex-col gap-1 px-5 py-4", className)}
      {...props}
    />
  );
}

FrameRoot.displayName = "Frame.Root";
FramePanel.displayName = "Frame.Panel";
FrameHeader.displayName = "Frame.Header";
FrameTitle.displayName = "Frame.Title";
FrameDescription.displayName = "Frame.Description";
FrameFooter.displayName = "Frame.Footer";

export const Frame = {
  Root: FrameRoot,
  Panel: FramePanel,
  Header: FrameHeader,
  Title: FrameTitle,
  Description: FrameDescription,
  Footer: FrameFooter,
};
