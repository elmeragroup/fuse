"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";

import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useFormReset } from "../../hooks/use-form-reset";
import { useMergedRefs } from "../../hooks/use-merged-refs";
import { deepActiveElement } from "../../internal/active-element";
import { isFocusRoot } from "../../internal/dom-node";
import { useFieldDisabled } from "../../internal/field-set-disabled";
import { isTextEntry } from "../../internal/text-entry";
import { cn } from "../../styles/cn";
import { isThemeDevelopment } from "../../theme/validate-theme";
import * as Accept from "./accept";
import { registerDocumentDropGuard } from "./document-drop-guard";
import { FileUploadContext } from "./file-upload-context";
import type { FileUploadActions, FileUploadContextValue, FileUploadState } from "./file-upload-context";
import { fileUploadVariants } from "./file-upload-variants";
import { expand, read } from "./read-files";
import type { ReadEntry } from "./read-files";
import { split } from "./split-files";
import type { FileRejection, FileRules, SplitEntry } from "./split-files";

/**
 * `name` needs `files`, because the Root posts only the list it is given. `files` alone posts
 * under an enclosing `Field.Root`'s `name`.
 */
type FileUploadPostingRule = { files: readonly File[] } | { name?: undefined };

/** `FileUpload.Root` takes a `div`'s props, Base UI's `render`, and the picker, posting and callback props. */
export type FileUploadRootProps = Omit<useRender.ComponentProps<"div">, "onSelect"> &
  FileUploadPostingRule & {
    /**
     * Post `files` under this name with a native form submit or `new FormData(form)`. It needs
     * `files`. An enclosing `Field.Root`'s `name` takes its place, as it does for Base UI's
     * controls.
     */
    name?: string;
    /**
     * The files a native form posts, which the parent owns. The Root never changes the list: add
     * a pick from `onSelect`, and remove files from your own UI. A native form reset leaves the
     * list, and the post, as they are. Without a `name`, they post only under an enclosing
     * `Field.Root`'s `name`.
     */
    files?: readonly File[];
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
    /**
     * Ignore every source, and disable each `FileUpload.Trigger`. An enclosing disabled
     * `Field.Root` or `Field.Set` disables the Root as well.
     */
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
 * Makes `input.files` hold exactly `files`. A `FileList` has no constructor, so a `DataTransfer`
 * builds one. Assigning it fires no `change`, so the Root never hears its own write.
 */
function writeFiles(input: HTMLInputElement, files: readonly File[]): void {
  const transfer = new DataTransfer();
  for (const file of files) {
    transfer.items.add(file);
  }
  input.files = transfer.files;
}

/**
 * The provider every FileUpload part reads. It renders a `div` with the hidden file input the
 * picker opens, and writes `data-disabled` and `data-dragging`. A pick, a paste while focus is
 * inside it, `useFileUpload().actions.add` and a drop on `FileUpload.Dropzone` all end in the
 * same split, which calls `onSelect` with the files that pass and `onReject` with the rest.
 *
 * To post with a native form, pass `name` and the controlled `files`, and add each `onSelect`
 * to `files`. The Root writes `files` into a second hidden file input, apart from the picker's,
 * so a submit or `new FormData(form)` carries exactly that list under `name`; an empty list posts
 * as a native file input with no selection does. The picker's input stays empty between picks,
 * so every pick reaches `onSelect` or `onReject`, and only what the parent adds is posted.
 * Chromium and WebKit empty a file input on a form reset, so the Root writes the list back after
 * a native reset, including the one React runs after a form action. A disabled Root posts
 * nothing. Without `files` there is no posting input, and nothing is posted.
 *
 * A disabled `Field.Root` or `Field.Set` disables the Root. `FileUpload.Trigger` documents the
 * rest of the Field wiring.
 */
export function FileUploadRoot({
  name: nameProp,
  files,
  accept,
  multiple = false,
  directory = false,
  capture,
  disabled: disabledProp = false,
  onSelect,
  onReject,
  className,
  render,
  ref,
  children,
  ...props
}: FileUploadRootProps): ReactElement {
  const disabled = useFieldDisabled(disabledProp);
  // The Field's name wins, as Base UI's controls take it. Only a controlled list is posted.
  const fieldName = useFieldRootContext().name;
  const name = files === undefined ? undefined : (fieldName ?? nameProp);
  // The committed element, which a new `render` element replaces. Every DOM registration below
  // follows it, not the component's mount.
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, setElement);
  const inputRef = useRef<HTMLInputElement>(null);
  // The input a native form posts, apart from the picker: a browser fires no `change` for a pick
  // of the files its input already holds, so the picker stays empty between picks.
  const postingRef = useRef<HTMLInputElement>(null);
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

  // A Field has one control. Only counted, never changing an id, so a second Trigger is reported
  // in development and left as rendered.
  const fieldTriggers = useRef(0);
  const registerFieldTrigger = useCallback(() => {
    fieldTriggers.current += 1;
    if (fieldTriggers.current > 1 && isThemeDevelopment()) {
      console.error(
        "FileUpload: render one FileUpload.Trigger inside a Field. The Field's label, description and error belong to one control."
      );
    }
    return () => {
      fieldTriggers.current -= 1;
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
      meta: {
        descriptionIds,
        registerDescription,
        registerFieldTrigger,
        dropTargets,
        setDropTarget,
        receive,
        rules,
      },
    }),
    [
      state,
      actions,
      descriptionIds,
      registerDescription,
      registerFieldTrigger,
      dropTargets,
      setDropTarget,
      receive,
      rules,
    ]
  );

  // The posted list follows `files`. Keyed on the name and the Root element too, because the
  // posting input mounts with a name, and a new `render` element remounts it empty.
  useLayoutEffect(() => {
    if (postingRef.current !== null && files !== undefined) {
      writeFiles(postingRef.current, files);
    }
  }, [files, name, element]);

  // A native reset empties the posting input after its `reset` event; the hook runs this after.
  useFormReset(
    postingRef,
    name === undefined || files === undefined
      ? null
      : () => {
          if (postingRef.current !== null) {
            writeFiles(postingRef.current, files);
          }
        }
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
              {name === undefined ? null : (
                // `hidden` keeps it out of the accessibility tree and the tab order. A disabled
                // Root posts nothing, as a disabled native control does.
                <input
                  ref={postingRef}
                  type="file"
                  hidden
                  tabIndex={-1}
                  multiple
                  name={name}
                  disabled={disabled}
                />
              )}
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
