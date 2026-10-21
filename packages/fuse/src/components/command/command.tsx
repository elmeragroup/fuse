"use client";

import { createContext, Fragment, use, useCallback, useLayoutEffect, useRef, useState } from "react";
import type {
  ComponentProps,
  ComponentPropsWithRef,
  ComponentType,
  CSSProperties,
  ReactElement,
  ReactNode,
} from "react";

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
import { isBackspaceOnEmpty } from "../../internal/is-backspace-on-empty";
import { cn } from "../../styles/cn";
import { commandContentShellClass, commandListShellClass } from "../../styles/inner-corner/command";
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
import { overlayCloseStrings } from "../overlay/intl";
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
  /**
   * The count of sessions, which advances when a close animation ends or an opening interrupts a
   * close. A change resets each search's uncontrolled query and highlight, and mounts
   * `Command.Content`'s children fresh.
   */
  readonly session: number;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

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
 * opening of the dialog starts fresh, even one that interrupts the close animation. An
 * uncontrolled query goes back to `defaultValue`, an uncontrolled stack goes back to
 * `defaultPages`, the highlight goes back to the first match, and `Command.Content`'s children
 * mount fresh. The Trigger and anything else outside `Command.Content` keep their state.
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
  grouped = false,
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
  const stack = useStack(pages, defaultPages, onPagesChange, showing, isOpen);
  // A new session resets each search's uncontrolled query and highlight, and mounts
  // `Command.Content`'s children fresh. It always comes with a reset of an uncontrolled stack.
  const startSession = () => {
    setSession((count) => count + 1);
    stack.reset();
  };
  // Base UI ends a close with `onOpenChangeComplete(false)`, which moves the phase from closing
  // to closed and starts the next opening fresh. An opening during the closing phase aborts that
  // callback and keeps the closing popup with its contents, so the Root starts a session here
  // instead, during render as React's docs adjust state from a changed prop. Only a mounted
  // `Command.Content` enters the closing phase, so `open` flipping on an inline palette, or
  // before a late Content mounts, starts nothing.
  const [phase, setPhase] = useState<"open" | "closing" | "closed">(isOpen ? "open" : "closed");
  if ((phase === "open") !== isOpen) {
    if (isOpen && phase === "closing") {
      startSession();
    }
    setPhase(isOpen ? "open" : hasContent ? "closing" : "closed");
  }
  const hasStack = pages !== undefined || defaultPages !== undefined;
  const palette: CommandPaletteContextValue = {
    handle,
    registerContent,
    session,
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
          setPhase((current) => (current === "closing" ? "closed" : current));
          startSession();
        }
      },
    },
  };
  return (
    <CommandPaletteContext.Provider value={palette}>
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
              grouped={grouped}
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
  grouped = false,
  autoHighlight = "always",
  keepHighlight = true,
  children,
  ...search
}: CommandPageProps<Item, Groups, Grouped>): ReactElement | null {
  const stack = useEnclosingStack("Command.Page");
  const { session } = usePalette("Command.Page");
  if (stack.stack.at(-1) !== id) {
    return null;
  }
  return (
    <CommandPageContext.Provider value={{ id, label }}>
      <CommandSearch
        part="Command.Page"
        session={session}
        grouped={grouped}
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
 * `Dialog.Title` inside it names it instead. Escape closes it from any page. An opening that
 * interrupts the close animation keeps the popup and mounts its children fresh. Content that a
 * `render` element or function writes itself keeps its state then, so pass the palette's parts as
 * children.
 * It may mount late, such as on the first opening from a code-split chunk, but keep it mounted
 * while the Root lives: the end of its close animation is what resets an uncontrolled query and
 * stack.
 */
export function CommandContent({
  className,
  container,
  "aria-label": ariaLabel,
  children,
  ...props
}: CommandContentProps): ReactElement {
  const strings = useLocalizedStrings(commandStrings);
  const { handle, dialog, registerContent, session } = usePalette("Command.Content");
  useLayoutEffect(registerContent, [registerContent]);
  // A new session mounts the children fresh, even in a popup an opening kept from its close. The
  // popup itself stays, so its focus manager keeps the element focus returns to on close. Absent
  // children stay absent, so a `render` target's own default children still show, and `render`
  // passes through untouched: content it writes itself keeps its state.
  const sessionChildren = children === undefined ? undefined : <Fragment key={session}>{children}</Fragment>;
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
          {...definedProps({ ...props, children: sessionChildren })}
        />
      </OverlayPortal>
    </DialogPrimitive.Root>
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
        className={mergeClassName(className, styles.list(), commandListShellClass)}
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

/**
 * A polite live region for the search's state, such as "Searching…", an error or the number of
 * results. Screen readers announce each change of its children. It announces only while it stays
 * mounted, so render the message as its children and leave it empty when there is nothing to say.
 * Place it between `Command.Input` and `Command.List`.
 */
export function CommandStatus({
  className,
  ...props
}: ComponentProps<typeof AutocompletePrimitive.Status>): ReactElement {
  return (
    <AutocompletePrimitive.Status
      data-slot="command-status"
      className={mergeClassName(className, styles.status())}
      {...props}
    />
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

/** One key hint preset's caps, and its label from a locale dictionary. */
type KeyHintProps = CommandHintPresetProps & {
  readonly keys: readonly string[];
  readonly defaultLabel: string;
};

/** Renders a key hint preset's caps, then its label or the locale dictionary's. */
function KeyHint({ keys, defaultLabel, children, ...props }: KeyHintProps): ReactElement {
  return (
    <CommandHint {...props}>
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
      <span>{children ?? defaultLabel}</span>
    </CommandHint>
  );
}

/** The hint for the arrow keys, which move the highlight. */
export function CommandNavigateHint(props: CommandHintPresetProps): ReactElement {
  const strings = useLocalizedStrings(commandStrings);
  return <KeyHint keys={["↑", "↓"]} defaultLabel={strings.format("navigate")} {...props} />;
}

/** The hint for Enter, which runs the highlighted row. */
export function CommandSelectHint(props: CommandHintPresetProps): ReactElement {
  const strings = useLocalizedStrings(commandStrings);
  return <KeyHint keys={["↵"]} defaultLabel={strings.format("select")} {...props} />;
}

/** The hint for Escape, which closes `Command.Content`. Its label is the overlays' `close` word. */
export function CommandCloseHint(props: CommandHintPresetProps): ReactElement {
  const strings = useLocalizedStrings(overlayCloseStrings);
  return <KeyHint keys={["Esc"]} defaultLabel={strings.format("close")} {...props} />;
}

/**
 * The hint for Backspace, which goes back a page from an empty input. It renders only while the
 * Root's stack has a page to go back to.
 */
export function CommandBackHint(props: CommandHintPresetProps): ReactElement | null {
  const strings = useLocalizedStrings(commandStrings);
  const stack = use(CommandStackContext);
  if (!canGoBack(stack)) {
    return null;
  }
  return <KeyHint keys={["⌫"]} defaultLabel={strings.format("back")} {...props} />;
}

CommandRoot.displayName = "Command.Root";
CommandTrigger.displayName = "Command.Trigger";
CommandContent.displayName = "Command.Content";
CommandInput.displayName = "Command.Input";
CommandBack.displayName = "Command.Back";
CommandList.displayName = "Command.List";
CommandEmpty.displayName = "Command.Empty";
CommandStatus.displayName = "Command.Status";
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
