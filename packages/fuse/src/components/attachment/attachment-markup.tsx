import type { ComponentProps, ReactElement } from "react";

import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { AspectRatio } from "../aspect-ratio/aspect-ratio";
import type { AspectRatioProps } from "../aspect-ratio/aspect-ratio";
import { attachmentVariants } from "./attachment-variants";

const styles = attachmentVariants();

/** `Attachment.Media` takes a native `div`'s props plus its `variant`. */
export type AttachmentMediaProps = ComponentProps<"div"> &
  Pick<VariantProps<typeof attachmentVariants>, "variant">;

/**
 * The file's leading square: an icon or a status glyph such as a Loader with `variant="icon"`,
 * a picture with `variant="image"`. It rounds concentric with the root and takes the error tint
 * when the root's `state` is `error`. Image media stays at 60% opacity until the state is `idle`
 * or `done`, and an `img` directly inside it fills the square. An `Attachment.AspectRatio` inside
 * it replaces the square with that ratio. On a vertical tile it spans the tile's width.
 */
export function AttachmentMedia({
  className,
  variant = "icon",
  ...props
}: AttachmentMediaProps): ReactElement {
  return (
    <div
      data-slot="attachment-media"
      data-variant={variant}
      className={cn(attachmentVariants({ variant }).media(), className)}
      {...props}
    />
  );
}

/** `Attachment.AspectRatio` takes `AspectRatio`'s props. */
export type AttachmentAspectRatioProps = AspectRatioProps;

/**
 * `AspectRatio` for an `Attachment.Media`, which then takes its ratio instead of the square. It
 * spans the media's width.
 */
export function AttachmentAspectRatio({ className, ...props }: AttachmentAspectRatioProps): ReactElement {
  return (
    <AspectRatio
      data-slot="attachment-aspect-ratio"
      className={cn(styles.aspectRatio(), className)}
      {...props}
    />
  );
}

/** Holds `Attachment.Title` and `Attachment.Description`, and takes the room the media leaves. */
export function AttachmentContent({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="attachment-content" className={cn(styles.content(), className)} {...props} />;
}

/**
 * The file name on one truncated line. While the root's `state` is `uploading` or `processing`
 * a highlight sweeps across it; under reduced motion it stays solid text.
 */
export function AttachmentTitle({ className, ...props }: ComponentProps<"span">): ReactElement {
  return <span data-slot="attachment-title" className={cn(styles.title(), className)} {...props} />;
}

/**
 * One truncated line of muted detail, such as the size, the progress or the reason an upload
 * failed. It carries the readable status: the root's `state` only styles, so write the state
 * here in words. It takes the error tint when the state is `error`.
 */
export function AttachmentDescription({ className, ...props }: ComponentProps<"span">): ReactElement {
  return (
    <span data-slot="attachment-description" className={cn(styles.description(), className)} {...props} />
  );
}

/**
 * The attachment's `Attachment.Action` buttons. They stack above an `Attachment.Trigger`, so a
 * click on one never reaches the trigger. On a vertical tile they float inside the media's top
 * end corner, which is its top left in right-to-left text. The tile is wide enough for two
 * default-size actions to cover at most half of its media at both densities.
 */
export function AttachmentActions({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="attachment-actions" className={cn(styles.actions(), className)} {...props} />;
}

AttachmentMedia.displayName = "Attachment.Media";
AttachmentAspectRatio.displayName = "Attachment.AspectRatio";
AttachmentContent.displayName = "Attachment.Content";
AttachmentTitle.displayName = "Attachment.Title";
AttachmentDescription.displayName = "Attachment.Description";
AttachmentActions.displayName = "Attachment.Actions";
