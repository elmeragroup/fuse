"use client";

import type { ReactElement } from "react";

import { definedProps } from "../../internal/defined-props";
import { Button } from "../button/button";
import type { IconButtonProps, IconButtonSize } from "../button/button";
import { useAttachmentOrientation } from "./attachment";

/** `Attachment.Action` takes an icon `Button`'s props, with `size` optional. */
export type AttachmentActionProps = Omit<IconButtonProps, "size"> & {
  /** One of Button's icon sizes. Defaults to `icon-xs`, a 24px target when dense. */
  size?: IconButtonSize;
};

/**
 * An icon button for one action on the attachment, such as remove, retry or download. Name it
 * with `aria-label`, such as "Remove report.pdf". It defaults to `size="icon-xs"`, and to the
 * `secondary` variant on a vertical tile, so its icon stays visible on any photo, or `ghost` in a
 * row. A `variant` you pass wins. Every other prop goes to `Button`.
 */
export function AttachmentAction({
  variant,
  size = "icon-xs",
  "aria-label": ariaLabel,
  ...props
}: AttachmentActionProps): ReactElement {
  const orientation = useAttachmentOrientation();
  return (
    <Button
      data-slot="attachment-action"
      variant={variant ?? (orientation === "vertical" ? "secondary" : "ghost")}
      size={size}
      aria-label={ariaLabel}
      {...definedProps(props)}
    />
  );
}

AttachmentAction.displayName = "Attachment.Action";
