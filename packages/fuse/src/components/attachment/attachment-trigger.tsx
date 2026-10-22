"use client";

import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { ariaDisabledGuard } from "../../internal/aria-disabled-guard";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { attachmentVariants } from "./attachment-variants";

const styles = attachmentVariants();

/** `Attachment.Trigger` takes a `button`'s props plus Base UI's `render`. */
export type AttachmentTriggerProps = useRender.ComponentProps<"button">;

/**
 * The attachment's primary action as one control over the whole root, under its
 * `Attachment.Actions`. It renders `<button type="button">`, so it never submits a form it sits
 * in. Give it an `aria-label`, such as "Preview report.pdf", since it holds no text of its own.
 * `render={<a href="…" />}` makes it a link. A trigger composes it as it composes `Button`:
 * `<Dialog.Trigger render={<Attachment.Trigger aria-label="Preview report.pdf" />} />`. Place it
 * before `Attachment.Actions`, so it comes first in tab order. A link takes no `disabled`, so mark
 * an unavailable one `aria-disabled="true"`: it then cancels its own activation. Client only
 * because polymorphism is `useRender`.
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
