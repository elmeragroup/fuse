"use client";

import { useLayoutEffect, useState } from "react";
import type { ReactElement } from "react";

import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { useLabelableContext, useLabelableId } from "@base-ui/react/internals/labelable-provider";
import { NOOP } from "@base-ui/react/internals/noop";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { definedProps } from "../../internal/defined-props";
import { isHTMLElement } from "../../internal/dom-node";
import { cn } from "../../styles/cn";
import { ariaStateFaceClass } from "../../styles/state-face";
import { selfFocusRingClass } from "../../styles/utils";
import { useFileUploadContext } from "./file-upload-context";
import { useFileUploadTriggerFocus } from "./file-upload-field";

type FileUploadTriggerBaseProps = useRender.ComponentProps<"button">;

/** `FileUpload.Trigger` takes a `button`'s props plus Base UI's `render`. */
export type FileUploadTriggerProps = Omit<
  FileUploadTriggerBaseProps,
  "render" | "id" | "aria-describedby" | "aria-invalid" | "children"
> & {
  /**
   * The element to render, a `<button type="button">` with the shared focus ring by default.
   * Pass `render={<Button size="sm" />}` for the Fuse button look.
   */
  render?: FileUploadTriggerBaseProps["render"];
  /**
   * The button's label, which names it. Keep a Trigger in every FileUpload: a Dropzone's drop and
   * click work by pointer only, and the Trigger is the keyboard path to the picker. Inside a
   * `Field.Root`, render one Trigger; the Field's label, description and error belong to it.
   * `Field.Label` points at it, so a click on the label opens the picker, and the label follows
   * the Trigger's own text in its name, as in "Choose file Meter photo". Its own
   * `aria-labelledby` replaces that name.
   */
  children?: FileUploadTriggerBaseProps["children"];
  /**
   * The button's id. Inside a `Field.Root`, set it here and not on the `render` element, which
   * the label does not follow.
   */
  id?: FileUploadTriggerBaseProps["id"];
  /**
   * The ids that describe the button. They come first, then, inside a `Field.Root`, the Field's
   * `Field.Description` and `Field.Error` in the Field's order, then each mounted
   * `FileUpload.Description`.
   */
  "aria-describedby"?: FileUploadTriggerBaseProps["aria-describedby"];
  /**
   * Marks the button invalid. Unset, an invalid Field marks it `aria-invalid` while it is
   * enabled. While it is set, the Trigger paints the shared invalid border and ring, the one
   * invalid face of the FileUpload, so an enclosing `FileUpload.Dropzone` keeps its dashed
   * border.
   */
  "aria-invalid"?: FileUploadTriggerBaseProps["aria-invalid"];
};

/** The ids, deduplicated in first-seen order and space-joined, or `undefined` when there are none. */
function idList(...lists: readonly (string | undefined)[]): string | undefined {
  const ids = new Set(lists.flatMap((list) => list?.split(" ") ?? []).filter((id) => id !== ""));
  return ids.size === 0 ? undefined : [...ids].join(" ");
}

/**
 * The button that opens the picker. It is disabled while the Root is disabled or its own
 * `disabled` is set. Inside a `Field.Root`, it is the Field's control, as `Select.Trigger` is,
 * and it is named by its own text and then the label, as `DatePicker.Trigger` is, so the visible
 * text stays in the name.
 *
 * As on `Select.Trigger`, a blur of the Trigger marks the Field touched and, in the Field's
 * `onBlur` mode, validates it, and a change of `files` validates again as the `validationMode`
 * says. The window blur that opening the picker causes is no blur of the Trigger, so it validates
 * nothing. The Root's `required` documents the rest of the Field validation.
 */
export function FileUploadTrigger({
  className,
  render,
  disabled,
  id: ownId,
  "aria-labelledby": ownLabelledBy,
  "aria-describedby": ownDescribedBy,
  "aria-invalid": ownInvalid,
  ...props
}: FileUploadTriggerProps): ReactElement {
  const { state, actions, meta } = useFileUploadContext("FileUpload.Trigger");
  const field = useFieldRootContext();
  const labelable = useLabelableContext();
  // Base UI's convention for "no Field here": its default Field context has a NOOP
  // `setValidityData`. The labelable context is no witness, because SkeletonReveal provides its
  // own outside any Field. Outside a Field the Trigger writes no id, label or invalid state.
  const inField = field.setValidityData !== NOOP;
  // As on Base UI's Select.Trigger: the Field's control id until the labelable registers the
  // Trigger's own `id` after mount, so server markup keeps the label paired with the Trigger.
  const controlId = useLabelableId({ id: ownId, enabled: inField });
  const id = inField ? controlId : ownId;
  const { registerTrigger, registerFieldTrigger, triggerLeft } = meta;
  const [element, setElement] = useState<Element | null>(null);
  useLayoutEffect(
    () => (isHTMLElement(element) ? registerTrigger(element) : undefined),
    [element, registerTrigger]
  );
  useLayoutEffect(() => (inField ? registerFieldTrigger() : undefined), [inField, registerFieldTrigger]);
  const isDisabled = state.disabled || disabled === true;
  const { onFocus, onBlur } = useFileUploadTriggerFocus({
    disabled: isDisabled,
    trigger: element,
    left: triggerLeft,
  });
  const labelledBy =
    ownLabelledBy ??
    (inField && labelable.labelId !== undefined && id !== undefined
      ? `${id} ${labelable.labelId}`
      : undefined);
  const describedBy = idList(
    labelable.getDescriptionProps({ "aria-describedby": ownDescribedBy })["aria-describedby"],
    ...meta.descriptionIds
  );
  return useRender({
    defaultTagName: "button",
    render,
    ref: setElement,
    props: {
      "data-slot": "file-upload-trigger",
      // `type="button"` is a default here, because Base UI gives it only to its fallback tag, and
      // a `render={<button />}` Trigger in a form would submit it. The consumer's props are
      // filtered, as Attachment.Trigger filters, so a forwarded `type={undefined}` cannot erase
      // that default, nor `undefined` the Field and description wiring. An explicit `type` still wins.
      ...mergeProps<"button">(
        {
          type: "button",
          // The Field's control paints the one invalid face, from its own `aria-invalid`. A
          // within-target face on the Dropzone cannot reset a Button Trigger's own border.
          className: cn(selfFocusRingClass, ariaStateFaceClass, className),
          onClick: () => {
            if (!isDisabled) {
              actions.open();
            }
          },
          onFocus,
          onBlur,
        },
        definedProps({
          ...props,
          id,
          disabled: isDisabled,
          "aria-labelledby": labelledBy,
          "aria-describedby": describedBy,
          "aria-invalid": ownInvalid ?? (field.state.valid === false && !isDisabled ? true : undefined),
        })
      ),
    },
  });
}

FileUploadTrigger.displayName = "FileUpload.Trigger";
