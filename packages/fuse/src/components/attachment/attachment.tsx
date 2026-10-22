"use client";

import { createContext, useContext } from "react";
import type { ComponentProps, ReactElement } from "react";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import type { VariantProps } from "tailwind-variants";

import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { ScrollAreaBar } from "../scroll-area/scroll-area";
import { attachmentVariants } from "./attachment-variants";

const styles = attachmentVariants();

/** Whether a part sits inside `Attachment.Group`, whose list owns its roots as list items. */
const AttachmentGroupContext = createContext(false);

/** The layout of an attachment: a row beside its media, or a tile under it. */
export type AttachmentOrientation = NonNullable<VariantProps<typeof attachmentVariants>["orientation"]>;

/** The enclosing root's orientation. Outside a root an action takes the row's look. */
const AttachmentOrientationContext = createContext<AttachmentOrientation>("horizontal");

/**
 * The orientation of the `Attachment.Root` around the caller, `horizontal` outside one.
 *
 * @returns The enclosing root's orientation.
 */
export function useAttachmentOrientation(): AttachmentOrientation {
  return useContext(AttachmentOrientationContext);
}

/** The upload lifecycle an attachment shows. */
export type AttachmentState = "idle" | "uploading" | "processing" | "error" | "done";

/** `Attachment.Root` takes a native `div`'s props plus the lifecycle and layout props. */
export type AttachmentRootProps = ComponentProps<"div"> &
  Pick<VariantProps<typeof attachmentVariants>, "size" | "orientation"> & {
    /**
     * The upload lifecycle, written to `data-state`. It only styles: `idle` dashes the border,
     * `uploading` and `processing` sweep the title and dim image media, and `error` tints the
     * border, the media and the description. Say the state in words in `Attachment.Description`.
     */
    state?: AttachmentState;
  };

/**
 * One file or image. `orientation="horizontal"` lays the media beside the content, and
 * `"vertical"` stacks a tile with the media on top. `size` sets the padding and type. Inside
 * `Attachment.Group` it is a list item. It publishes `--inner-corner`, its corner less its border
 * and padding, for parts that round with `rounded-inner`. A root holding an `Attachment.Trigger`
 * takes a hover fill.
 */
export function AttachmentRoot({
  className,
  state = "done",
  size = "default",
  orientation = "horizontal",
  ...props
}: AttachmentRootProps): ReactElement {
  const inGroup = useContext(AttachmentGroupContext);
  return (
    <AttachmentOrientationContext.Provider value={orientation}>
      <div
        data-slot="attachment"
        data-state={state}
        data-size={size}
        data-orientation={orientation}
        {...definedProps({ role: inGroup ? "listitem" : undefined })}
        className={cn(attachmentVariants({ size, orientation }).root(), className)}
        {...props}
      />
    </AttachmentOrientationContext.Provider>
  );
}

/** `Attachment.Group` takes Base UI ScrollArea Root's props; its accessible name goes on the list. */
export type AttachmentGroupProps = ComponentProps<typeof ScrollAreaPrimitive.Root>;

/**
 * A horizontally scrolling list of attachments. Name it with `aria-label` or `aria-labelledby`,
 * which land on the list; each `Attachment.Root` inside is one of its items. Scrolling snaps to
 * each attachment, and an edge fades while more attachments lie past it, on the side right-to-left
 * text starts from too. Base UI measures those edges from its `DirectionProvider`, so a
 * right-to-left app wraps itself in one besides setting `dir`. The scrollbar shows on hover, and
 * the scrolling viewport takes keyboard focus while it overflows.
 */
export function AttachmentGroup({
  className,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: AttachmentGroupProps): ReactElement {
  return (
    <AttachmentGroupContext.Provider value>
      <ScrollAreaPrimitive.Root
        data-slot="attachment-group"
        className={mergeClassName(className, styles.group())}
        {...props}>
        <ScrollAreaPrimitive.Viewport
          data-slot="attachment-group-viewport"
          data-focus-ring-control=""
          className={styles.groupViewport()}>
          <ScrollAreaPrimitive.Content
            data-slot="attachment-group-list"
            role="list"
            {...definedProps({ "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy })}
            className={styles.groupList()}>
            {children}
          </ScrollAreaPrimitive.Content>
        </ScrollAreaPrimitive.Viewport>
        <ScrollAreaBar orientation="horizontal" />
      </ScrollAreaPrimitive.Root>
    </AttachmentGroupContext.Provider>
  );
}

AttachmentRoot.displayName = "Attachment.Root";
AttachmentGroup.displayName = "Attachment.Group";
