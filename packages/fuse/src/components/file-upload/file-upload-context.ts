"use client";

import { createContext, use, useMemo } from "react";

import type { ReadEntry } from "./read-files";
import type { FileRules } from "./split-files";

/** What a FileUpload shows: whether a file drag is over a Dropzone, and whether it takes files. */
export type FileUploadState = {
  /** A file drag that could drop here is over a `FileUpload.Dropzone`. */
  readonly dragging: boolean;
  /** The Root is disabled, so every source is ignored. */
  readonly disabled: boolean;
};

/** What a part or a custom child can do. Both do nothing while the Root is disabled. */
export type FileUploadActions = {
  /** Open the file picker. Browsers open it only inside a user gesture, such as a click. */
  readonly open: () => void;
  /** Run `files` through the Root's `accept` and count rules, as a pick does. */
  readonly add: (files: File[]) => void;
};

/** The wiring the parts share. Private to the parts. */
export type FileUploadMeta = {
  /** The ids of the mounted Descriptions, in the order they mounted. */
  readonly descriptionIds: readonly string[];
  /** Track a mounted Description's id. The returned function stops tracking it. */
  readonly registerDescription: (id: string) => () => void;
  /** The Dropzones, by id, that show a drop target now. `state.dragging` is whether any does. */
  readonly dropTargets: ReadonlySet<string>;
  /** Mark the Dropzone `zone` as showing a drop target, or as no longer showing one. */
  readonly setDropTarget: (zone: string, shown: boolean) => void;
  /**
   * Expand the folders of a drop or paste under the Root's `directory`, then run the result
   * through the split and the Root's callbacks. It ignores a result that resolves after the Root
   * unmounts.
   */
  readonly receive: (entries: readonly ReadEntry[]) => void;
  /** The Root's parsed `accept` and `multiple`, which a drag's verdict judges by. */
  readonly rules: FileRules;
};

/** The Root's context: what it shows, what it does, and the wiring the parts read. */
export type FileUploadContextValue = {
  readonly state: FileUploadState;
  readonly actions: FileUploadActions;
  readonly meta: FileUploadMeta;
};

/** The Root's context. `FileUpload.Root` provides it. */
export const FileUploadContext = createContext<FileUploadContextValue | null>(null);

/**
 * The enclosing Root's context, for a part.
 *
 * @param part - The part's name, such as `FileUpload.Trigger`, for the error message.
 * @returns The context value.
 * @throws When no `FileUpload.Root` encloses the caller, which is a defect in the tree.
 */
export function useFileUploadContext(part: string): FileUploadContextValue {
  const context = use(FileUploadContext);
  if (context === null) {
    throw new Error(`${part} must be used within FileUpload.Root.`);
  }
  return context;
}

/**
 * The enclosing `FileUpload.Root`'s state and actions, for a custom child such as a button that
 * adds files from another source. The result keeps its identity until the state changes.
 *
 * @returns `state.dragging` and `state.disabled`, and the `open` and `add` actions.
 * @throws When no `FileUpload.Root` encloses the caller.
 */
export function useFileUpload(): { readonly state: FileUploadState; readonly actions: FileUploadActions } {
  const { state, actions } = useFileUploadContext("useFileUpload");
  return useMemo(() => ({ state, actions }), [state, actions]);
}
