"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

// Subpath import (`@base-ui/react/autocomplete`) type-checks but crashes at runtime with a
// null React context. Keep the package-root import until upstream fixes it.
import { Autocomplete as AutocompletePrimitive } from "@base-ui/react";
import type { AutocompleteRootProps as AutocompletePrimitiveRootProps } from "@base-ui/react";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { CaretDown } from "../../icons/generated/caret-down";
import { X } from "../../icons/generated/x";
import { definedProps } from "../../internal/defined-props";
import type { ListItemOf, ListItems } from "../../internal/list-items";
import { pressesRegion } from "../../internal/own-click";
import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import {
  InputGroupAddon,
  InputGroupButton,
  InputGroupPlainInput,
  InputGroupRoot,
} from "../input-group/input-group";
import type { InputGroupRootProps } from "../input-group/input-group";
import { overlayPositionerClass } from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps, OverlayPositionerProps } from "../overlay/overlay-props";
import { autocompleteVariants } from "./autocomplete-variants";
import { autocompleteStrings } from "./intl";

const styles = autocompleteVariants();

/**
 * `Autocomplete.Root` takes Base UI Autocomplete Root's props, without `locale`.
 *
 * @template ItemValue - One item of `items`, which `itemToStringValue` receives.
 */
export type AutocompleteRootProps<ItemValue = unknown> = Omit<
  AutocompletePrimitiveRootProps<ItemValue>,
  "locale"
>;

/**
 * The field's state, which renders no element. Its value is the text in the input, whether the
 * user typed it or picked a suggestion.
 *
 * @template Items - The `items` array, flat or of groups.
 * @template Filtered - The `filteredItems` array, flat or of groups.
 * @template ItemValue - One item of `items`, which `itemToStringValue` receives. `items` decides
 * it; without `items`, `filteredItems` does; when neither is given, an annotated callback such as
 * `itemToStringValue` or `onItemHighlighted` sets it.
 */
export function AutocompleteRoot<
  Items extends readonly unknown[] = readonly never[],
  Filtered extends readonly unknown[] = readonly never[],
  ItemValue = ListItemOf<Items extends readonly never[] ? Filtered : Items>,
>(
  // `NoInfer` checks `items` and `filteredItems` against `ItemValue` without inferring it from
  // either, so `ItemValue` takes its default from the array that decides it.
  props: Omit<
    AutocompleteRootProps<ItemValue>,
    "items" | "filteredItems" | "value" | "onValueChange" | "name" | "id" | "filter"
  > & {
    /**
     * The items to suggest: a flat array, or an array of groups that each carry their own
     * `items`. With groups, `itemToStringValue` receives one item of a group. Nullish entries are
     * not supported. Base UI filters them against the text in the locale of `LocaleProvider`.
     */
    items?: (Items & NoInfer<ListItems<Items, ItemValue>>) | undefined;
    /**
     * The items the list shows, for filtering outside the list, such as with Base UI's
     * `useFilter()` hook. When given, the list shows these and does not filter `items` itself.
     * With `items` also given, this array keeps its own flat or grouped structure. Nullish
     * entries are not supported, as in `items`.
     */
    filteredItems?: (Filtered & NoInfer<ListItems<Filtered, ItemValue>>) | undefined;
    /**
     * The text in the input, for a controlled field. A picked item fills it with
     * `itemToStringValue(item)`, or with its `label` when the item is a `{ value, label }` object,
     * and the user can go on editing it. Text that matches no item stays on blur and submits as
     * it is. For an answer that must be one of the options, use Combobox.
     */
    value?: AutocompleteRootProps<ItemValue>["value"];
    /**
     * Called with the input's text on every change. It receives only the string, so capture a
     * picked item in `Autocomplete.Item`'s `onClick`.
     */
    onValueChange?: AutocompleteRootProps<ItemValue>["onValueChange"];
    /**
     * The `name` the input's text submits under. Inside a `Field.Root`, the field's name, label,
     * description and `Form` errors reach the input, and the text submits under the field's name.
     */
    name?: AutocompleteRootProps<ItemValue>["name"];
    /**
     * The id `Field.Label` points at. Inside a `Field`, set `id` here rather than on
     * `Autocomplete.Input`.
     */
    id?: AutocompleteRootProps<ItemValue>["id"];
    /**
     * The function that matches items against the text. For a search that runs elsewhere, such as
     * on a server, pass `filter={null}` and the results as `items`, and the list shows them as
     * given.
     */
    filter?: AutocompleteRootProps<ItemValue>["filter"];
  }
): ReactElement {
  const { locale } = useLocale();
  // SAFETY: `ItemValue` is the item type Base UI's own overloads infer from the same `items`
  // (flat, or one item of a group), or from `filteredItems` without `items`, so each callback
  // receives the items Base UI passes it. TypeScript cannot match the `items` and `filteredItems`
  // intersections to one of those overloads while the type parameters are generic, so this erases
  // them.
  const rootProps = props as AutocompleteRootProps;
  return <AutocompletePrimitive.Root {...rootProps} locale={locale} />;
}

/** A button that opens and closes the popup, with a caret that turns while it is open. */
export function AutocompleteTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof AutocompletePrimitive.Trigger>): ReactElement {
  return (
    <AutocompletePrimitive.Trigger
      data-slot="autocomplete-trigger"
      className={mergeClassName(className, styles.trigger())}
      {...definedProps(props)}>
      {children}
      <CaretDown className={styles.caret()} />
    </AutocompletePrimitive.Trigger>
  );
}

/** The props of {@link AutocompleteClear}. */
export type AutocompleteClearProps = ComponentProps<typeof AutocompletePrimitive.Clear> & {
  /**
   * The accessible name of the icon-only clear button. An `aria-label` wins over it. Unset, the
   * name is the locale dictionary's `clear` string.
   */
  label?: string;
};

/** An icon button that empties the input. It shows only while the input holds text. */
export function AutocompleteClear({
  className,
  label,
  "aria-label": ariaLabel,
  ...props
}: AutocompleteClearProps): ReactElement {
  const strings = useLocalizedStrings(autocompleteStrings);
  // The render element's props win in Base UI's merge, so the resolved name must live there.
  const accessibleName = ariaLabel ?? label ?? strings.format("clear");
  return (
    <AutocompletePrimitive.Clear
      data-slot="autocomplete-clear"
      render={<InputGroupButton variant="ghost" size="icon-sm" aria-label={accessibleName} />}
      aria-label={accessibleName}
      className={mergeClassName(className)}
      {...definedProps(props)}>
      <X className="pointer-events-none" />
    </AutocompletePrimitive.Clear>
  );
}

/** The props of {@link AutocompleteInput}. */
export type AutocompleteInputProps = Omit<
  ComponentProps<typeof AutocompletePrimitive.Input>,
  "children" | "className" | "size"
> & {
  /**
   * The control size of the field box, the outer InputGroup, emitted as `data-size`. `default` is
   * the md control size, and `sm` the sm one. It replaces the native numeric `size` attribute, so
   * set the width with a class.
   */
  size?: InputGroupRootProps["size"];
  /**
   * The input's id. Inside a `Field`, set `id` on `Autocomplete.Root` instead. `Field.Label`
   * points at the Root's id, so an id here leaves the label's `for` unmatched.
   */
  id?: string;
  /**
   * Renders the caret button in the inline-end addon. The list opens as the user types, so the
   * field has no caret unless you pass this. The caret hides while the group holds a clear
   * button.
   */
  showTrigger?: boolean;
  /**
   * Renders `Autocomplete.Clear` in the inline-end addon. It shows while the input holds text,
   * and the caret hides while it shows.
   */
  showClear?: boolean;
  /**
   * Disables the input and its caret and clear buttons. `disabled` on `Autocomplete.Root` or
   * `Field.Root` disables the input too.
   */
  disabled?: boolean;
  /** Extra classes for the outer InputGroup, which is `w-auto`, not for the input element. */
  className?: string;
  /** Content after the inline-end addon inside the InputGroup, such as an `InputGroup.Addon` of your own. */
  children?: ReactNode;
  /**
   * The accessible name of the clear button that `showClear` renders. Unset, it is the locale
   * dictionary's `clear` string.
   */
  clearLabel?: string;
  /**
   * The accessible name of the caret button that `showTrigger` renders. Unset, it is the locale
   * dictionary's `toggle` string.
   */
  triggerLabel?: string;
};

/**
 * The text field, an InputGroup around Base UI's Autocomplete input. The input carries the
 * Root's `name`, so the form submits its text, and the popup takes the InputGroup's width.
 */
export function AutocompleteInput({
  className,
  children,
  disabled = false,
  showTrigger = false,
  showClear = false,
  clearLabel,
  triggerLabel,
  size = "default",
  ...props
}: AutocompleteInputProps): ReactElement {
  const strings = useLocalizedStrings(autocompleteStrings);
  return (
    // Base UI's InputGroup anchors the popup to the whole field box, not the input inside it.
    <AutocompletePrimitive.InputGroup
      render={<InputGroupRoot size={size} className={cn("w-auto", className)} />}
      // A press on the field box outside a control focuses the input and, under
      // `openOnInputClick`, opens the popup. Base UI skips that only for a disabled Root or Field
      // and for the controls it knows, so skip it for this Input too, for a nested element that
      // owns its press, such as a label in a custom addon, and for one from a portal.
      onMouseDown={(event) => {
        if (disabled || !pressesRegion(event.target, event.currentTarget)) {
          event.preventBaseUIHandler();
        }
      }}>
      <AutocompletePrimitive.Input
        disabled={disabled}
        render={<InputGroupPlainInput />}
        {...definedProps(props)}
      />
      {showTrigger || showClear ? (
        <InputGroupAddon align="inline-end">
          {showTrigger ? (
            <InputGroupButton
              size="icon-sm"
              variant="ghost"
              aria-label={triggerLabel ?? strings.format("toggle")}
              // Field.Label labelledby would win over aria-label. An empty list overrides it,
              // so the caret stays dictionary `toggle`.
              aria-labelledby=""
              render={<AutocompleteTrigger />}
              data-slot="input-group-button"
              className={styles.inputTrigger()}
              disabled={disabled}
            />
          ) : null}
          {showClear ? <AutocompleteClear disabled={disabled} label={clearLabel} /> : null}
        </InputGroupAddon>
      ) : null}
      {children}
    </AutocompletePrimitive.InputGroup>
  );
}

/** The props of {@link AutocompleteContent}. */
export type AutocompleteContentProps = ComponentProps<typeof AutocompletePrimitive.Popup> &
  OverlayPositionerProps<ComponentProps<typeof AutocompletePrimitive.Positioner>> &
  OverlayContainerProps;

/** The popup of suggestions, as wide as the field box and portalled into the enclosing theme. */
export function AutocompleteContent({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  container,
  ...props
}: AutocompleteContentProps): ReactElement | null {
  return (
    <OverlayPortal portal={AutocompletePrimitive.Portal} container={container}>
      <AutocompletePrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className={overlayPositionerClass}>
        <AutocompletePrimitive.Popup
          data-slot="autocomplete-content"
          className={mergeClassName(className, styles.content())}
          {...props}
        />
      </AutocompletePrimitive.Positioner>
    </OverlayPortal>
  );
}

/**
 * The scrolling list of suggestions. Like `Combobox.List`, it pads its rows inside the popup's
 * corner and publishes `--inner-corner`.
 */
export function AutocompleteList({
  className,
  ...props
}: ComponentProps<typeof AutocompletePrimitive.List>): ReactElement {
  return (
    <AutocompletePrimitive.List
      data-slot="autocomplete-list"
      className={mergeClassName(className, styles.list())}
      {...props}
    />
  );
}

type AutocompleteItemPrimitiveProps = ComponentProps<typeof AutocompletePrimitive.Item>;

/** The props of {@link AutocompleteItem}. */
type AutocompleteItemProps = Omit<AutocompleteItemPrimitiveProps, "onClick"> & {
  /**
   * Runs on a click, and on Enter while the item is highlighted. Use it to capture the picked
   * item, such as to fill another field from it, since `onValueChange` receives only the text.
   */
  onClick?: AutocompleteItemPrimitiveProps["onClick"];
};

/** One suggestion. Picking it fills the input with its string value. */
export function AutocompleteItem({ className, ...props }: AutocompleteItemProps): ReactElement {
  return (
    <AutocompletePrimitive.Item
      data-slot="autocomplete-item"
      className={mergeClassName(className, styles.item())}
      {...props}
    />
  );
}

type AutocompleteGroupPrimitiveProps = ComponentProps<typeof AutocompletePrimitive.Group>;

/** The props of {@link AutocompleteGroup}. */
type AutocompleteGroupProps = Omit<AutocompleteGroupPrimitiveProps, "items"> & {
  /** The group's own items. Pass them when the Root's items are grouped. */
  items?: AutocompleteGroupPrimitiveProps["items"];
};

/** A group of suggestions. */
export function AutocompleteGroup({ className, ...props }: AutocompleteGroupProps): ReactElement {
  return (
    <AutocompletePrimitive.Group
      data-slot="autocomplete-group"
      className={mergeClassName(className)}
      {...props}
    />
  );
}

/** A group's visible name, which also names the group for assistive technology. */
export function AutocompleteLabel({
  className,
  ...props
}: ComponentProps<typeof AutocompletePrimitive.GroupLabel>): ReactElement {
  return (
    <AutocompletePrimitive.GroupLabel
      data-slot="autocomplete-label"
      className={mergeClassName(className, styles.label())}
      {...props}
    />
  );
}

/** Renders the filtered items of the enclosing Root or Group through its child function. */
export function AutocompleteCollection(
  props: ComponentProps<typeof AutocompletePrimitive.Collection>
): ReactElement {
  return <AutocompletePrimitive.Collection {...props} />;
}

type AutocompleteEmptyPrimitiveProps = ComponentProps<typeof AutocompletePrimitive.Empty>;

/** The props of {@link AutocompleteEmpty}. */
type AutocompleteEmptyProps = Omit<AutocompleteEmptyPrimitiveProps, "children"> & {
  /**
   * The message while the list is empty, such as loading, an error or no results. Unset, it is
   * the locale dictionary's `empty` string. The part stays mounted as a polite live region and
   * renders its children only while the list is empty. It needs `items` on `Autocomplete.Root`,
   * since it reads the Root's filtered items. Place it beside `Autocomplete.List`, not inside it.
   */
  children?: AutocompleteEmptyPrimitiveProps["children"];
};

/** The popup's message while the list is empty. */
export function AutocompleteEmpty({ className, children, ...props }: AutocompleteEmptyProps): ReactElement {
  const strings = useLocalizedStrings(autocompleteStrings);
  return (
    <AutocompletePrimitive.Empty
      data-slot="autocomplete-empty"
      className={mergeClassName(className, styles.empty())}
      {...props}>
      {children ?? strings.format("empty")}
    </AutocompletePrimitive.Empty>
  );
}

type AutocompleteStatusPrimitiveProps = ComponentProps<typeof AutocompletePrimitive.Status>;

/** The props of {@link AutocompleteStatus}. */
type AutocompleteStatusProps = Omit<AutocompleteStatusPrimitiveProps, "children"> & {
  /**
   * The state of a search the app runs, such as "Searching…", an error or the number of results.
   * Screen readers announce each change while the part stays mounted, so place it beside
   * `Autocomplete.Input`, outside `Autocomplete.Content`, where it stays mounted while the popup
   * opens and closes.
   */
  children?: AutocompleteStatusPrimitiveProps["children"];
};

/** A visually hidden polite live region for the state of a search. */
export function AutocompleteStatus({ className, ...props }: AutocompleteStatusProps): ReactElement {
  return (
    <AutocompletePrimitive.Status
      data-slot="autocomplete-status"
      className={mergeClassName(className, styles.status())}
      {...props}
    />
  );
}

/** The hairline rule between groups of suggestions. */
export function AutocompleteSeparator({
  className,
  ...props
}: ComponentProps<typeof AutocompletePrimitive.Separator>): ReactElement {
  return (
    <AutocompletePrimitive.Separator
      data-slot="autocomplete-separator"
      className={mergeClassName(className, styles.separator())}
      {...props}
    />
  );
}

AutocompleteRoot.displayName = "Autocomplete.Root";
AutocompleteInput.displayName = "Autocomplete.Input";
AutocompleteTrigger.displayName = "Autocomplete.Trigger";
AutocompleteClear.displayName = "Autocomplete.Clear";
AutocompleteContent.displayName = "Autocomplete.Content";
AutocompleteList.displayName = "Autocomplete.List";
AutocompleteItem.displayName = "Autocomplete.Item";
AutocompleteGroup.displayName = "Autocomplete.Group";
AutocompleteLabel.displayName = "Autocomplete.Label";
AutocompleteCollection.displayName = "Autocomplete.Collection";
AutocompleteEmpty.displayName = "Autocomplete.Empty";
AutocompleteStatus.displayName = "Autocomplete.Status";
AutocompleteSeparator.displayName = "Autocomplete.Separator";
