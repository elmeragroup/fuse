"use client";

import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { ariaDisabledGuard } from "../../internal/aria-disabled-guard";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { attachmentVariants } from "./attachment-variants";

const styles = attachmentVariants();

type AttachmentTriggerBaseProps = useRender.ComponentProps<"button">;

/** `Attachment.Trigger` takes a `button`'s props plus Base UI's `render`. */
export type AttachmentTriggerProps = Omit<AttachmentTriggerBaseProps, "render" | "aria-label"> & {
  /**
   * The element to render, a `<button type="button">` by default, so it never submits a form it
   * sits in. `render={<a href="…" />}` makes it a link. A link takes no `disabled`, so mark an
   * unavailable one `aria-disabled="true"`, and it cancels its own activation. A dialog's trigger
   * composes it as it composes `Button`:
   * `<Dialog.Trigger render={<Attachment.Trigger aria-label="Preview report.pdf" />} />`.
   */
  render?: AttachmentTriggerBaseProps["render"];
  /**
   * The trigger's name, which says what activating it does, such as "Preview
   * inspection-report.pdf". Give it one, since it holds no text of its own.
   */
  "aria-label"?: AttachmentTriggerBaseProps["aria-label"];
};

/**
 * The attachment's primary action as one control over the whole root, under its
 * `Attachment.Actions`, so a click on an action never reaches it. Place it before
 * `Attachment.Actions`, so it comes first in tab order. It is a client component because
 * `useRender` makes it polymorphic.
 */
export function AttachmentTrigger({ className, render, ...props }: AttachmentTriggerProps): ReactElement {
  return useRender({
    defaultTagName: "button",
    props: {
      "data-slot": "attachment-trigger",
      // Filtered, as Button filters, so a forwarded `type={undefined}` cannot erase the default
      // button's `type="button"`.
      ...mergeProps<"button">(
        { className: cn(styles.trigger(), className) },
        definedProps(props),
        ariaDisabledGuard
      ),
    },
    render,
  });
}

AttachmentTrigger.displayName = "Attachment.Trigger";
