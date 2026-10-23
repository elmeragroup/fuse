"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { deepActiveElement } from "../../internal/active-element";
import { isFocusRoot } from "../../internal/dom-node";
import { isTextEntry } from "../../internal/text-entry";
import { cn } from "../../styles/cn";
import * as Accept from "./accept";
import { registerDocumentDropGuard } from "./document-drop-guard";
import { FileUploadContext } from "./file-upload-context";
import type { FileUploadActions, FileUploadContextValue, FileUploadState } from "./file-upload-context";
import { fileUploadVariants } from "./file-upload-variants";
import { expand, read } from "./read-files";
import type { ReadEntry } from "./read-files";
import { split } from "./split-files";
import type { FileRejection, FileRules, SplitEntry } from "./split-files";

/** `FileUpload.Root` takes a `div`'s props, Base UI's `render`, and the picker and callback props. */
export type FileUploadRootProps = Omit<useRender.ComponentProps<"div">, "onSelect"> & {
  /**
   * The `accept` attribute's syntax, such as `"image/*,.pdf"`. The picker receives it as-is, and
   * every source enforces it: a file that fails it reaches `onReject` with `"type"`.
   */
  accept?: string;
  /** Take more than one file. Without it, a pick, drop or paste of several files rejects them all with `"count"`. */
  multiple?: boolean;
  /** The picker selects folders, and dropped folders expand into their files. */
  directory?: boolean;
  /** Ask a phone to capture new media with the front (`"user"`) or back (`"environment"`) camera. */
  capture?: "user" | "environment";
  /** Ignore every source, and disable each `FileUpload.Trigger`. */
  disabled?: boolean;
  /** Receives the files that passed `accept` and the count rule, in a fresh array for each call. */
  onSelect?: (files: File[]) => void;
  /**
   * Receives the files and folders that did not pass, with the reason for each. For one pick,
   * drop or paste it runs right after `onSelect`, in the same task.
   */
  onReject?: (rejections: FileRejection[]) => void;
};

const styles = fileUploadVariants();

const NO_DROP_TARGETS: ReadonlySet<string> = new Set();

/** React types no `webkitdirectory`, so the input takes the attribute through a spread. */
type DirectoryAttribute = { webkitdirectory?: "" };

/** The element of every mounted Root, so a paste finds the Root nearest to the focus. */
const rootElements = new WeakSet<Node>();

/**
 * The nearest Root element above `node`, walking out of shadow roots to their hosts, so focus
 * inside a shadow tree still finds the Root that holds the host.
 */
function nearestRoot(node: Node): Node | null {
  for (let current: Node | null = node; current !== null;) {
    if (rootElements.has(current)) {
      return current;
    }
    const parent: Node | null = current.parentNode;
    current = parent !== null && isFocusRoot(parent) && "host" in parent ? parent.host : parent;
  }
  return null;
}

function fileEntries(files: readonly File[]): SplitEntry[] {
  return files.map((file) => ({ kind: "file", file }));
}

/**
 * The provider every FileUpload part reads. It renders a `div` with the hidden file input the
 * picker opens, and writes `data-disabled` and `data-dragging`. A pick, a paste while focus is
 * inside it, `useFileUpload().actions.add` and a drop on `FileUpload.Dropzone` all end in the
 * same split, which calls `onSelect` with the files that pass and `onReject` with the rest.
 * The input has no `name`, so a native form post never carries the files.
 */
export function FileUploadRoot({
  accept,
  multiple = false,
  directory = false,
  capture,
  disabled = false,
  onSelect,
  onReject,
  className,
  render,
  ref,
  children,
  ...props
}: FileUploadRootProps): ReactElement {
  // The committed element, which a new `render` element replaces. Every DOM registration below
  // follows it, not the component's mount.
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, setElement);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropTargets, setDropTargets] = useState<ReadonlySet<string>>(NO_DROP_TARGETS);
  // Disabling ends every drag at once. Adjusted while rendering, so no frame shows a stale target.
  if (disabled && dropTargets.size > 0) {
    setDropTargets(NO_DROP_TARGETS);
  }
  const [descriptionIds, setDescriptionIds] = useState<readonly string[]>([]);
  const rules = useMemo<FileRules>(() => ({ accept: Accept.parse(accept), multiple }), [accept, multiple]);

  // The stable actions and the paste listener read the latest props from here. A layout effect
  // publishes them, so a render React discards never changes what an event sees.
  const latest = useRef({ rules, directory, disabled, onSelect, onReject });
  useLayoutEffect(() => {
    latest.current = { rules, directory, disabled, onSelect, onReject };
  });

  const deliver = useCallback((entries: readonly SplitEntry[]) => {
    const current = latest.current;
    if (current.disabled) {
      return;
    }
    const { accepted, rejected } = split(entries, current.rules);
    if (accepted.length > 0) {
      current.onSelect?.(accepted);
    }
    if (rejected.length > 0) {
      current.onReject?.(rejected);
    }
  }, []);

  // A paste or drop reads its folders asynchronously and can resolve after the Root unmounts, so
  // its result goes through this guard. A pick and `actions.add` deliver at once, even from a
  // child's mount effect, which runs before the Root's own effects.
  const unmounted = useRef(false);
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
    };
  }, []);
  const receive = useCallback(
    (entries: readonly ReadEntry[]) => {
      void expand(entries, { directory: latest.current.directory }).then((expanded) => {
        if (!unmounted.current) {
          deliver(expanded);
        }
      });
    },
    [deliver]
  );

  const actions = useMemo<FileUploadActions>(
    () => ({
      open: () => {
        if (!latest.current.disabled) {
          inputRef.current?.click();
        }
      },
      add: (files) => deliver(fileEntries(files)),
    }),
    [deliver]
  );

  const setDropTarget = useCallback((zone: string, shown: boolean) => {
    setDropTargets((zones) => {
      if (zones.has(zone) === shown) {
        return zones;
      }
      const next = new Set(zones);
      if (shown) {
        next.add(zone);
      } else {
        next.delete(zone);
      }
      return next;
    });
  }, []);

  // Counted per id, so a second Description with the same id changes nothing, and the id stays
  // listed until the last one unregisters.
  const descriptionCounts = useRef(new Map<string, number>());
  const registerDescription = useCallback((id: string) => {
    const counts = descriptionCounts.current;
    const count = counts.get(id) ?? 0;
    counts.set(id, count + 1);
    if (count === 0) {
      setDescriptionIds((ids) => [...ids, id]);
    }
    let registered = true;
    return () => {
      if (!registered) {
        return;
      }
      registered = false;
      const remaining = (counts.get(id) ?? 1) - 1;
      if (remaining > 0) {
        counts.set(id, remaining);
        return;
      }
      counts.delete(id);
      setDescriptionIds((ids) => ids.filter((listed) => listed !== id));
    };
  }, []);

  useLayoutEffect(() => {
    if (element === null) {
      return;
    }
    rootElements.add(element);
    return () => {
      rootElements.delete(element);
    };
  }, [element]);

  // Enabled or not, a mounted Root keeps a stray file drop from opening in the tab.
  useEffect(
    () => (element === null ? undefined : registerDocumentDropGuard(element.ownerDocument)),
    [element]
  );

  // Paste listens on the Root's document, because Firefox targets `<body>` for a paste while a
  // button has focus. `beforepaste` is cancelled so Safari enables its Paste menu item. Only the
  // Root nearest to the focused element takes the paste, so nested Roots never both take it.
  useEffect(() => {
    if (disabled || element === null) {
      return;
    }
    const ownerDocument = element.ownerDocument;
    const focusedInside = () => {
      const active = deepActiveElement(ownerDocument);
      return active !== null && nearestRoot(active) === element && !isTextEntry(active);
    };
    const onBeforePaste = (event: Event) => {
      if (focusedInside()) {
        event.preventDefault();
      }
    };
    const onPaste = (event: ClipboardEvent) => {
      if (!focusedInside() || event.clipboardData === null) {
        return;
      }
      const entries = read(event.clipboardData);
      if (entries.length === 0) {
        return;
      }
      event.preventDefault();
      receive(entries);
    };
    ownerDocument.addEventListener("beforepaste", onBeforePaste);
    ownerDocument.addEventListener("paste", onPaste);
    return () => {
      ownerDocument.removeEventListener("beforepaste", onBeforePaste);
      ownerDocument.removeEventListener("paste", onPaste);
    };
  }, [disabled, element, receive]);

  const dragging = dropTargets.size > 0;
  const state = useMemo<FileUploadState>(() => ({ dragging, disabled }), [dragging, disabled]);
  const context = useMemo<FileUploadContextValue>(
    () => ({
      state,
      actions,
      meta: { descriptionIds, registerDescription, dropTargets, setDropTarget, receive, rules },
    }),
    [state, actions, descriptionIds, registerDescription, dropTargets, setDropTarget, receive, rules]
  );

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = [...(input.files ?? [])];
    // Cleared at once, so picking the same file again fires `change` again.
    input.value = "";
    deliver(fileEntries(files));
  };

  const directoryAttribute: DirectoryAttribute = {};
  if (directory) {
    directoryAttribute.webkitdirectory = "";
  }

  const rendered = useRender({
    defaultTagName: "div",
    render,
    ref: mergedRef,
    state,
    props: {
      "data-slot": "file-upload",
      ...mergeProps<"div">(
        {
          className: cn(styles.root(), className),
          children: (
            <>
              {children}
              <input
                ref={inputRef}
                type="file"
                hidden
                tabIndex={-1}
                accept={accept}
                multiple={multiple}
                capture={capture}
                {...directoryAttribute}
                onChange={onChange}
                // The click `open()` dispatches stays inside the input, so no ancestor's click
                // handler sees a second click.
                onClick={(event) => event.stopPropagation()}
              />
            </>
          ),
        },
        props
      ),
    },
  });

  return <FileUploadContext value={context}>{rendered}</FileUploadContext>;
}

FileUploadRoot.displayName = "FileUpload.Root";
