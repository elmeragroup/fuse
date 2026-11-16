"use client";

import type { ReactElement, ReactNode, Ref } from "react";

import type { useRender } from "@base-ui/react/use-render";

import { Camera } from "../../icons/generated/camera";
import { Folder } from "../../icons/generated/folder";
import { Paperclip } from "../../icons/generated/paperclip";
import { definedProps } from "../../internal/defined-props";
import { Button } from "../button/button";
import type { LabelButtonProps, LabelButtonSize } from "../button/button";
import { FileUploadRoot } from "../file-upload/file-upload";
import type { FileUploadRootProps } from "../file-upload/file-upload";
import { FileUploadTrigger } from "../file-upload/file-upload-trigger";

/**
 * Props for `FileTrigger`. It takes the picker props of `FileUpload`, which are `accept`,
 * `multiple`, `directory`, `capture`, `disabled`, `onSelect` and `onReject`. It also takes the
 * `variant` and `size` of `Button`, `withIcon`, and the props of a `button` element, which go to
 * the visible button.
 */
export type FileTriggerProps = Omit<
  useRender.ComponentProps<"button">,
  "render" | "ref" | "disabled" | "onSelect" | "type" | "children"
> &
  Pick<LabelButtonProps, "variant"> &
  Pick<FileUploadRootProps, "capture"> & {
    /**
     * The file types to take, in the `accept` attribute's syntax, such as `"image/*,.pdf"`. The
     * picker receives it as it is, and a picked file that fails it reaches `onReject` with
     * `"type"`.
     */
    accept?: FileUploadRootProps["accept"];
    /**
     * Whether the picker takes more than one file. Without it, a pick in which more than one file
     * passes `accept` rejects each of those with `"count"`. The trigger checks `accept` first, so
     * it rejects a file that fails `accept` with `"type"`, and that file never counts.
     */
    multiple?: FileUploadRootProps["multiple"];
    /** Whether the picker selects a folder. `onSelect` then receives its files. */
    directory?: FileUploadRootProps["directory"];
    /** Whether the button is disabled. A disabled trigger ignores picks. */
    disabled?: FileUploadRootProps["disabled"];
    /**
     * Called when a pick has files that pass `accept` and the count rule, with those files in a
     * fresh array. A pick in which no file passes does not call it.
     */
    onSelect?: FileUploadRootProps["onSelect"];
    /**
     * Called when a pick has files that did not pass, with each file and its `reason`. A pick in
     * which every file fails calls it without `onSelect`. When both run for one pick, `onSelect`
     * runs first and this runs right after, in the same task.
     */
    onReject?: FileUploadRootProps["onReject"];
    /** The button's size, as on `Button`. */
    size?: LabelButtonSize;
    /**
     * Whether the button shows the leading icon: a camera with `capture`, a folder with `directory`
     * and a paperclip otherwise. The icon is decorative, so the children name the button.
     */
    withIcon?: boolean;
    /**
     * The button's label, which names it. The trigger renders the button and a hidden file input
     * with no element around them, so it joins a `ButtonGroup` as a `Button` does.
     */
    children?: useRender.ComponentProps<"button">["children"];
    /** Ref to the visible button. */
    ref?: Ref<HTMLButtonElement>;
  };

/**
 * The Root's render: its children alone, with no element around them. The button and the hidden
 * input then sit in the surrounding element, so a parent that styles its direct children, such as
 * `ButtonGroup` joining borders and corners, styles the button itself. `display: contents` would
 * not work. It hides a wrapper from layout, but child selectors still see the wrapper. With no
 * element, the Root registers nothing on the DOM, so FileTrigger takes no paste and installs no
 * document drop guard. FileUpload ties both to the area its Root element covers.
 */
function childrenOnly(props: { children?: ReactNode }): ReactElement {
  return <>{props.children}</>;
}

/**
 * A Fuse `Button` that opens the file picker. It is a `FileUpload.Root` with only a Trigger, so a
 * pick runs the same `accept` and count check as `FileUpload`. `onSelect` receives the files that
 * pass, in a new array for each pick, and `onReject` receives the rest, each with its `reason`. It
 * renders no wrapper, so the button and its hidden input are children of the surrounding element.
 * It is a client component, because the Root renders the hidden input and runs the callbacks.
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
  children,
  ...props
}: FileTriggerProps): ReactElement {
  const Icon = capture ? Camera : directory ? Folder : Paperclip;
  return (
    <FileUploadRoot
      render={childrenOnly}
      {...definedProps({ accept, multiple, directory, capture, disabled, onSelect, onReject })}>
      <FileUploadTrigger
        render={<Button variant={variant} size={size} />}
        data-slot="file-trigger"
        {...props}>
        {withIcon ? <Icon data-icon="inline-start" aria-hidden /> : null}
        {children}
      </FileUploadTrigger>
    </FileUploadRoot>
  );
}

FileTrigger.displayName = "FileTrigger";
