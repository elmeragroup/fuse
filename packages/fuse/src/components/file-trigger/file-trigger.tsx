"use client";

import type { ReactElement, ReactNode, Ref } from "react";

import type { useRender } from "@base-ui/react/use-render";

import { Camera } from "../../icons/generated/camera";
import { Folder } from "../../icons/generated/folder";
import { Paperclip } from "../../icons/generated/paperclip";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { Button } from "../button/button";
import type { LabelButtonProps, LabelButtonSize } from "../button/button";
import { FileUploadRoot } from "../file-upload/file-upload";
import type { FileUploadRootProps } from "../file-upload/file-upload";
import { FileUploadTrigger } from "../file-upload/file-upload-trigger";

/**
 * `FileTrigger` takes FileUpload's picker props (`accept`, `multiple`, `directory`, `capture`,
 * `disabled`, `onSelect`, `onReject`), the Button look (`variant`, `size`), `withIcon`, and a
 * `button`'s props, which land on the visible button.
 */
export type FileTriggerProps = Omit<
  useRender.ComponentProps<"button">,
  "render" | "ref" | "disabled" | "onSelect" | "type"
> &
  Pick<LabelButtonProps, "variant"> & {
    /**
     * The `accept` attribute's syntax, such as `"image/*,.pdf"`. The picker receives it as-is, and
     * a picked file that fails it reaches `onReject` with `"type"`.
     */
    accept?: FileUploadRootProps["accept"];
    /**
     * Take more than one file. Without it, a pick in which more than one file passes `accept`
     * rejects each of those with `"count"`. `accept` is checked first, so a file that fails it is
     * rejected with `"type"` and never counts.
     */
    multiple?: FileUploadRootProps["multiple"];
    /** The picker selects a folder, and `onSelect` receives its files. */
    directory?: FileUploadRootProps["directory"];
    /** Ask a phone to capture new media with the front (`"user"`) or back (`"environment"`) camera. */
    capture?: FileUploadRootProps["capture"];
    /** Disable the button and ignore picks. */
    disabled?: FileUploadRootProps["disabled"];
    /** Receives the files that passed `accept` and the count rule, in a fresh array for each pick. */
    onSelect?: FileUploadRootProps["onSelect"];
    /**
     * Receives the files that did not pass, each with its `reason`. For one pick it runs right
     * after `onSelect`, in the same task.
     */
    onReject?: FileUploadRootProps["onReject"];
    /** The Button's label size: `xs`, `sm` (the default), `default` or `lg`. */
    size?: LabelButtonSize;
    /**
     * Leading icon on/off. Defaults to on: a camera with `capture`, a folder with `directory`, a
     * paperclip otherwise. It is decorative, so the children name the button.
     */
    withIcon?: boolean;
    /** The visible button. */
    ref?: Ref<HTMLButtonElement>;
  };

/**
 * The Root's render: its children alone, with no element around them. The button and the hidden
 * input then sit in the surrounding element, so a parent that styles its direct children, such as
 * `ButtonGroup` joining borders and corners, styles the button itself. `display: contents` would
 * not do: it hides a wrapper from layout, but child selectors still see the wrapper. With no
 * element, the Root registers nothing on the DOM, so FileTrigger takes no paste and installs no
 * document drop guard, both of which FileUpload ties to the area its Root element covers.
 */
function childrenOnly(props: { children?: ReactNode }): ReactElement {
  return <>{props.children}</>;
}

/**
 * A Fuse Button that opens the file picker: a `FileUpload.Root` with only a Trigger, so a pick
 * runs the same `accept` and count check as FileUpload. `onSelect` receives the files that pass,
 * in a new array for each pick, and `onReject` the rest, each with its `reason`. It renders no
 * wrapper: the button and its hidden input are children of the surrounding element.
 * Client — the Root owns the hidden input and the callbacks.
 */
export function FileTrigger({
  accept,
  multiple,
  directory,
  capture,
  disabled,
  onSelect,
  onReject,
  withIcon = true,
  variant = "default",
  size = "sm",
  className,
  children,
  ...props
}: FileTriggerProps): ReactElement {
  return (
    <FileUploadRoot
      render={childrenOnly}
      {...definedProps({ accept, multiple, directory, capture, disabled, onSelect, onReject })}>
      <FileUploadTrigger
        render={<Button variant={variant} size={size} />}
        className={cn(withIcon && "gap-x-2", className)}
        {...props}>
        {withIcon ? (
          capture ? (
            <Camera aria-hidden />
          ) : directory ? (
            <Folder aria-hidden />
          ) : (
            <Paperclip aria-hidden />
          )
        ) : null}
        {children}
      </FileUploadTrigger>
    </FileUploadRoot>
  );
}

FileTrigger.displayName = "FileTrigger";
