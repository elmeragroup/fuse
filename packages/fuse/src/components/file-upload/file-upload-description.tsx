"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { useFileUploadContext } from "./file-upload-context";
import { fileUploadVariants } from "./file-upload-variants";

const styles = fileUploadVariants();

/** `FileUpload.Description` takes a `p`'s props plus Base UI's `render`. */
export type FileUploadDescriptionProps = useRender.ComponentProps<"p">;

/**
 * A hint about what the FileUpload takes, such as "Up to 3 files, 10 MB each". While it is
 * mounted, it describes every `FileUpload.Trigger` in the Root, by the id its element ends up
 * with: the consumer's `id`, one from a `render` element, or a generated one.
 */
export function FileUploadDescription({
  className,
  render,
  ref,
  ...props
}: FileUploadDescriptionProps): ReactElement {
  const { meta } = useFileUploadContext("FileUpload.Description");
  const generatedId = useId();
  const { registerDescription } = meta;
  // A `render` element can bring its own `id`, so the Trigger points at the committed element's
  // id. Each commit reads it, and the registration changes only when that id does. It never
  // follows `render`'s identity: a parent that reads `useFileUpload()` passes a new element on
  // every render, and re-registering would loop through the Root's context.
  const [element, setElement] = useState<HTMLParagraphElement | null>(null);
  const mergedRef = useMergedRefs<HTMLParagraphElement>(ref, setElement);
  const registration = useRef<{ readonly id: string; readonly release: () => void } | null>(null);
  useLayoutEffect(() => {
    const id = element?.id ?? "";
    if (registration.current?.id === id) {
      return;
    }
    registration.current?.release();
    registration.current = id === "" ? null : { id, release: registerDescription(id) };
  });
  useLayoutEffect(
    () => () => {
      registration.current?.release();
      registration.current = null;
    },
    []
  );
  return useRender({
    defaultTagName: "p",
    render,
    ref: mergedRef,
    props: {
      "data-slot": "file-upload-description",
      ...mergeProps<"p">(
        { id: generatedId, className: cn(styles.description(), className) },
        definedProps(props)
      ),
    },
  });
}

FileUploadDescription.displayName = "FileUpload.Description";
