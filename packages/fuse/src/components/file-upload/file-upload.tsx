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
import { useFileUploadField } from "./file-upload-field";
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

type FileUploadRootBaseProps = useRender.ComponentProps<"div">;

/** `FileUpload.Root` takes a `div`'s props, Base UI's `render`, and the picker, posting and callback props. */
export type FileUploadRootProps = Omit<FileUploadRootBaseProps, "onSelect" | "children"> &
  FileUploadPostingRule & {
    /**
     * The parts: a `FileUpload.Dropzone` for drops, a `FileUpload.Trigger` that opens the picker,
     * and a `FileUpload.Description` of what the Root takes. Without a Dropzone, the Trigger and
     * the Description are a plain picker. A paste adds its files while focus is anywhere inside
     * the Root, such as on the Trigger, and a text field inside the Root keeps its own paste.
     * While any Root is mounted, a file dropped outside every Dropzone does nothing, so a missed
     * drop never opens the file in the tab. A custom part inside the Root reads `useFileUpload()`:
     * `actions.open()` opens the picker from a click or another user gesture, and
     * `actions.add(files)` sends files from another source through the same check as a pick.
     */
    children?: FileUploadRootBaseProps["children"];
    /**
     * The name `files` post under with a native form submit or `new FormData(form)`. It needs
     * `files`, so `name` without `files` is a type error. An enclosing `Field.Root`'s `name`
     * takes its place, as it does for Base UI's controls. The Root writes `files` into a hidden
     * input of its own, apart from the picker, so the post carries exactly that list. An empty
     * list posts one empty entry, as a native file input with no selection does. A disabled Root
     * posts nothing.
     */
    name?: string;
    /**
     * The files a native form posts, which the parent owns. The Root never changes the list. Add
     * each pick from `onSelect`, and remove files from your own UI, which removes them from the
     * post. A rejected pick, or one the parent does not add, never changes what is posted. The
     * picker stays empty between picks, so picking a file that is already posted still reaches
     * `onSelect`. A native form reset, including the one React runs after a form action, leaves
     * the list and the post as they are. Without a `name`, the files post only under an
     * enclosing `Field.Root`'s `name`, and without `files` the Root posts nothing.
     */
    files?: readonly File[];
    /**
     * Requires at least one file in `files` before a form submits. An empty or undefined `files`
     * counts as no file, as a native file input with no selection does, and a native form's
     * submit stops and moves focus to the first enabled `FileUpload.Trigger`. Inside a
     * `Field.Root`, the Trigger is the Field's control and `files` its value. The Field validates
     * the files as its `validationMode` says, on the Trigger's blur in `onBlur` mode, and on a
     * Base UI `Form` submit. With none, it turns invalid with `valueMissing`, so
     * `Field.Error match="valueMissing"` describes the Trigger and marks it `aria-invalid`, and a
     * `Form` focuses it. Adding a file clears the error, and opening the picker validates nothing.
     * `onFormSubmit` receives the files under the Field's `name`. A disabled Root is never
     * required.
     */
    required?: boolean;
    /**
     * The file types to take, in the `accept` attribute's syntax, such as `"image/*,.pdf"`. The
     * picker receives it as it is, and every source, a pick, a drop or a paste, ends in the same
     * check: a file that fails it reaches `onReject` with `"type"`.
     */
    accept?: string;
    /**
     * Takes more than one file. Without it, a pick, drop or paste in which more than one file
     * passes `accept` rejects each of those with `"count"`. `accept` is checked first, so a file
     * that fails it is rejected with `"type"` and never counts.
     */
    multiple?: boolean;
    /**
     * The picker selects folders, and a dropped folder expands into the files inside it, at any
     * depth. Each file's `webkitRelativePath` holds its path inside the folder, such as
     * `photos/2024/meter.jpg`, for a dropped folder as for a picked one. While it is off, a
     * dropped folder reaches `onReject` with `"directory"`.
     */
    directory?: boolean;
    /** Asks a phone to capture new media with the front (`"user"`) or back (`"environment"`) camera. */
    capture?: "user" | "environment";
    /**
     * Ignores every source, and disables each `FileUpload.Trigger`. An enclosing disabled
     * `Field.Root` or `Field.Set` disables the Root as well.
     */
    disabled?: boolean;
    /**
     * Receives the files that passed `accept` and the count rule, in a fresh array for each call,
     * which is yours to keep. The Root checks only `accept` and `multiple`. Check limits of your
     * own, such as a file count or a size, here before you keep a file.
     */
    onSelect?: (files: File[]) => void;
    /**
     * Receives the files and folders that did not pass, with the reason for each: `"type"` for a
     * file that fails `accept`, `"count"` for each passing file when a Root without `multiple`
     * gets more than one, `"directory"` for a folder while `directory` is off, and `"unreadable"`
     * for a file in a dropped folder that the browser could not read. For one pick, drop or paste,
     * it runs right after `onSelect`, in the same task. Show the rejections in words, such as in
     * an `Alert`, which announces itself.
     */
    onReject?: (rejections: FileRejection[]) => void;
  };

const styles = fileUploadVariants();

const NO_DROP_TARGETS: ReadonlySet<string> = new Set();

const NO_FILES: readonly File[] = [];

/**
 * Whether a Trigger can take the focus the validity input hands on. A Trigger rendered with
 * `focusableWhenDisabled` is disabled through `aria-disabled` alone, so `:disabled` misses it.
 */
function isEnabledTrigger(trigger: HTMLElement): boolean {
  return !trigger.matches(':disabled, [aria-disabled="true"]');
}

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
 * The Root posts `files` through a second hidden file input, apart from the picker's, so the
 * picker's input stays empty between picks and every pick reaches `onSelect` or `onReject`.
 * Chromium and WebKit empty a file input on a form reset, so the Root writes the list back after
 * a native reset. Under `required`, the posting input carries the validity a native form and a
 * Base UI `Field` read. It is visually hidden rather than `hidden`, so the browser can stop a
 * submit at it, and it hands focus to the first enabled `FileUpload.Trigger`.
 */
export function FileUploadRoot({
  name: nameProp,
  files,
  required = false,
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
  // The input a native form posts and validates, apart from the picker: a browser fires no
  // `change` for a pick of the files its input already holds, so the picker stays empty between
  // picks. It holds the controlled files whenever it is mounted: to post them, or to judge them.
  const postingRef = useRef<HTMLInputElement>(null);
  const posted = files ?? NO_FILES;
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

  // The mounted Triggers, in mount order. The first is the control a Base UI Form focuses, and the
  // first enabled one takes the focus the validity input hands on.
  const triggers = useRef<HTMLElement[]>([]);
  // The first Trigger, read when a Form focuses it.
  const firstTrigger = useMemo(
    () => ({
      get current(): HTMLElement | null {
        return triggers.current[0] ?? null;
      },
    }),
    []
  );
  const registerTrigger = useCallback((trigger: HTMLElement) => {
    triggers.current = [...triggers.current, trigger];
    return () => {
      triggers.current = triggers.current.filter((mounted) => mounted !== trigger);
    };
  }, []);

  const { inField, triggerLeft } = useFileUploadField({
    files: posted,
    name: nameProp,
    disabled,
    trigger: firstTrigger,
    validityInput: postingRef,
  });
  // Mounted to post the files, or for a native form or a Field to judge them.
  const postingInputShown = name !== undefined || required || inField;

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
        registerTrigger,
        registerFieldTrigger,
        triggerLeft,
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
      registerTrigger,
      registerFieldTrigger,
      triggerLeft,
      dropTargets,
      setDropTarget,
      receive,
      rules,
    ]
  );

  // A callback ref, so the write follows the posting input's every mount and remount (a name
  // appearing mounts it, a new `render` element remounts it empty) as well as every `files` change.
  const writePosted = useCallback(
    (input: HTMLInputElement | null) => {
      if (input !== null) {
        writeFiles(input, posted);
      }
    },
    [posted]
  );
  const postingInputRef = useMergedRefs(postingRef, writePosted);

  // A native reset empties the posting input after its `reset` event; the hook runs this after.
  useFormReset(postingRef, postingInputShown ? () => writePosted(postingRef.current) : null);

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
              {postingInputShown ? (
                // Visually hidden, not `hidden`, so a native submit can stop at it: the browser
                // focuses an invalid control, and it hands that focus to the first enabled Trigger. It stays out
                // of the accessibility tree and the tab order. A disabled Root posts nothing and is
                // never validated, as a disabled native control is.
                <input
                  ref={postingInputRef}
                  type="file"
                  tabIndex={-1}
                  aria-hidden
                  multiple
                  name={name}
                  required={required}
                  disabled={disabled}
                  onFocus={() => triggers.current.find(isEnabledTrigger)?.focus()}
                  className={styles.postingInput()}
                />
              ) : null}
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
