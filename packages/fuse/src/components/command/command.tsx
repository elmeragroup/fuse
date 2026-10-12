"use client";

import { createContext, use, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  ComponentProps,
  ComponentPropsWithRef,
  ComponentType,
  CSSProperties,
  KeyboardEvent,
  ReactElement,
  ReactNode,
} from "react";

// Subpath imports of Base UI's combobox family type-check but crash at runtime with a null React
// context (see combobox.tsx). Autocomplete shares those internals, so it keeps the package-root
// import too.
import { Autocomplete as AutocompletePrimitive } from "@base-ui/react";
import type { AutocompleteRootHighlightEventDetails, AutocompleteRootProps } from "@base-ui/react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { DialogRootChangeEventDetails, DialogRootProps } from "@base-ui/react/dialog";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { useMergedRefs } from "../../hooks/use-merged-refs";
import { ArrowLeft } from "../../icons/generated/arrow-left";
import { CaretRight } from "../../icons/generated/caret-right";
import { MagnifyingGlass } from "../../icons/generated/magnifying-glass";
import { definedProps } from "../../internal/defined-props";
import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import {
  commandContentShellClass,
  commandListShellClass,
  commandRowsHandedOffListShellClass,
} from "../../styles/inner-corner/command";
import { mergeClassName } from "../../styles/merge-class-name";
import { selfFocusRingClass } from "../../styles/utils";
import type { LabelButtonProps } from "../button/button";
import { DialogOverlay, DialogPortal } from "../dialog/dialog";
import {
  InputGroupAddon,
  InputGroupButton,
  InputGroupPlainInput,
  InputGroupRoot,
} from "../input-group/input-group";
import { Kbd } from "../kbd/kbd";
import { menuGroupLabelClass } from "../overlay/menu-row-classes";
import { overlayModalPopupClass } from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps } from "../overlay/overlay-props";
import { CommandCompositionError } from "./command-error";
import { CommandListTargetContext, CommandRowContext, CommandSearchContext } from "./command-list-context";
import type {
  CommandListRows,
  CommandRow,
  CommandSearchState,
  CommandVirtualScroller,
} from "./command-list-context";
import { CommandHint } from "./command-markup";
import type { CommandHintProps } from "./command-markup";
import { commandVariants } from "./command-variants";
import { highlightScrollAlign } from "./highlight-scroll";
import { commandStrings } from "./intl";

const styles = commandVariants();

/** The Dialog.Root props the palette's dialog takes, with Base UI's own types. */
type CommandDialogStateProps = Pick<
  DialogRootProps,
  | "open"
  | "defaultOpen"
  | "onOpenChange"
  | "onOpenChangeComplete"
  | "modal"
  | "disablePointerDismissal"
  | "actionsRef"
>;

type CommandPaletteContextValue = {
  /** Joins `Command.Trigger` to the Dialog.Root that `Command.Content` renders. */
  readonly handle: DialogPrimitive.Handle<unknown>;
  /** The Root's dialog props, for `Command.Content`'s Dialog.Root, which they always control. */
  readonly dialog: Omit<CommandDialogStateProps, "defaultOpen">;
  /** Counts the dialog's closes, so each search resets an uncontrolled query when it changes. */
  readonly session: number;
  /** Tells the Root a `Command.Content` is mounted, until the returned cleanup runs. */
  readonly registerContent: () => () => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

/** The enclosing Root's palette state; throws a named error outside a Root. */
function usePalette(part: string): CommandPaletteContextValue {
  const palette = use(CommandPaletteContext);
  if (palette === null) {
    throw new CommandCompositionError(part, "outside-root");
  }
  return palette;
}

type CommandStackContextValue = {
  /** The page ids from the first page to the one on top. */
  readonly stack: readonly string[];
  /** Puts a page on top of the stack. */
  readonly push: (page: string) => void;
  /** Takes the top page off the stack, unless it is the only one. */
  readonly pop: () => void;
  /**
   * The page whose input takes focus when it mounts: the page that came on top while the palette
   * was showing. `undefined` when no page swap is waiting for its input, so a page mounted when
   * the palette loads or its dialog opens leaves focus alone.
   */
  readonly focusPage: string | undefined;
  /** Drops the focus request once the named page's input has taken focus. */
  readonly clearFocusPage: (page: string) => void;
};

const CommandStackContext = createContext<CommandStackContextValue | null>(null);

/** The page on top: its id, which a focus request names, and its label, which names its input. */
type CommandPageContextValue = { readonly id: string; readonly label: string };

const CommandPageContext = createContext<CommandPageContextValue | null>(null);

/** Whether a stack holds a page below the one on top. */
function canGoBack(stack: CommandStackContextValue | null): stack is CommandStackContextValue {
  return stack !== null && stack.stack.length > 1;
}

/** A group of items as Base UI recognizes one: an object with its own `items` list. */
type ItemGroup = { readonly items: readonly unknown[] };

/**
 * Whether an entry is a group, by Base UI's own predicate (`isGroup` in its
 * `internals/resolveValueLabel`): a non-null object whose `items` is an array. An object with a
 * null prototype counts too, as it does for Base UI.
 */
function isItemGroup<Entry>(entry: Entry): boolean {
  return (
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- matches Base UI's own group predicate, so the palette and Base UI agree on which entries are groups
    typeof entry === "object" && entry !== null && "items" in entry && Array.isArray(entry.items)
  );
}

/**
 * One item of the palette: an item of a group of `Groups` when `Grouped` is `true`, else `Item`.
 *
 * @template Item - The item of a flat search.
 * @template Groups - The whole `items` array of a grouped search.
 * @template Grouped - Whether the search's `items` are groups.
 */
export type CommandItemOf<
  Item,
  Groups extends readonly ItemGroup[],
  Grouped extends boolean | undefined,
> = Grouped extends true ? Groups[number]["items"][number] : Item;

/** Autocomplete Root props a search pins or leaves out: an inline list has no popup to open. */
type CommandSearchOmitted =
  | "items"
  | "locale"
  | "open"
  | "defaultOpen"
  | "onOpenChange"
  | "onOpenChangeComplete"
  | "modal"
  | "inline"
  | "actionsRef"
  | "children";

/**
 * Props of a palette's search, which `Command.Root` takes when it has no stack and each
 * `Command.Page` takes: Base UI Autocomplete Root's. Without `grouped` they are generic over one
 * item, as Base UI's flat overload is; with `grouped`, over the whole array of groups, as its
 * grouped overload is. `locale` comes from `LocaleProvider`, and the popup props are gone, since
 * the list is always open inline.
 *
 * @template Item - The item of a flat search.
 * @template Groups - The whole `items` array of a grouped search.
 * @template Grouped - Whether the search's `items` are groups.
 */
export type CommandSearchProps<
  Item = unknown,
  Groups extends readonly ItemGroup[] = readonly ItemGroup[],
  Grouped extends boolean | undefined = false,
> = Omit<
  AutocompleteRootProps<CommandItemOf<Item, Groups, Grouped>>,
  CommandSearchOmitted | "autoHighlight" | "keepHighlight"
> & {
  /**
   * Marks `items` as groups, each with its own `items`. The callbacks, such as
   * `itemToStringValue` and `onItemHighlighted`, then receive one item of a group. The search
   * throws when the first entry disagrees with it.
   * @default false
   */
  grouped?: Grouped;
  /**
   * Whether the first matching item is highlighted automatically, as Base UI's prop of the same
   * name: `true` highlights it after the user types, `"always"` keeps it highlighted.
   * @default "always"
   */
  autoHighlight?: boolean | "always" | undefined;
  /**
   * Whether the highlighted item stays highlighted when the pointer leaves the list.
   * @default true
   */
  keepHighlight?: boolean | undefined;
} & (Grouped extends true
    ? {
        /** The groups of items, in the order the list shows them. */
        items: Groups;
      }
    : {
        /** The items, as a flat list, in the order the list shows them. */
        items?: readonly Item[] | undefined;
      });

/** The search props with every key absent, for a Root whose pages hold the searches. */
type CommandNoSearchProps = {
  [Key in keyof CommandSearchProps<unknown, readonly ItemGroup[], boolean>]?: never;
};

/** A stack of page ids: controlled with `pages`, or uncontrolled from `defaultPages`. */
type CommandStackProps =
  | {
      /** The page ids from the first page to the one on top. Use when controlled. */
      pages: readonly string[];
      defaultPages?: never;
      /** Called with the next stack when a page is pushed or popped. */
      onPagesChange?: ((pages: string[]) => void) | undefined;
    }
  | {
      /** The page ids the stack starts with, from the first page to the one on top. */
      defaultPages: readonly string[];
      pages?: never;
      /** Called with the next stack when a page is pushed or popped. */
      onPagesChange?: ((pages: string[]) => void) | undefined;
    };

/**
 * Props of `Command.Root`: the dialog's state, then either the search's props or a stack of
 * pages, never both.
 *
 * @template Item - The item of a flat search.
 * @template Groups - The whole `items` array of a grouped search.
 * @template Grouped - Whether the search's `items` are groups.
 */
export type CommandRootProps<
  Item = unknown,
  Groups extends readonly ItemGroup[] = readonly ItemGroup[],
  Grouped extends boolean | undefined = false,
> = CommandDialogStateProps & {
  /** The palette's parts. */
  children?: ReactNode;
} & (
    | (CommandSearchProps<Item, Groups, Grouped> & {
        pages?: never;
        defaultPages?: never;
        onPagesChange?: never;
      })
    | (CommandStackProps & CommandNoSearchProps)
  );

/** The search props the module passes around inside, with the item type erased. */
type CommandSearchCoreProps = Omit<
  // oxlint-disable-next-line typescript/no-explicit-any -- SAFETY: the public props pair each callback with its items; here the item type is erased so one search serves every Root and Page, and `unknown` would reject the typed callbacks.
  AutocompleteRootProps<any>,
  CommandSearchOmitted
> & {
  grouped?: boolean | undefined;
  items?: readonly unknown[] | undefined;
};

/**
 * Throws the named error for an `items` list that disagrees with `grouped`, or for `virtualized`
 * beside `grouped`. Reads the first entry, as Base UI does.
 */
function assertGrouping(
  part: string,
  grouped: boolean,
  virtualized: boolean,
  entries: readonly unknown[] | undefined
): void {
  if (grouped && virtualized) {
    throw new CommandCompositionError(part, "virtualized-grouped");
  }
  if (entries === undefined || entries.length === 0) {
    return;
  }
  const isGroup = isItemGroup(entries[0]);
  if (isGroup && !grouped) {
    throw new CommandCompositionError(part, "groups-without-grouped");
  }
  if (!isGroup && grouped) {
    throw new CommandCompositionError(part, "grouped-without-groups");
  }
}

/**
 * One search: Base UI's Autocomplete, always open with its list inline, and the first match
 * always highlighted. It owns an uncontrolled query, so it can reset the query to
 * `defaultValue` each time the palette's dialog closes. A virtualized search tracks the
 * highlighted row and scrolls its virtual list when the highlight jumps out of view.
 */
function CommandSearch({
  part,
  grouped = false,
  virtualized = false,
  value,
  defaultValue,
  onValueChange,
  onItemHighlighted,
  autoHighlight,
  keepHighlight,
  children,
  ...props
}: CommandSearchCoreProps & {
  part: string;
  autoHighlight: NonNullable<CommandSearchCoreProps["autoHighlight"]>;
  keepHighlight: boolean;
  children?: ReactNode;
}): ReactElement {
  assertGrouping(part, grouped, virtualized, props.items ?? props.filteredItems);
  const { locale } = useLocale();
  const { session } = usePalette(part);
  const [ownQuery, setOwnQuery] = useState(defaultValue ?? "");
  // Each close of the dialog starts the next opening fresh, as React's docs adjust state from a
  // changed prop: during render, not in an effect.
  const [seenSession, setSeenSession] = useState(session);
  if (seenSession !== session) {
    setSeenSession(session);
    setOwnQuery(defaultValue ?? "");
  }
  const scroller = useRef<CommandVirtualScroller | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | undefined>(undefined);
  const state = useMemo<CommandSearchState>(
    () => ({ virtualized, highlightedIndex, scroller }),
    [virtualized, highlightedIndex]
  );
  return (
    <CommandSearchContext.Provider value={state}>
      <AutocompletePrimitive.Root
        inline
        open
        autoHighlight={autoHighlight}
        keepHighlight={keepHighlight}
        virtualized={virtualized}
        value={value ?? ownQuery}
        onValueChange={(next: string, details) => {
          setOwnQuery(next);
          onValueChange?.(next, details);
        }}
        onItemHighlighted={(item, details: AutocompleteRootHighlightEventDetails) => {
          onItemHighlighted?.(item, details);
          if (!virtualized) {
            return;
          }
          setHighlightedIndex(item === undefined ? undefined : details.index);
          const list = scroller.current;
          if (item === undefined || list === null) {
            return;
          }
          const align = highlightScrollAlign(details.reason, details.index, list.options.count);
          if (align !== undefined) {
            // After Base UI commits the highlight, so the scroll lands on the row it rendered.
            queueMicrotask(() => {
              list.scrollToIndex(details.index, { align });
            });
          }
        }}
        {...props}
        locale={locale}>
        {children}
      </AutocompletePrimitive.Root>
    </CommandSearchContext.Provider>
  );
}

/**
 * The stack's state: controlled by `pages`, else its own, starting from `defaultPages`. When a
 * different page comes on top while the palette is showing, it requests focus for that page's
 * input, which takes it once it mounts, even after Suspense. Closing the palette drops the
 * request, so a stack reset while it is closed requests nothing.
 */
function useStack(
  pages: readonly string[] | undefined,
  defaultPages: readonly string[] | undefined,
  onPagesChange: ((pages: string[]) => void) | undefined,
  showing: boolean
) {
  const [ownStack, setOwnStack] = useState<readonly string[]>(defaultPages ?? []);
  const stack = pages ?? ownStack;
  const top = stack.at(-1);
  const [seenTop, setSeenTop] = useState(top);
  const [focusPage, setFocusPage] = useState<string | undefined>(undefined);
  // Adjusted during render, as React's docs adjust state from a changed prop, so the input that
  // the same render mounts reads the request.
  if (seenTop !== top) {
    setSeenTop(top);
    setFocusPage(showing ? top : undefined);
  } else if (!showing && focusPage !== undefined) {
    setFocusPage(undefined);
  }
  const clearFocusPage = useCallback((page: string) => {
    setFocusPage((current) => (current === page ? undefined : current));
  }, []);
  const context = useMemo(() => {
    const change = (next: string[]) => {
      if (pages === undefined) {
        setOwnStack(next);
      }
      onPagesChange?.(next);
    };
    return {
      stack,
      push: (page: string) => {
        change([...stack, page]);
      },
      pop: () => {
        if (stack.length > 1) {
          change(stack.slice(0, -1));
        }
      },
      focusPage,
      clearFocusPage,
    };
  }, [stack, pages, onPagesChange, focusPage, clearFocusPage]);
  return {
    context,
    reset: () => {
      if (pages === undefined) {
        setOwnStack(defaultPages ?? []);
      }
    },
  };
}

/**
 * The palette's state, where every palette starts. It renders no element. It holds the dialog's
 * open state for `Command.Trigger` and `Command.Content`, with Base UI Dialog Root's `open`,
 * `defaultOpen`, `onOpenChange` and the rest. Without a stack it is the search: Base UI's
 * Autocomplete, always open with its list inline and the first match always highlighted, which
 * takes every Autocomplete prop, such as `items`, `value`, `filter` and `virtualized`, and filters
 * in the locale of `LocaleProvider`. With `defaultPages`, or `pages` and `onPagesChange`, it holds
 * a stack of page ids instead, and each `Command.Page` holds its own search.
 *
 * Pass `grouped` when `items` are groups: the callbacks then receive one item of a group. Each
 * opening of the dialog starts fresh: when the close animation ends, an uncontrolled query goes
 * back to `defaultValue` and an uncontrolled stack to `defaultPages`.
 *
 * @template Item - The item of a flat search.
 * @template Groups - The whole `items` array of a grouped search.
 * @template Grouped - Whether the search's `items` are groups.
 */
export function CommandRoot<
  Item = unknown,
  Groups extends readonly ItemGroup[] = readonly ItemGroup[],
  Grouped extends boolean | undefined = false,
>({
  open,
  defaultOpen,
  onOpenChange,
  onOpenChangeComplete,
  modal,
  disablePointerDismissal,
  actionsRef,
  pages,
  defaultPages,
  onPagesChange,
  autoHighlight = "always",
  keepHighlight = true,
  children,
  ...search
}: CommandRootProps<Item, Groups, Grouped>): ReactElement {
  const [handle] = useState(() => DialogPrimitive.createHandle<unknown>());
  const [session, setSession] = useState(0);
  const [hasContent, setHasContent] = useState(false);
  const registerContent = useCallback(() => {
    setHasContent(true);
    return () => {
      setHasContent(false);
    };
  }, []);
  // The Root owns the dialog's open state, so `Command.Content`'s Dialog.Root is always
  // controlled: remounting Content cannot reopen a dialog the Root records as closed.
  const [ownOpen, setOwnOpen] = useState(defaultOpen ?? false);
  const isOpen = open ?? ownOpen;
  // An inline palette always shows; one in `Command.Content` shows while its dialog is open.
  const showing = !hasContent || isOpen;
  const stack = useStack(pages, defaultPages, onPagesChange, showing);
  const hasStack = pages !== undefined || defaultPages !== undefined;
  const palette: CommandPaletteContextValue = {
    handle,
    session,
    registerContent,
    dialog: {
      ...definedProps({ modal, disablePointerDismissal, actionsRef }),
      open: isOpen,
      onOpenChange: (next: boolean, details: DialogRootChangeEventDetails) => {
        onOpenChange?.(next, details);
        if (!details.isCanceled) {
          setOwnOpen(next);
        }
      },
      onOpenChangeComplete: (next: boolean) => {
        onOpenChangeComplete?.(next);
        if (!next) {
          setSession((count) => count + 1);
          stack.reset();
        }
      },
    },
  };
  return (
    <CommandPaletteContext.Provider value={palette}>
      {hasStack ? (
        <CommandStackContext.Provider value={stack.context}>{children}</CommandStackContext.Provider>
      ) : (
        // A Root without pages is a palette of its own, even inside an outer palette's page: no
        // stack for Back and Backspace to pop, and no page to name or focus its input.
        <CommandStackContext.Provider value={null}>
          <CommandPageContext.Provider value={null}>
            <CommandSearch
              part="Command.Root"
              autoHighlight={autoHighlight}
              keepHighlight={keepHighlight}
              {...search}>
              {children}
            </CommandSearch>
          </CommandPageContext.Provider>
        </CommandStackContext.Provider>
      )}
    </CommandPaletteContext.Provider>
  );
}

/**
 * Props of `Command.Page`: its id and label, and the props of its own search.
 *
 * @template Item - The item of a flat search.
 * @template Groups - The whole `items` array of a grouped search.
 * @template Grouped - Whether the search's `items` are groups.
 */
export type CommandPageProps<
  Item = unknown,
  Groups extends readonly ItemGroup[] = readonly ItemGroup[],
  Grouped extends boolean | undefined = false,
> = CommandSearchProps<Item, Groups, Grouped> & {
  /** The id `Command.PageTrigger` pushes and the Root's stack holds. */
  id: string;
  /** The page's name. The page's `Command.Input` is named after it unless it has a name of its own. */
  label: string;
  /** The page's parts: its `Command.Input`, `Command.List` and the rest. */
  children?: ReactNode;
};

/**
 * One page of a Root's stack, such as a list of customers that opens one customer's actions. It
 * holds its own search, with the same props as a Root without a stack, and renders only while its
 * id is on top of the stack. So going back mounts the parent fresh: empty query, first match
 * highlighted. To keep the parent's query, hold it above `Command.Root` and pass it to the page as
 * `value` with `onValueChange`. Throws outside a Root with a stack.
 *
 * @template Item - The item of a flat search.
 * @template Groups - The whole `items` array of a grouped search.
 * @template Grouped - Whether the search's `items` are groups.
 */
export function CommandPage<
  Item = unknown,
  Groups extends readonly ItemGroup[] = readonly ItemGroup[],
  Grouped extends boolean | undefined = false,
>({
  id,
  label,
  autoHighlight = "always",
  keepHighlight = true,
  children,
  ...search
}: CommandPageProps<Item, Groups, Grouped>): ReactElement | null {
  const stack = use(CommandStackContext);
  if (stack === null) {
    throw new CommandCompositionError("Command.Page", "page-outside-stack");
  }
  if (stack.stack.at(-1) !== id) {
    return null;
  }
  return (
    <CommandPageContext.Provider value={{ id, label }}>
      <CommandSearch
        part="Command.Page"
        autoHighlight={autoHighlight}
        keepHighlight={keepHighlight}
        {...search}>
        {children}
      </CommandSearch>
    </CommandPageContext.Provider>
  );
}

/** Props of `Command.Trigger`: Base UI Dialog Trigger's, less the handle the Root supplies. */
export type CommandTriggerProps = Omit<ComponentProps<typeof DialogPrimitive.Trigger>, "handle" | "payload">;

/**
 * The button that opens `Command.Content`, as Dialog's own trigger does. Closing the palette
 * returns focus to it. Place it inside `Command.Root`, anywhere outside `Command.Content`.
 */
export function CommandTrigger({ className, ...props }: CommandTriggerProps): ReactElement {
  const { handle } = usePalette("Command.Trigger");
  return (
    <DialogPrimitive.Trigger
      data-slot="command-trigger"
      handle={handle}
      className={mergeClassName(className, selfFocusRingClass)}
      {...props}
    />
  );
}

/** Props of `Command.Content`: Base UI Dialog Popup's plus the portal container. */
export type CommandContentProps = ComponentProps<typeof DialogPrimitive.Popup> & OverlayContainerProps;

/**
 * The palette as a modal: the Dialog's portal and overlay around a palette-wide popup placed near
 * the top of the viewport, with no close button. The dialog lives here, so a palette without it
 * renders no dialog, and one inline in a dialog of your own leaves that dialog's parts bound to
 * it. Its name defaults to the locale dictionary; a `Dialog.Title` inside it names it instead.
 * Escape closes it from any page.
 */
export function CommandContent({
  className,
  container,
  "aria-label": ariaLabel,
  ...props
}: CommandContentProps): ReactElement {
  const strings = useLocalizedStrings(commandStrings);
  const { handle, dialog, registerContent } = usePalette("Command.Content");
  useLayoutEffect(registerContent, [registerContent]);
  return (
    <DialogPrimitive.Root handle={handle} {...dialog}>
      <OverlayPortal portal={DialogPortal} container={container}>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="command-content"
          aria-label={ariaLabel ?? strings.format("dialogLabel")}
          className={mergeClassName(
            className,
            overlayModalPopupClass,
            commandContentShellClass,
            styles.content()
          )}
          {...definedProps(props)}
        />
      </OverlayPortal>
    </DialogPrimitive.Root>
  );
}

/** Whether a key press is a Backspace that edits nothing: the input is empty and no IME text is composing. */
function isBackspaceOnEmpty(event: KeyboardEvent<HTMLInputElement>): boolean {
  // keyCode 229 is the IME's own key event, which some browsers send without `isComposing`.
  return (
    event.key === "Backspace" &&
    event.currentTarget.value === "" &&
    !event.nativeEvent.isComposing &&
    event.keyCode !== 229
  );
}

/** Props of `Command.Input`: Base UI Autocomplete Input's, with the class and children on the group. */
export type CommandInputProps = Omit<
  ComponentProps<typeof AutocompletePrimitive.Input>,
  "className" | "children"
> & {
  /** Extra classes, applied to the outer InputGroup, not the input element. */
  className?: string;
  /**
   * The group's addons, such as an `InputGroup.Addon` holding a `Kbd`. Without children the
   * input leads with a search icon, or with `Command.Back` on a page above the first.
   */
  children?: ReactNode;
};

/**
 * The palette's search field: an InputGroup around Base UI's Autocomplete input. Its name is
 * `aria-label`, else the enclosing `Command.Page`'s `label`, else the locale dictionary; its
 * placeholder defaults to the dictionary. On a page above the first, Backspace in the empty
 * input goes back a page; it does nothing while IME text is composing. When a different page
 * comes on top while the palette shows, that page's input takes focus as it mounts, even after
 * Suspense. An input mounted when the page loads or the dialog opens leaves focus where it is,
 * or to the dialog's `initialFocus`, and a stack change that keeps its page on top leaves it be.
 */
export function CommandInput({
  className,
  children,
  ref,
  onKeyDown,
  placeholder,
  "aria-label": ariaLabel,
  ...props
}: CommandInputProps): ReactElement {
  const strings = useLocalizedStrings(commandStrings);
  const stack = use(CommandStackContext);
  const page = use(CommandPageContext);
  const inputRef = useRef<HTMLInputElement>(null);
  const mergedRef = useMergedRefs(ref, inputRef);
  const pageId = page?.id;
  // Read once, when the input first renders: a later stack change never refocuses it.
  const [focusOnMount] = useState(() => pageId !== undefined && stack?.focusPage === pageId);
  const clearFocusPage = stack?.clearFocusPage;
  useLayoutEffect(() => {
    if (focusOnMount && pageId !== undefined) {
      inputRef.current?.focus();
      clearFocusPage?.(pageId);
    }
  }, [focusOnMount, pageId, clearFocusPage]);
  return (
    <InputGroupRoot data-slot="command-input" className={cn(styles.input(), className)}>
      <AutocompletePrimitive.Input
        ref={mergedRef}
        aria-label={ariaLabel ?? page?.label ?? strings.format("inputLabel")}
        placeholder={placeholder ?? strings.format("placeholder")}
        render={<InputGroupPlainInput />}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && canGoBack(stack) && isBackspaceOnEmpty(event)) {
            event.preventDefault();
            stack.pop();
          }
        }}
        {...definedProps(props)}
      />
      {children ?? (
        <InputGroupAddon>{canGoBack(stack) ? <CommandBack /> : <MagnifyingGlass />}</InputGroupAddon>
      )}
    </InputGroupRoot>
  );
}

/** Props of `Command.Back`: a label-sized Button's, with the size and icon fixed. */
export type CommandBackProps = Omit<LabelButtonProps, "size" | "children"> & {
  /** Accessible name. An explicit `aria-label` wins over it; both default to the locale dictionary. */
  label?: string;
};

/**
 * An InputGroup button that goes back a page. It renders nothing on the first page or in a
 * palette without a stack. Place it in an `InputGroup.Addon` among `Command.Input`'s children.
 */
export function CommandBack({
  label,
  "aria-label": ariaLabel,
  onClick,
  ...props
}: CommandBackProps): ReactElement | null {
  const strings = useLocalizedStrings(commandStrings);
  const stack = use(CommandStackContext);
  if (!canGoBack(stack)) {
    return null;
  }
  return (
    <InputGroupButton
      data-slot="command-back"
      size="icon-sm"
      variant="ghost"
      aria-label={ariaLabel ?? label ?? strings.format("back")}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          stack.pop();
        }
      }}
      {...props}>
      <ArrowLeft />
    </InputGroupButton>
  );
}

/** Props of `Command.List`: Base UI Autocomplete List's. */
export type CommandListProps = ComponentProps<typeof AutocompletePrimitive.List>;

type CommandListRender = NonNullable<CommandListProps["render"]>;

type CommandListRenderProps = Parameters<Extract<CommandListRender, (...args: never[]) => ReactElement>>;

/** The element `Command.List`'s render value renders: a listbox `div` whose children are the rows. */
type CommandListTargetType = ComponentType<
  Omit<ComponentPropsWithRef<"div">, "children"> & { children?: CommandListRows }
>;

/**
 * Renders `Command.List`'s `render` value with Base UI's listbox props and the row function as
 * `children`, through Base UI's `useRender`, which takes an element, a function or the lazy
 * element a Server Component's render prop arrives as. It marks its subtree as `Command.List`'s
 * render target, which `CommandVirtual.List` checks.
 */
function CommandListRowsTarget({
  render,
  rows,
  listProps,
  state,
}: {
  readonly render: CommandListRender;
  readonly rows: CommandListRows;
  /** Base UI's listbox props. Its `children` are empty, since `Command.List` passes the List none. */
  readonly listProps: Omit<CommandListRenderProps[0], "children">;
  readonly state: CommandListRenderProps[1];
}): ReactElement {
  // The state as a plain object, which `useRender`'s state parameter requires.
  const renderState = { ...state };
  // SAFETY: `useRender` calls a render function with the props and state passed here, which are
  // Base UI List's own render props and state, the arguments the List's render type names. An
  // element or lazy element takes no arguments.
  const target = render as useRender.RenderProp<typeof renderState>;
  const element = useRender({
    render: target,
    state: renderState,
    props: mergeProps<CommandListTargetType>(listProps, { children: rows }),
  });
  return <CommandListTargetContext.Provider value>{element}</CommandListTargetContext.Provider>;
}

/**
 * The scrolling list of results. It pads its rows with the small surface tier and publishes the
 * palette's `rounded-xl` less that padding as `--inner-corner`. Given a `render` value and a row
 * function, it hands the row function to the rendered element as its `children`, in place of
 * rendered rows, beside Base UI's listbox props, so the element decides which rows mount, as
 * `CommandVirtual.List` does. Given other children, `render` keeps Base UI's meaning, with or
 * without `virtualized`, so a virtualizer of your own can pass indexed `Command.Item` elements. A
 * virtualized search throws on a row function without a `render` value, since it would mount
 * every row without the index Base UI's navigation reads.
 */
export function CommandList({ className, ...props }: CommandListProps): ReactElement {
  const search = use(CommandSearchContext);
  const { render, children: rows, ...listProps } = props;
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Base UI's public children contract accepts nodes or a row function.
  if (render !== undefined && typeof rows === "function") {
    return (
      <AutocompletePrimitive.List
        data-slot="command-list"
        className={mergeClassName(className, styles.list(), commandRowsHandedOffListShellClass)}
        render={(renderProps, state) => (
          <CommandListRowsTarget render={render} rows={rows} listProps={renderProps} state={state} />
        )}
        {...listProps}
      />
    );
  }
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Base UI's public children contract accepts nodes or a row function.
  if (search?.virtualized === true && typeof rows === "function") {
    throw new CommandCompositionError("Command.List", "virtualized-list-without-render");
  }
  return (
    <AutocompletePrimitive.List
      data-slot="command-list"
      className={mergeClassName(className, styles.list(), commandListShellClass)}
      {...props}
    />
  );
}

/**
 * The message shown while no item matches, the locale dictionary's by default. Base UI keeps it
 * mounted as a polite live region and renders its children only while the list is empty. Place
 * it beside `Command.List`, not inside it.
 */
export function CommandEmpty({
  className,
  children,
  ...props
}: ComponentProps<typeof AutocompletePrimitive.Empty>): ReactElement {
  const strings = useLocalizedStrings(commandStrings);
  return (
    <AutocompletePrimitive.Empty
      data-slot="command-empty"
      className={mergeClassName(className, styles.empty())}
      {...props}>
      {children ?? strings.format("empty")}
    </AutocompletePrimitive.Empty>
  );
}

/** A group of results. Pass the group's own `items` when the Root's items are grouped. */
export function CommandGroup({
  className,
  ...props
}: ComponentProps<typeof AutocompletePrimitive.Group>): ReactElement {
  return (
    <AutocompletePrimitive.Group data-slot="command-group" className={mergeClassName(className)} {...props} />
  );
}

/** A group's visible name, which also names the group for assistive technology. */
export function CommandLabel({
  className,
  ...props
}: ComponentProps<typeof AutocompletePrimitive.GroupLabel>): ReactElement {
  return (
    <AutocompletePrimitive.GroupLabel
      data-slot="command-label"
      className={mergeClassName(className, menuGroupLabelClass)}
      {...props}
    />
  );
}

/** Renders the filtered items of the enclosing Root, Page or Group through its child function. */
export function CommandCollection(
  props: ComponentProps<typeof AutocompletePrimitive.Collection>
): ReactElement {
  return <AutocompletePrimitive.Collection {...props} />;
}

/** Props of `Command.Item`: Base UI Autocomplete Item's. */
export type CommandItemProps = ComponentProps<typeof AutocompletePrimitive.Item>;

type CommandItemStyle = CommandItemProps["style"];

/** The row's placement under the item's own style, which wins where both set a property. */
function withRowStyle(rowStyle: CSSProperties, style: CommandItemStyle): CommandItemStyle {
  if (style === undefined) {
    return rowStyle;
  }
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Base UI's public style contract accepts an object or a state callback.
  if (typeof style === "function") {
    return (state) => ({ ...rowStyle, ...style(state) });
  }
  return { ...rowStyle, ...style };
}

/** The props a virtual list's row adds to an item, or none in an ordinary list. */
function rowProps(row: CommandRow | null, style: CommandItemStyle) {
  if (row === null) {
    return style === undefined ? {} : { style };
  }
  return {
    index: row.index,
    "data-index": row.index,
    "aria-setsize": row.setSize,
    "aria-posinset": row.index + 1,
    style: withRowStyle(row.style, style),
  };
}

/**
 * One result row. Its `onClick` runs on a click and on Enter while it is highlighted; Base UI's
 * `data-highlighted` is its only highlight. Give it a `value` when the search has no `items`. Put
 * a shortcut it carries in `aria-keyshortcuts` beside a `Command.Shortcut`. In a virtual list it
 * takes its index, position and measurement from the list.
 */
export function CommandItem({ className, ref, style, ...props }: CommandItemProps): ReactElement {
  const row = use(CommandRowContext);
  const mergedRef = useMergedRefs(ref, row?.ref);
  return (
    <AutocompletePrimitive.Item
      data-slot="command-item"
      ref={mergedRef}
      {...rowProps(row, style)}
      className={mergeClassName(className, styles.item())}
      {...props}
    />
  );
}

/** Props of `Command.PageTrigger`: `Command.Item`'s plus the page it opens. */
export type CommandPageTriggerProps = CommandItemProps & {
  /** The id of the `Command.Page` this row opens. */
  page: string;
};

/**
 * A row that opens a page of the Root's stack on click or Enter, with a chevron at its end. Call
 * `preventDefault()` in `onClick` to keep the page closed. Throws outside a Root with a stack.
 */
export function CommandPageTrigger({
  page,
  onClick,
  children,
  ...props
}: CommandPageTriggerProps): ReactElement {
  const stack = use(CommandStackContext);
  if (stack === null) {
    throw new CommandCompositionError("Command.PageTrigger", "page-trigger-outside-stack");
  }
  return (
    <CommandItem
      data-slot="command-page-trigger"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          stack.push(page);
        }
      }}
      {...props}>
      {children}
      <CaretRight className={styles.trailing()} />
    </CommandItem>
  );
}

/** Props of the key hint presets: `Command.Hint`'s, with children as the label. */
export type CommandHintPresetProps = Omit<CommandHintProps, "children"> & {
  /** The hint's label, in place of the locale dictionary's. */
  children?: ReactNode;
};

/** The props of one key hint preset: its caps and the dictionary key of its default label. */
type KeyHintProps = CommandHintPresetProps & {
  readonly keys: readonly string[];
  readonly label: "navigate" | "select" | "close" | "back";
};

/** A key hint preset's parts: its caps, then its label, or the locale dictionary's. */
function KeyHint({ keys, label, children, ...props }: KeyHintProps): ReactElement {
  const strings = useLocalizedStrings(commandStrings);
  return (
    <CommandHint {...props}>
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
      <span>{children ?? strings.format(label)}</span>
    </CommandHint>
  );
}

/** The arrow keys' hint: they move the highlight. */
export function CommandNavigateHint(props: CommandHintPresetProps): ReactElement {
  return <KeyHint keys={["↑", "↓"]} label="navigate" {...props} />;
}

/** The Enter key's hint: it runs the highlighted row. */
export function CommandSelectHint(props: CommandHintPresetProps): ReactElement {
  return <KeyHint keys={["↵"]} label="select" {...props} />;
}

/** The Escape key's hint: it closes `Command.Content`. */
export function CommandCloseHint(props: CommandHintPresetProps): ReactElement {
  return <KeyHint keys={["Esc"]} label="close" {...props} />;
}

/**
 * The Backspace key's hint: in an empty input it goes back a page. It renders only while the
 * Root's stack has a page to go back to.
 */
export function CommandBackHint(props: CommandHintPresetProps): ReactElement | null {
  const stack = use(CommandStackContext);
  if (!canGoBack(stack)) {
    return null;
  }
  return <KeyHint keys={["⌫"]} label="back" {...props} />;
}

CommandRoot.displayName = "Command.Root";
CommandTrigger.displayName = "Command.Trigger";
CommandContent.displayName = "Command.Content";
CommandInput.displayName = "Command.Input";
CommandBack.displayName = "Command.Back";
CommandList.displayName = "Command.List";
CommandEmpty.displayName = "Command.Empty";
CommandGroup.displayName = "Command.Group";
CommandLabel.displayName = "Command.Label";
CommandCollection.displayName = "Command.Collection";
CommandItem.displayName = "Command.Item";
CommandPage.displayName = "Command.Page";
CommandPageTrigger.displayName = "Command.PageTrigger";
CommandNavigateHint.displayName = "Command.NavigateHint";
CommandSelectHint.displayName = "Command.SelectHint";
CommandCloseHint.displayName = "Command.CloseHint";
CommandBackHint.displayName = "Command.BackHint";
