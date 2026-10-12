"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentProps, CSSProperties, ReactElement, ReactNode, RefObject } from "react";

// Subpath imports of Base UI's combobox family type-check but crash at runtime with a null React
// context (see combobox.tsx). Autocomplete shares those internals, so it keeps the package-root
// import too.
import { Autocomplete as AutocompletePrimitive } from "@base-ui/react";
import type { AutocompleteRootProps } from "@base-ui/react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { useMergedRefs } from "../../hooks/use-merged-refs";
import { ArrowLeft } from "../../icons/generated/arrow-left";
import { CaretRight } from "../../icons/generated/caret-right";
import { MagnifyingGlass } from "../../icons/generated/magnifying-glass";
import { definedProps } from "../../internal/defined-props";
import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import { commandDialogShellClass, commandListShellClass } from "../../styles/inner-corner/command";
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
import { overlayLayer, overlayPopupSurfaceClass } from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps } from "../overlay/overlay-props";
import { CommandHint } from "./command-markup";
import type { CommandHintProps } from "./command-markup";
import { CommandRowContext } from "./command-row-context";
import type { CommandRow } from "./command-row-context";
import { commandVariants } from "./command-variants";
import { commandStrings } from "./intl";

const styles = commandVariants();

type CommandPagesContextValue = {
  /** The page ids from the first page to the one on top. */
  readonly stack: readonly string[];
  /** Puts a page on top of the stack. */
  readonly push: (page: string) => void;
  /** Takes the top page off the stack, unless it is the only one. */
  readonly pop: () => void;
  /** `true` once the stack has committed its first render, so a page mounted later is a swap. */
  readonly settled: RefObject<boolean>;
};

const CommandPagesContext = createContext<CommandPagesContextValue | null>(null);

type CommandPageContextValue = {
  readonly label: string;
};

const CommandPageContext = createContext<CommandPageContextValue | null>(null);

type CommandPagesSharedProps = {
  /** The pages: one `Command.Page` per id the stack can hold. */
  children?: ReactNode;
  /** Called with the next stack when a page is pushed or popped. */
  onValueChange?: (value: string[]) => void;
};

/** Props of `Command.Pages`: a controlled `value` or an uncontrolled `defaultValue`, never both. */
export type CommandPagesProps = CommandPagesSharedProps &
  (
    | {
        /** The page ids from the first page to the one on top. Use when controlled. */
        value: string[];
        defaultValue?: never;
      }
    | {
        /** The page ids the stack starts with, from the first page to the one on top. */
        defaultValue: string[];
        value?: never;
      }
  );

/**
 * A stack of palette pages, such as a list of customers that opens one customer's actions.
 * The first id is the first page, and only the page whose id is on top renders.
 * `Command.PageTrigger` pushes a page. Backspace in an empty input and `Command.Back` pop it,
 * never past the first. Works with or without `Command.Dialog`. Control the stack with `value`
 * and `onValueChange` to pop it from outside, such as on Escape.
 */
export function CommandPages({
  value,
  defaultValue,
  onValueChange,
  children,
}: CommandPagesProps): ReactElement {
  const [uncontrolled, setUncontrolled] = useState<readonly string[]>(defaultValue ?? []);
  const stack = value ?? uncontrolled;
  const settled = useRef(false);
  useEffect(() => {
    settled.current = true;
    return () => {
      settled.current = false;
    };
  }, []);
  const change = useCallback(
    (next: string[]) => {
      if (value === undefined) {
        setUncontrolled(next);
      }
      onValueChange?.(next);
    },
    [value, onValueChange]
  );
  const context = useMemo(
    () => ({
      stack,
      push: (page: string) => {
        change([...stack, page]);
      },
      pop: () => {
        if (stack.length > 1) {
          change(stack.slice(0, -1));
        }
      },
      settled,
    }),
    [stack, change]
  );
  return <CommandPagesContext.Provider value={context}>{children}</CommandPagesContext.Provider>;
}

/** Props of `Command.Page`. */
export type CommandPageProps = {
  /** The id `Command.PageTrigger` pushes and the stack holds. */
  id: string;
  /** The page's name. The page's `Command.Input` is named after it unless it has a name of its own. */
  label: string;
  /** The page's own `Command.Root` and its parts. */
  children?: ReactNode;
};

/**
 * One level of a `Command.Pages` stack. Only the top page renders, so going back mounts the
 * parent fresh: empty query, first match highlighted. To keep the parent's query, hold it
 * above `Command.Pages` and pass it to the page's `Command.Root` as `value`.
 */
export function CommandPage({ id, label, children }: CommandPageProps): ReactElement | null {
  const pages = use(CommandPagesContext);
  if (pages === null) {
    throw new Error("Command.Page must be used within Command.Pages.");
  }
  const context = useMemo(() => ({ label }), [label]);
  if (pages.stack.at(-1) !== id) {
    return null;
  }
  return <CommandPageContext.Provider value={context}>{children}</CommandPageContext.Provider>;
}

/** Whether a stack holds a page below the one on top. */
function canGoBack(pages: CommandPagesContextValue | null): pages is CommandPagesContextValue {
  return pages !== null && pages.stack.length > 1;
}

/**
 * Props of `Command.Root`: Base UI Autocomplete Root's flat overload for `Item`, less `locale`,
 * which `LocaleProvider` sets. `items` is a flat list; groups belong in `Command.GroupedRoot`.
 *
 * @template Item - The type of one item.
 */
export type CommandRootProps<Item> = Omit<AutocompleteRootProps<Item>, "items" | "locale"> & {
  /** The items, as a flat list, in the order the list shows them. */
  items?: readonly Item[] | undefined;
};

/**
 * Props of `Command.GroupedRoot`: Base UI Autocomplete Root's grouped overload, less `locale`,
 * which `LocaleProvider` sets. The callbacks, such as `itemToStringValue` and
 * `onItemHighlighted`, receive one item of a group.
 *
 * @template Items - The groups passed in `items`, each with its own `items` list.
 */
export type CommandGroupedRootProps<Items extends readonly { readonly items: readonly unknown[] }[]> = Omit<
  AutocompleteRootProps<Items[number]["items"][number]>,
  "items" | "locale"
> & {
  /** The groups of items, in the order the list shows them. */
  items: Items;
};

/**
 * The palette's state for a flat list of items: the query, the filtering and the highlighted
 * item. Base UI's Autocomplete, always open with its list inline, and the first match always
 * highlighted. Every Autocomplete prop passes through: `items`, `value`, `onValueChange`,
 * `filter`, `filteredItems`, `mode`. Renders no element. Filters with Base UI's own matcher in
 * the locale of `LocaleProvider`. It types its props as Base UI's flat overload does; pass
 * groups of items to `Command.GroupedRoot` instead.
 */
export function CommandRoot<Item>({
  inline = true,
  open = true,
  autoHighlight = "always",
  keepHighlight = true,
  ...props
}: CommandRootProps<Item>): ReactElement {
  const { locale } = useLocale();
  return (
    <AutocompletePrimitive.Root
      inline={inline}
      open={open}
      autoHighlight={autoHighlight}
      keepHighlight={keepHighlight}
      {...props}
      locale={locale}
    />
  );
}

/**
 * `Command.Root` for groups of items, such as actions under "Create" and "Go to". It takes the
 * same defaults and props, typed as Base UI's grouped overload types them: `items` is required,
 * and the callbacks receive one item of a group, never a group. Render each group with
 * `Command.Group` and its own `items`.
 */
export function CommandGroupedRoot<Items extends readonly { readonly items: readonly unknown[] }[]>({
  inline = true,
  open = true,
  autoHighlight = "always",
  keepHighlight = true,
  ...props
}: CommandGroupedRootProps<Items>): ReactElement {
  const { locale } = useLocale();
  return (
    <AutocompletePrimitive.Root
      inline={inline}
      open={open}
      autoHighlight={autoHighlight}
      keepHighlight={keepHighlight}
      {...props}
      locale={locale}
    />
  );
}

/** Whether a key press is a Backspace that edits nothing: the input is empty and no IME text is composing. */
function isBackspaceOnEmpty(event: {
  readonly key: string;
  readonly keyCode: number;
  readonly currentTarget: HTMLInputElement;
  readonly nativeEvent: KeyboardEvent;
}): boolean {
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
 * input goes back a page; it does nothing while IME text is composing. The input that a page
 * swap mounts takes focus, since the dialog placed focus before the swap.
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
  const pages = use(CommandPagesContext);
  const page = use(CommandPageContext);
  const inputRef = useRef<HTMLInputElement>(null);
  const mergedRef = useMergedRefs(ref, inputRef);
  const settled = pages?.settled;
  useLayoutEffect(() => {
    if (settled?.current === true) {
      inputRef.current?.focus();
    }
  }, [settled]);
  return (
    <InputGroupRoot data-slot="command-input" className={cn(styles.input(), className)}>
      <AutocompletePrimitive.Input
        ref={mergedRef}
        aria-label={ariaLabel ?? page?.label ?? strings.format("inputLabel")}
        placeholder={placeholder ?? strings.format("placeholder")}
        render={<InputGroupPlainInput />}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && canGoBack(pages) && isBackspaceOnEmpty(event)) {
            event.preventDefault();
            pages.pop();
          }
        }}
        {...definedProps(props)}
      />
      {children ?? (
        <InputGroupAddon>{canGoBack(pages) ? <CommandBack /> : <MagnifyingGlass />}</InputGroupAddon>
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
 * An InputGroup button that goes back a page. It renders nothing on the first page or outside
 * `Command.Pages`. Place it in an `InputGroup.Addon` among `Command.Input`'s children.
 */
export function CommandBack({
  label,
  "aria-label": ariaLabel,
  onClick,
  ...props
}: CommandBackProps): ReactElement | null {
  const strings = useLocalizedStrings(commandStrings);
  const pages = use(CommandPagesContext);
  if (!canGoBack(pages)) {
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
          pages.pop();
        }
      }}
      {...props}>
      <ArrowLeft />
    </InputGroupButton>
  );
}

/**
 * The scrolling list of results. It pads its rows with the small surface tier and publishes the
 * palette's `rounded-xl` less that padding as `--inner-corner`.
 */
export function CommandList({
  className,
  ...props
}: ComponentProps<typeof AutocompletePrimitive.List>): ReactElement {
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
export function CommandGroupLabel({
  className,
  ...props
}: ComponentProps<typeof AutocompletePrimitive.GroupLabel>): ReactElement {
  return (
    <AutocompletePrimitive.GroupLabel
      data-slot="command-group-label"
      className={mergeClassName(className, menuGroupLabelClass)}
      {...props}
    />
  );
}

/** Renders the filtered items of the enclosing Root or Group through its child function. */
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
    "aria-posinset": row.posInSet,
    style: withRowStyle(row.style, style),
  };
}

/**
 * One result row. Its `onClick` runs on a click and on Enter while it is highlighted; Base UI's
 * `data-highlighted` is its only highlight. Give it a `value` when the Root has no `items`. Put a
 * shortcut it carries in `aria-keyshortcuts` beside a `Command.Shortcut`. Inside
 * `CommandVirtual.List` it takes its index, position and measurement from the list.
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
 * A row that opens a page of the enclosing `Command.Pages` on click or Enter, with a chevron at
 * its end. Call `preventDefault()` in `onClick` to keep the page closed.
 */
export function CommandPageTrigger({
  page,
  onClick,
  children,
  ...props
}: CommandPageTriggerProps): ReactElement {
  const pages = use(CommandPagesContext);
  if (pages === null) {
    throw new Error("Command.PageTrigger must be used within Command.Pages.");
  }
  return (
    <CommandItem
      data-slot="command-page-trigger"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          pages.push(page);
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

/** The arrow keys' hint: they move the highlight. */
export function CommandNavigateHint({ children, ...props }: CommandHintPresetProps): ReactElement {
  const strings = useLocalizedStrings(commandStrings);
  return (
    <CommandHint {...props}>
      <Kbd>↑</Kbd>
      <Kbd>↓</Kbd>
      <span>{children ?? strings.format("navigate")}</span>
    </CommandHint>
  );
}

/** The Enter key's hint: it runs the highlighted row. */
export function CommandSelectHint({ children, ...props }: CommandHintPresetProps): ReactElement {
  const strings = useLocalizedStrings(commandStrings);
  return (
    <CommandHint {...props}>
      <Kbd>↵</Kbd>
      <span>{children ?? strings.format("select")}</span>
    </CommandHint>
  );
}

/** The Escape key's hint: it closes `Command.Dialog`. */
export function CommandCloseHint({ children, ...props }: CommandHintPresetProps): ReactElement {
  const strings = useLocalizedStrings(commandStrings);
  return (
    <CommandHint {...props}>
      <Kbd>Esc</Kbd>
      <span>{children ?? strings.format("close")}</span>
    </CommandHint>
  );
}

/**
 * The Backspace key's hint: in an empty input it goes back a page. It renders only while the
 * enclosing `Command.Pages` has a page to go back to.
 */
export function CommandBackHint({ children, ...props }: CommandHintPresetProps): ReactElement | null {
  const strings = useLocalizedStrings(commandStrings);
  const pages = use(CommandPagesContext);
  if (!canGoBack(pages)) {
    return null;
  }
  return (
    <CommandHint {...props}>
      <Kbd>⌫</Kbd>
      <span>{children ?? strings.format("back")}</span>
    </CommandHint>
  );
}

/** Props of `Command.Dialog`: Base UI Dialog Popup's plus the portal container. */
export type CommandDialogProps = ComponentProps<typeof DialogPrimitive.Popup> & OverlayContainerProps;

/**
 * The palette as a modal: the Dialog's portal and overlay around a palette-wide popup anchored
 * near the top of the viewport, with no close button. Place it inside `Dialog.Root` and the
 * palette's `Command.Root` inside it. Its name defaults to the locale dictionary; a
 * `Dialog.Title` inside it names it instead. Escape closes it from any page.
 */
export function CommandDialog({
  className,
  container,
  "aria-label": ariaLabel,
  ...props
}: CommandDialogProps): ReactElement | null {
  const strings = useLocalizedStrings(commandStrings);
  return (
    <OverlayPortal portal={DialogPortal} container={container}>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="command-dialog"
        aria-label={ariaLabel ?? strings.format("dialogLabel")}
        className={mergeClassName(
          className,
          overlayPopupSurfaceClass,
          commandDialogShellClass,
          styles.dialog(),
          overlayLayer,
          selfFocusRingClass
        )}
        {...definedProps(props)}
      />
    </OverlayPortal>
  );
}

CommandRoot.displayName = "Command.Root";
CommandGroupedRoot.displayName = "Command.GroupedRoot";
CommandInput.displayName = "Command.Input";
CommandBack.displayName = "Command.Back";
CommandList.displayName = "Command.List";
CommandEmpty.displayName = "Command.Empty";
CommandGroup.displayName = "Command.Group";
CommandGroupLabel.displayName = "Command.GroupLabel";
CommandCollection.displayName = "Command.Collection";
CommandItem.displayName = "Command.Item";
CommandPageTrigger.displayName = "Command.PageTrigger";
CommandPages.displayName = "Command.Pages";
CommandPage.displayName = "Command.Page";
CommandNavigateHint.displayName = "Command.NavigateHint";
CommandSelectHint.displayName = "Command.SelectHint";
CommandCloseHint.displayName = "Command.CloseHint";
CommandBackHint.displayName = "Command.BackHint";
CommandDialog.displayName = "Command.Dialog";
