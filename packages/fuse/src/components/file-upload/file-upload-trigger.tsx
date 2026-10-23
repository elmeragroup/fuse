"use client";

import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { selfFocusRingClass } from "../../styles/utils";
import { useFileUploadContext } from "./file-upload-context";

/** `FileUpload.Trigger` takes a `button`'s props plus Base UI's `render`. */
export type FileUploadTriggerProps = useRender.ComponentProps<"button">;

/**
 * The button that opens the picker, and the keyboard path to it. It renders
 * `<button type="button">` with the shared focus ring; `render={<Button size="sm" />}` gives it
 * the Fuse button look. It is disabled while the Root is disabled or its own `disabled` is set.
 * Each mounted `FileUpload.Description` describes it, after the ids in its own `aria-describedby`.
 */
export function FileUploadTrigger({
  className,
  render,
  disabled,
  "aria-describedby": ownDescribedBy,
  ...props
}: FileUploadTriggerProps): ReactElement {
  const { state, actions, meta } = useFileUploadContext("FileUpload.Trigger");
  const isDisabled = state.disabled || disabled === true;
  const describedBy = [ownDescribedBy, ...meta.descriptionIds].filter(Boolean).join(" ");
  return useRender({
    defaultTagName: "button",
    render,
    props: {
      "data-slot": "file-upload-trigger",
      // `type="button"` is a default here, because Base UI gives it only to its fallback tag, and
      // a `render={<button />}` Trigger in a form would submit it. The consumer's props are
      // filtered, as Attachment.Trigger filters, so a forwarded `type={undefined}` cannot erase
      // that default, nor `undefined` the description wiring. An explicit `type` still wins.
      ...mergeProps<"button">(
        {
          type: "button",
          className: cn(selfFocusRingClass, className),
          onClick: () => {
            if (!isDisabled) {
              actions.open();
            }
          },
        },
        definedProps({ ...props, disabled: isDisabled, "aria-describedby": describedBy || undefined })
      ),
    },
  });
}

FileUploadTrigger.displayName = "FileUpload.Trigger";
