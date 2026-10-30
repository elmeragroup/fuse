import type { ComponentProps, ReactElement, ReactNode } from "react";
import { Children, Fragment, isValidElement } from "react";

import { isTextValueNode } from "../../internal/is-text-node";
import { cn } from "../../styles/cn";
import { framePanelShellClass, frameShellClass } from "../../styles/inner-corner/frame";
import { Table, VerticalTable } from "../table/table";

export type FrameRootProps = ComponentProps<"div"> & {
  /**
   * How the Frame lays out its panels.
   *
   * - `"gutter"`: the Frame pads its panels with the small surface tier and keeps a 4px muted
   *   gutter between adjacent panels, each a card of its own.
   * - `"stacked"`: adjacent panels fuse into one card that shares their radii and hairline.
   * - `"flush"`: the Frame drops its padding, its header and footer sit in its muted band, and
   *   its panels and Tables run to its edges and round with its own corner. Adjacent panels fuse
   *   as in `"stacked"`.
   *
   * @defaultValue "gutter"
   */
  layout?: "gutter" | "stacked" | "flush";
};

/** A Frame's `layout`: how it lays out its panels. */
export type FrameLayout = NonNullable<FrameRootProps["layout"]>;
export type FramePanelProps = ComponentProps<"div">;
export type FrameHeaderProps = ComponentProps<"header">;
export type FrameTitleProps = ComponentProps<"div">;
export type FrameDescriptionProps = ComponentProps<"div">;
export type FrameFooterProps = ComponentProps<"footer">;

/**
 * The Frame surface: a muted band behind a 1px border that holds a header, panels, Tables and a
 * footer. Its `layout` sets how its panels sit, and it hands its panels and Tables the corner
 * they take, concentric with its `rounded-xl`. A `Collapsible.Root` that is its direct child,
 * holding a `Frame.Header` and a `Collapsible.Content` around a panel or Table, makes that panel
 * collapsible and keeps its corner and layout.
 */
function FrameRoot({ className, layout = "gutter", ...props }: FrameRootProps): ReactElement {
  return (
    <div
      data-slot="frame"
      data-layout={layout}
      className={cn(
        frameShellClass,
        "relative flex flex-col bg-muted/72 bg-clip-padding",
        // Each layout keys on `data-layout` and reaches the Frame's items through the `frame-*`
        // variants in `frame-variants.css`, as `inner-corner/frame.ts` defines them. The gutter
        // layout sets adjacent panels 4px apart.
        "data-[layout=gutter]:frame-seam-lower:mt-1",
        // The stacked and flush layouts fuse adjacent panels: the shell squares the corners that
        // meet, the lower panel drops the border they would share, and the upper one hides the
        // highlight that would darken it.
        "not-data-[layout=gutter]:frame-seam-upper:before:hidden not-data-[layout=gutter]:frame-seam-lower:border-t-0",
        // A Collapsible.Content clips its overflow for its height transition, which would cut off
        // a panel's shadow. In a Frame it clips with a clip-path instead, which follows the
        // animating height and reaches past the box by the panel's shadow-xs, 2px to the sides and
        // 3px below, plus the 1px a flush item overhangs, above too when the section starts the
        // Frame. `flow-root` keeps the block formatting
        // context the clip gave it, so a child's margin stays inside.
        "frame-section:flow-root frame-section:overflow-visible frame-section:[clip-path:inset(-1px_-3px_-4px_-3px)]",
        // Flush items pull 1px over the root's border at its sides, and at its top and bottom
        // when they start or end it, so their own border draws the Frame's edge there. Their
        // highlight would darken that edge, so it hides. A Table container's full width would stop
        // its end short of the border, so it sizes to its margins instead.
        "data-[layout=flush]:frame-item:-mx-px data-[layout=flush]:frame-panel-item:before:hidden data-[layout=flush]:frame-table-item:w-auto data-[layout=flush]:frame-first-item:-mt-px data-[layout=flush]:frame-last-item:-mb-px",
        className
      )}
      {...props}
    />
  );
}

/**
 * The panel's content as far as the panel can see it without rendering its children: Fragments
 * flattened, and blank text dropped.
 */
function contentNodes(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) {
      return contentNodes(child.props.children);
    }
    return isTextValueNode(child) && String(child).trim() === "" ? [] : [child];
  });
}

/**
 * Whether a panel's only content is a `Table.Root` or `VerticalTable.Body` element. The panel
 * decides it here, at the React boundary, because CSS cannot see text nodes: a component child
 * that renders text beside a Table leaves one element in the DOM, but it is not a Table element.
 */
function holdsOnlyTable(children: ReactNode): boolean {
  const nodes = contentNodes(children);
  const [only] = nodes;
  return (
    nodes.length === 1 &&
    isValidElement(only) &&
    (only.type === Table.Root || only.type === VerticalTable.Body)
  );
}

/**
 * A panel. As a Frame's item it rounds with the corner the Frame hands it, and elsewhere with
 * `rounded-xl`. It pads with the large surface tier, `--surface-pad-lg`, and publishes
 * `--inner-corner` for its content, its corner less its border and padding. A Table in it renders
 * as a plain table.
 *
 * A panel whose only child is a `Table.Root` or `VerticalTable.Body` element, written directly in
 * its children, drops its padding and writes `data-sole-table="true"`: the table runs to the
 * panel's edges, clips to its corners, and its first and last columns take over the padding, so
 * their text lines up with the panel's. Anything else keeps the padding, including text beside the
 * table and a component of your own that renders a table.
 */
function FramePanel({ className, ...props }: FramePanelProps): ReactElement {
  return (
    <div
      data-slot="frame-panel"
      data-sole-table={holdsOnlyTable(props.children)}
      className={cn(
        framePanelShellClass,
        "shadow-xs/5 before:shadow-[0_1px_--theme(--color-black/6%)] relative bg-background bg-clip-padding before:pointer-events-none before:absolute before:inset-0",
        className
      )}
      {...props}
    />
  );
}

/**
 * The header and footer bars' padding: inline the Frame's bar inset, or the large surface tier
 * outside a Frame, and on the block axis half that tier.
 */
const barPaddingClass = cn(
  "px-[var(--frame-bar-inset,var(--surface-pad-lg))] py-[calc(var(--surface-pad-lg)/2)]"
);

/**
 * A header band in the Frame's muted surface. In a Frame its inline padding starts its text on
 * the Frame's text inset, where a panel's text starts, and outside one it is the large surface
 * tier. Its block padding is half that tier, so it reads as chrome above the panels. A `Collapsible.Trigger`
 * that is its direct child takes the whole band: it carries the band's padding and title type,
 * draws the shared focus ring inside its edges, and turns a trailing icon, such as `CaretDown`,
 * half a turn while its panel is open.
 */
function FrameHeader({ className, ...props }: FrameHeaderProps): ReactElement {
  return (
    <header
      data-slot="frame-panel-header"
      className={cn(
        "flex flex-col has-[>[data-slot=collapsible-trigger]]:p-0",
        barPaddingClass,
        // The trigger pads as `barPaddingClass` does, and takes the title's type.
        "frame-header-trigger:font-semibold frame-header-trigger:text-sm frame-header-trigger:flex frame-header-trigger:w-full frame-header-trigger:cursor-pointer frame-header-trigger:items-center frame-header-trigger:justify-between frame-header-trigger:gap-2 frame-header-trigger:rounded-inner frame-header-trigger:px-[var(--frame-bar-inset,var(--surface-pad-lg))] frame-header-trigger:py-[calc(var(--surface-pad-lg)/2)] frame-header-trigger:text-start",
        // oxlint-disable-next-line elmera/no-local-focus-ring -- the shared self ring, drawn inset
        "frame-header-trigger:focus-visible:ring-inset",
        "frame-header-trigger:*:[svg]:size-4 frame-header-trigger:*:[svg]:shrink-0 frame-header-trigger:*:[svg]:text-muted-foreground frame-header-trigger:*:[svg]:transition-transform frame-header-trigger:*:[svg]:duration-200 frame-header-trigger:data-panel-open:*:[svg]:rotate-180",
        className
      )}
      {...props}
    />
  );
}

/** The header's title, in the small semibold type. */
function FrameTitle({ className, ...props }: FrameTitleProps): ReactElement {
  return <div data-slot="frame-panel-title" className={cn("text-sm font-semibold", className)} {...props} />;
}

/** The header's description, in the small muted type. */
function FrameDescription({ className, ...props }: FrameDescriptionProps): ReactElement {
  return (
    <div
      data-slot="frame-panel-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/** A footer band in the Frame's muted surface, padded as the header is, so its text lines up too. */
function FrameFooter({ className, ...props }: FrameFooterProps): ReactElement {
  return (
    <footer
      data-slot="frame-panel-footer"
      className={cn("flex flex-col gap-1", barPaddingClass, className)}
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
