"use client";

import { createContext, use, useCallback, useLayoutEffect, useRef, useState } from "react";
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
// context, as combobox.tsx explains. Autocomplete shares those internals, so it also uses the
// package-root import.
import { Autocomplete as AutocompletePrimitive } from "@base-ui/react";
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
import { cn } from "../../styles/cn";
import {
  commandContentShellClass,
  commandListShellClass,
  commandRowsHandedOffListShellClass,
} from "../../styles/inner-corner/command";
import { mergeClassName } from "../../styles/merge-class-name";
import type { LabelButtonProps } from "../button/button";
import { DialogOverlay, DialogPortal, DialogTrigger } from "../dialog/dialog";
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
import type { CommandListRows, CommandRow } from "./command-list-context";
import { CommandHint } from "./command-markup";
import type { CommandHintProps } from "./command-markup";
import { CommandSearch } from "./command-search";
import type { CommandSearchProps, ItemGroup } from "./command-search";
import {
  canGoBack,
  CommandFocusRequestContext,
  CommandPageContext,
  CommandStackContext,
  useStack,
} from "./command-stack";
import type { CommandStackContextValue } from "./command-stack";
import { commandVariants } from "./command-variants";
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
  /** The dialog props `Command.Content` passes to its Dialog.Root, which they always control. */
  readonly dialog: Omit<CommandDialogStateProps, "defaultOpen">;
  /** Tells the Root a `Command.Content` is mounted, until the returned cleanup runs. */
  readonly registerContent: () => () => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

/**
 * Counts the dialog's closes. Each page's search resets an uncontrolled query when the count
 * changes.
 */
const CommandSessionContext = createContext(0);

/** Returns the enclosing Root's palette state, and throws a named error outside a Root. */
function usePalette(part: string): CommandPaletteContextValue {
  const palette = use(CommandPaletteContext);
  if (palette === null) {
    throw new CommandCompositionError(part, "outside-root");
  }
  return palette;
}

/** Returns the enclosing Root's stack, and throws a named error outside a Root with a stack. */
function useEnclosingStack(part: string): CommandStackContextValue {
  const stack = use(CommandStackContext);
  if (stack === null) {
    throw new CommandCompositionError(part, "outside-stack");
  }
  return stack;
}

/** The search props with every key absent, for a Root whose pages hold the searches. */
type CommandNoSearchProps = {
  [Key in keyof CommandSearchProps<unknown, readonly ItemGroup[], boolean>]?: never;
};

/** A stack of page ids, controlled with `pages` or uncontrolled from `defaultPages`. */
type CommandStackProps =
  | {
      /** The page ids from the first page to the one on top. Pass it to control the stack. */
      pages: readonly string[];
      defaultPages?: never;
      /** The Root calls it with the next stack after a push or a pop. */
      onPagesChange?: ((pages: string[]) => void) | undefined;
    }
  | {
      /** The page ids the stack starts with, from the first page to the one on top. */
      defaultPages: readonly string[];
      pages?: never;
      /** The Root calls it with the next stack after a push or a pop. */
      onPagesChange?: ((pages: string[]) => void) | undefined;
    };

/**
 * `Command.Root` takes the dialog's state props, plus either the search's props or a stack of
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

/**
 * The palette's state. Every palette starts here, and the Root renders no element. It holds the
 * dialog's open state for `Command.Trigger` and `Command.Content`, and takes Base UI Dialog Root's
 * `open`, `defaultOpen`, `onOpenChange` and the rest. Without a stack, the Root is the search.
 * That search is Base UI's Autocomplete, always open, with its list inline and the first match
 * always highlighted. It takes every Autocomplete prop, such as `items`, `value`, `filter` and
 * `virtualized`, and filters in the locale of `LocaleProvider`. With `defaultPages`, or `pages`
 * and `onPagesChange`, the Root holds a stack of page ids instead, and each `Command.Page` holds
 * its own search.
 *
 * Pass `grouped` when `items` are groups, and the callbacks receive one item of a group. Each
 * opening of the dialog starts fresh. When the close animation ends, an uncontrolled query goes
 * back to `defaultValue` and an uncontrolled stack goes back to `defaultPages`.
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
  // controlled. Remounting Content then cannot reopen a dialog the Root records as closed.
  const [ownOpen, setOwnOpen] = useState(defaultOpen ?? false);
  const isOpen = open ?? ownOpen;
  // An inline palette always shows; one in `Command.Content` shows while its dialog is open.
  const showing = !hasContent || isOpen;
  const stack = useStack(pages, defaultPages, onPagesChange, showing);
  const hasStack = pages !== undefined || defaultPages !== undefined;
  const palette: CommandPaletteContextValue = {
    handle,
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
      <CommandSessionContext.Provider value={session}>
        {hasStack ? (
          <CommandStackContext.Provider value={stack.context}>
            <CommandFocusRequestContext.Provider value={stack.focusRequest}>
              {children}
            </CommandFocusRequestContext.Provider>
          </CommandStackContext.Provider>
        ) : (
          // A Root without pages is a palette of its own, even inside an outer palette's page. Back
          // and Backspace find no stack to pop, and no page names its input or focuses it.
          <CommandStackContext.Provider value={null}>
            <CommandPageContext.Provider value={null}>
              <CommandSearch
                part="Command.Root"
                session={session}
                autoHighlight={autoHighlight}
                keepHighlight={keepHighlight}
                {...search}>
                {children}
              </CommandSearch>
            </CommandPageContext.Provider>
          </CommandStackContext.Provider>
        )}
      </CommandSessionContext.Provider>
    </CommandPaletteContext.Provider>
  );
}

/**
 * `Command.Page` takes its id and label, and the props of its own search.
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
  /** The page's name, which also names the page's `Command.Input` unless the input has its own. */
  label: string;
  /** The page's parts: its `Command.Input`, `Command.List` and the rest. */
  children?: ReactNode;
};

/**
 * One page of a Root's stack, such as a list of customers that opens one customer's actions. It
 * holds its own search, with the same props as a Root without a stack, and renders only while its
 * id is on top of the stack. So going back mounts the parent fresh, with an empty query and the
 * first match highlighted. To keep the parent's query, hold it above `Command.Root` and pass it to
 * the page as `value` with `onValueChange`. It throws outside a Root with a stack.
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
  const stack = useEnclosingStack("Command.Page");
  const session = use(CommandSessionContext);
  if (stack.stack.at(-1) !== id) {
    return null;
  }
  return (
    <CommandPageContext.Provider value={{ id, label }}>
      <CommandSearch
        part="Command.Page"
        session={session}
        autoHighlight={autoHighlight}
        keepHighlight={keepHighlight}
        {...search}>
        {children}
      </CommandSearch>
    </CommandPageContext.Provider>
  );
}

/** `Command.Trigger` takes Base UI Dialog Trigger's props, less the handle the Root supplies. */
export type CommandTriggerProps = Omit<ComponentProps<typeof DialogPrimitive.Trigger>, "handle" | "payload">;

/**
 * The button that opens `Command.Content`, as Dialog's own trigger does. Closing the palette
 * returns focus to it. Place it inside `Command.Root`, anywhere outside `Command.Content`.
 */
export function CommandTrigger(props: CommandTriggerProps): ReactElement {
  const { handle } = usePalette("Command.Trigger");
  return <DialogTrigger data-slot="command-trigger" handle={handle} {...props} />;
}

/** `Command.Content` takes Base UI Dialog Popup's props plus the portal container. */
export type CommandContentProps = ComponentProps<typeof DialogPrimitive.Popup> & OverlayContainerProps;

/**
 * The palette as a modal. It renders the Dialog's portal and overlay around a palette-wide popup
 * near the top of the viewport, with no close button. Only this part renders a dialog, so a
 * palette without it renders none, and a palette inline in a dialog of your own leaves that
 * dialog's parts bound to that dialog. Its name defaults to the locale dictionary's, and a
 * `Dialog.Title` inside it names it instead. Escape closes it from any page.
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

/**
 * Whether a key press is a Backspace that edits nothing, because the input is empty and no input
 * method is composing text.
 */
function isBackspaceOnEmpty(event: KeyboardEvent<HTMLInputElement>): boolean {
  // keyCode 229 marks an input method's key event, which some browsers send without `isComposing`.
  return (
    event.key === "Backspace" &&
    event.currentTarget.value === "" &&
    !event.nativeEvent.isComposing &&
    event.keyCode !== 229
  );
}

/**
 * `Command.Input` takes Base UI Autocomplete Input's props, with the class and children on the
 * group.
 */
export type CommandInputProps = Omit<
  ComponentProps<typeof AutocompletePrimitive.Input>,
  "className" | "children"
> & {
  /** Extra classes for the outer InputGroup, not the input element. */
  className?: string;
  /**
   * The group's addons, such as an `InputGroup.Addon` holding a `Kbd`. Without children the
   * input leads with a search icon, or with `Command.Back` on a page above the first.
   */
  children?: ReactNode;
};

/**
 * The palette's search field, an InputGroup around Base UI's Autocomplete input. Its name is
 * `aria-label`, else the enclosing `Command.Page`'s `label`, else the locale dictionary's. Its
 * placeholder defaults to the dictionary's. On a page above the first, Backspace in the empty
 * input goes back a page, and does nothing while an input method is composing text. When a
 * different page comes on top while the palette shows, that page's input takes focus as it
 * mounts, even after Suspense. An input that mounts when the page loads or the dialog opens
 * leaves focus where it is, or to the dialog's `initialFocus`. A stack change that keeps the
 * input's page on top leaves focus alone.
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
  const focusRequest = use(CommandFocusRequestContext);
  const inputRef = useRef<HTMLInputElement>(null);
  const mergedRef = useMergedRefs(ref, inputRef);
  const pageId = page?.id;
  // Read once, when the input first renders, so a later stack change never refocuses it.
  const [focusOnMount] = useState(() => pageId !== undefined && focusRequest?.page === pageId);
  const clearFocusPage = focusRequest?.clear;
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

/** `Command.Back` takes a label-sized Button's props, with the size and icon fixed. */
export type CommandBackProps = Omit<LabelButtonProps, "size" | "children"> & {
  /**
   * The accessible name. An explicit `aria-label` wins over it, and both default to the locale
   * dictionary's.
   */
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

/** `Command.List` takes Base UI Autocomplete List's props. */
export type CommandListProps = ComponentProps<typeof AutocompletePrimitive.List>;

type CommandListRender = NonNullable<CommandListProps["render"]>;

type CommandListRenderProps = Parameters<Extract<CommandListRender, (...args: never[]) => ReactElement>>;

/**
 * The element that `Command.List`'s `render` value renders. It is a listbox `div` whose children
 * are the rows.
 */
type CommandListTargetType = ComponentType<
  Omit<ComponentPropsWithRef<"div">, "children"> & { children?: CommandListRows }
>;

/**
 * Renders `Command.List`'s `render` value with Base UI's listbox props and the row function as
 * `children`. It uses Base UI's `useRender`, which takes an element, a function, or the lazy
 * element React passes when a Server Component sets the `render` prop. It marks its subtree as
 * `Command.List`'s render target, which `CommandVirtual.List` checks.
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
 * The scrolling list of results. It pads its rows with the small surface gap, `--surface-gap-sm`,
 * and publishes the palette's `rounded-xl` less that padding as `--inner-corner`. Given a `render`
 * value and a row function, it passes the row function to the rendered element as `children`,
 * with Base UI's listbox props and no rendered rows. The element then decides which rows mount,
 * as `CommandVirtual.List` does. Given other children, `render` keeps Base UI's meaning, with or
 * without `virtualized`, so a virtualizer of your own can pass indexed `Command.Item` elements. A
 * virtualized search throws on a row function without a `render` value, since the list would
 * mount every row without the index that Base UI's navigation reads.
 */
export function CommandList({ className, ...props }: CommandListProps): ReactElement {
  const search = use(CommandSearchContext);
  const { render, children: rows, ...listProps } = props;
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Base UI's public children contract accepts nodes or a row function.
  const hasRowFunction = typeof rows === "function";
  if (render !== undefined && hasRowFunction) {
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
  if (search?.virtualized === true && hasRowFunction) {
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

/** `Command.Item` takes Base UI Autocomplete Item's props. */
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
 * One result row. Its `onClick` runs on a click, and on Enter while the row is highlighted. Base
 * UI's `data-highlighted` is its only highlight. Give it a `value` when the search has no `items`.
 * When it shows a `Command.Shortcut`, put the same shortcut in its `aria-keyshortcuts`. In a
 * virtual list it takes its index, position and measurement from the list.
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

/** `Command.PageTrigger` takes `Command.Item`'s props plus the page it opens. */
export type CommandPageTriggerProps = CommandItemProps & {
  /** The id of the `Command.Page` this row opens. */
  page: string;
};

/**
 * A row that opens a page of the Root's stack on click or Enter, with a chevron at its end. Call
 * `preventDefault()` in `onClick` to keep the page closed. It throws outside a Root with a stack.
 */
export function CommandPageTrigger({
  page,
  onClick,
  children,
  ...props
}: CommandPageTriggerProps): ReactElement {
  const stack = useEnclosingStack("Command.PageTrigger");
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

/** The key hint presets take `Command.Hint`'s props, with children as the label. */
export type CommandHintPresetProps = Omit<CommandHintProps, "children"> & {
  /** The hint's label, in place of the locale dictionary's. */
  children?: ReactNode;
};

/** One key hint preset's caps, and the dictionary key of its default label. */
type KeyHintProps = CommandHintPresetProps & {
  readonly keys: readonly string[];
  readonly label: "navigate" | "select" | "close" | "back";
};

/** Renders a key hint preset's caps, then its label or the locale dictionary's. */
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

/** The hint for the arrow keys, which move the highlight. */
export function CommandNavigateHint(props: CommandHintPresetProps): ReactElement {
  return <KeyHint keys={["↑", "↓"]} label="navigate" {...props} />;
}

/** The hint for Enter, which runs the highlighted row. */
export function CommandSelectHint(props: CommandHintPresetProps): ReactElement {
  return <KeyHint keys={["↵"]} label="select" {...props} />;
}

/** The hint for Escape, which closes `Command.Content`. */
export function CommandCloseHint(props: CommandHintPresetProps): ReactElement {
  return <KeyHint keys={["Esc"]} label="close" {...props} />;
}

/**
 * The hint for Backspace, which goes back a page from an empty input. It renders only while the
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
