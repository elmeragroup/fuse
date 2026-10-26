"use client";

import { useEffect, useId, useState } from "react";
import type { DragEvent, MouseEvent, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { isNode } from "../../internal/dom-node";
import { pressesRegion } from "../../internal/own-click";
import { cn } from "../../styles/cn";
import { dragVerdict, isFileDrag } from "./drag-verdict";
import { useFileUploadContext } from "./file-upload-context";
import { fileUploadVariants } from "./file-upload-variants";
import { read } from "./read-files";

const styles = fileUploadVariants();

/** `FileUpload.Dropzone` takes a `div`'s props plus Base UI's `render`. */
export type FileUploadDropzoneProps = useRender.ComponentProps<"div">;

/**
 * Whether an event happened in the zone's DOM. React bubbles events from portalled content, such
 * as a dialog opened from inside the zone, through the zone, though their DOM sits elsewhere.
 */
function inZone(target: EventTarget | null, zone: Element): target is Node {
  return isNode(target) && zone.contains(target);
}

/** `data-drop-target` while a drag that could drop is over the zone, and `data-disabled`. */
const stateAttributesMapping = {
  dropTarget: (value: boolean) => (value ? { "data-drop-target": "" } : null),
};

/**
 * The area files drop on. It writes `data-drop-target` while a file drag
 * that could pass is over it, and the drag shows the not-allowed cursor when the drop is certain
 * to be rejected: more than one file of a known type that passes `accept` on a single-file Root,
 * or known types that all miss `accept`.
 * A click on its empty surface opens the picker. That path is pointer only, so keep a
 * `FileUpload.Trigger` inside for the keyboard. That click leaves with `defaultPrevented` set,
 * so an enclosing Dropzone or pressable `DataTable` row skips it, and it still bubbles to
 * document listeners. While the Root is disabled it writes `data-disabled` and leaves every
 * drag to the document, which keeps a dropped file from opening in the tab.
 */
export function FileUploadDropzone({ className, render, ...props }: FileUploadDropzoneProps): ReactElement {
  const { state, actions, meta } = useFileUploadContext("FileUpload.Dropzone");
  const zoneId = useId();
  const { setDropTarget } = meta;
  // WebKit fires `dragleave` with no `relatedTarget`, so the zone tracks every element a drag
  // entered and is left only when that set empties.
  const [entered] = useState(() => new Set<EventTarget>());
  // Disabling ends the drag, and so does unmounting, which never sees its `dragleave`.
  useEffect(() => {
    if (state.disabled) {
      entered.clear();
    }
  }, [entered, state.disabled]);
  useEffect(
    () => () => {
      entered.clear();
      setDropTarget(zoneId, false);
    },
    [entered, setDropTarget, zoneId]
  );

  // A drag over portalled content is left alone, so the document guard still answers it.
  const onDragEnterOrOver = (event: DragEvent<HTMLDivElement>) => {
    if (state.disabled || !inZone(event.target, event.currentTarget) || !isFileDrag(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const verdict = dragVerdict(event.dataTransfer.items, meta.rules);
    event.dataTransfer.dropEffect = verdict === "reject" ? "none" : "copy";
    if (event.type === "dragenter") {
      entered.add(event.target);
    }
    setDropTarget(zoneId, verdict !== "reject");
  };

  // A drag ends in `dragleave` or `drop`. Both clear the zone's tracking even while the Root is
  // disabled, so a drag that began while it was enabled never comes back on re-enable.
  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!inZone(event.target, event.currentTarget) || !isFileDrag(event.dataTransfer)) {
      return;
    }
    const zone = event.currentTarget;
    entered.delete(event.target);
    // Leaving the zone itself also drops targets the zone no longer holds, which never fire
    // their own `dragleave`.
    if (event.target === zone) {
      for (const target of entered) {
        if (!isNode(target) || !zone.contains(target)) {
          entered.delete(target);
        }
      }
    }
    if (entered.size === 0) {
      setDropTarget(zoneId, false);
    }
    if (!state.disabled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!inZone(event.target, event.currentTarget) || !isFileDrag(event.dataTransfer)) {
      return;
    }
    entered.clear();
    setDropTarget(zoneId, false);
    // A disabled zone lets the drop reach the document guard, which keeps the file from opening.
    if (state.disabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    // The browser empties the `DataTransfer` once the event ends, so the items are read now.
    meta.receive(read(event.dataTransfer));
  };

  // The click that opens the picker is marked handled, so an enclosing Dropzone or pressable row
  // skips it. It still bubbles, so the consumer's document listeners see it.
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!event.defaultPrevented && !state.disabled && pressesRegion(event.target, event.currentTarget)) {
      event.preventDefault();
      actions.open();
    }
  };

  return useRender({
    defaultTagName: "div",
    render,
    state: { dropTarget: meta.dropTargets.has(zoneId), disabled: state.disabled },
    stateAttributesMapping,
    props: {
      "data-slot": "file-upload-dropzone",
      ...mergeProps<"div">(
        {
          className: cn(styles.dropzone(), className),
          onDragEnter: onDragEnterOrOver,
          onDragOver: onDragEnterOrOver,
          onDragLeave,
          onDrop,
          onClick,
        },
        props
      ),
    },
  });
}

FileUploadDropzone.displayName = "FileUpload.Dropzone";
