import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { framePanelShellClass, frameShellClass } from "../../styles/inner-corner/frame";

export type FrameRootProps = ComponentProps<"div"> & {
  /**
   * Fuse adjacent `Frame.Panel`s into one card (shared radii and hairline). Default
   * `false` keeps a 4px muted gutter between panels.
   */
  stackedPanels?: boolean;
};
export type FramePanelProps = ComponentProps<"div">;
export type FrameHeaderProps = ComponentProps<"header">;
export type FrameTitleProps = ComponentProps<"div">;
export type FrameDescriptionProps = ComponentProps<"div">;
export type FrameFooterProps = ComponentProps<"footer">;

/**
 * The Frame surface. It pads with the small surface tier, `--surface-pad-sm`, and hands its
 * direct panels and tables the corner they take, `rounded-xl` less that padding, and publishes the
 * same value as `--inner-corner`.
 */
function FrameRoot({ className, stackedPanels = false, ...props }: FrameRootProps): ReactElement {
  return (
    <div
      data-slot="frame"
      className={cn(
        frameShellClass,
        "relative flex flex-col bg-muted/72",
        stackedPanels
          ? "*:has-[+[data-slot=frame-panel]]:rounded-b-none *:has-[+[data-slot=frame-panel]]:before:hidden *:[[data-slot=frame-panel]+[data-slot=frame-panel]]:rounded-t-none *:[[data-slot=frame-panel]+[data-slot=frame-panel]]:border-t-0"
          : "*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-1",
        className
      )}
      {...props}
    />
  );
}

/**
 * A panel. As a Frame's direct child it rounds with the corner the Frame hands it, and elsewhere
 * with `rounded-xl`. It pads with the large surface tier, `--surface-pad-lg`, and publishes
 * `--inner-corner` for its content, its corner less its border and padding.
 */
function FramePanel({ className, ...props }: FramePanelProps): ReactElement {
  return (
    <div
      data-slot="frame-panel"
      className={cn(
        framePanelShellClass,
        "shadow-xs/5 before:shadow-[0_1px_--theme(--color-black/6%)] relative bg-background bg-clip-padding before:pointer-events-none before:absolute before:inset-0",
        className
      )}
      {...props}
    />
  );
}

function FrameHeader({ className, ...props }: FrameHeaderProps): ReactElement {
  return (
    <header
      data-slot="frame-panel-header"
      className={cn("flex flex-col px-(--surface-pad-lg) py-4", className)}
      {...props}
    />
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
      className={cn("flex flex-col gap-1 px-(--surface-pad-lg) py-4", className)}
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
