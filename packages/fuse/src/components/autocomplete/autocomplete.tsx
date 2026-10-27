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
import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import {
  InputGroupAddon,
  InputGroupButton,
  InputGroupPlainInput,
  InputGroupRoot,
} from "../input-group/input-group";
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
 * The field's state, which renders no element. Its value is the text in the input, a string,
 * whether the user typed it or picked a suggestion. `value`, `defaultValue` and `onValueChange`
 * hold that text, and the form submits it under the enclosing `Field.Root`'s name, or under
 * `name` outside one. A picked item fills the input with `itemToStringValue(item)`, or with its
 * `label` when the item is a `{ value, label }` object. `onValueChange` receives only the
 * string, so capture the picked item in `Autocomplete.Item`'s `onClick`.
 *
 * `items` is a flat array, or an array of groups that each carry their own `items`; with groups,
 * `itemToStringValue` receives one item of a group. Base UI filters `items` against the text in
 * the locale of `LocaleProvider`. For a search that runs elsewhere, such as on a server, pass
 * `filter={null}` and the results as `items`: the list then shows them as given. Inside a
 * `Field`, set `id` here rather than on the input, so the `Field.Label` points at it.
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
  props: Omit<AutocompleteRootProps<ItemValue>, "items" | "filteredItems"> & {
    /**
     * The items to suggest: a flat array, or an array of groups that each carry their own
     * `items`. Nullish entries are not supported.
     */
    items?: (Items & NoInfer<ListItems<Items, ItemValue>>) | undefined;
    /**
     * Filtered items to display in the list. When given, the list shows these instead of
     * filtering `items` itself. With `items` also given, this array keeps its flat or grouped
     * structure. Nullish entries are not supported, as in `items`. Use it to filter outside the
     * list, such as with Base UI's `useFilter()` hook.
     */
    filteredItems?: (Filtered & NoInfer<ListItems<Filtered, ItemValue>>) | undefined;
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

export type AutocompleteClearProps = ComponentProps<typeof AutocompletePrimitive.Clear> & {
  /**
   * Accessible name for the icon-only clear button. An explicit `aria-label` wins over it;
   * both default to the locale dictionary.
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

export type AutocompleteInputProps = Omit<
  ComponentProps<typeof AutocompletePrimitive.Input>,
  "children" | "className"
> & {
  /**
   * The input's id. Inside a `Field`, set `id` on `Autocomplete.Root` instead: the Root's id is
   * the one `Field.Label` points at, so an id here leaves the label's `for` unmatched.
   */
  id?: string;
  /**
   * Renders the caret trigger button in the inline-end addon. The list opens as the user types,
   * so the field has none by default. Hidden at runtime whenever a clear button is present in
   * the group.
   * @default false
   */
  showTrigger?: boolean;
  /**
   * Renders `Autocomplete.Clear` in the inline-end addon.
   * @default false
   */
  showClear?: boolean;
  /**
   * Disables the input and the trigger/clear buttons. Combines with `disabled` on
   * `Autocomplete.Root` and `Field.Root`: any of the three disables the input.
   * @default false
   */
  disabled?: boolean;
  /**
   * Extra classes, applied to the outer InputGroup (`w-auto`), not the input element.
   */
  className?: string;
  /**
   * Rendered inside the InputGroup after the addon, such as an `InputGroup.Addon` of your own.
   */
  children?: ReactNode;
  /**
   * Accessible name for the auto-rendered Clear button when `showClear`. Defaults to the locale
   * dictionary.
   */
  clearLabel?: string;
  /**
   * Accessible name for the auto-rendered caret trigger when `showTrigger`. Defaults to the
   * locale dictionary.
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
  ...props
}: AutocompleteInputProps): ReactElement {
  const strings = useLocalizedStrings(autocompleteStrings);
  return (
    // Base UI's InputGroup anchors the popup to the whole field box, not the input inside it.
    <AutocompletePrimitive.InputGroup
      render={<InputGroupRoot className={cn("w-auto", className)} />}
      // A press on the field box outside a control opens the popup under `openOnInputClick`.
      // Base UI skips that only for a disabled Root or Field, so skip it for this Input too.
      onMouseDown={(event) => {
        if (disabled) {
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

/**
 * One suggestion. Picking it fills the input with its string value. Its `onClick` runs on a
 * click, and on Enter while it is highlighted, so it can fill another field from the picked
 * item.
 */
export function AutocompleteItem({
  className,
  ...props
}: ComponentProps<typeof AutocompletePrimitive.Item>): ReactElement {
  return (
    <AutocompletePrimitive.Item
      data-slot="autocomplete-item"
      className={mergeClassName(className, styles.item())}
      {...props}
    />
  );
}

/** A group of suggestions. Pass the group's own `items` when the Root's items are grouped. */
export function AutocompleteGroup({
  className,
  ...props
}: ComponentProps<typeof AutocompletePrimitive.Group>): ReactElement {
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

/**
 * The popup's message while the list is empty, the locale dictionary's by default. Pass the
 * empty list's states as its children, such as loading, an error or no results. Base UI keeps it
 * mounted as a polite live region and renders its children only while the list is empty. It
 * needs `items` on `Autocomplete.Root`, since it reads the Root's filtered items. Place it beside
 * `Autocomplete.List`, not inside it.
 */
export function AutocompleteEmpty({
  className,
  children,
  ...props
}: ComponentProps<typeof AutocompletePrimitive.Empty>): ReactElement {
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

/**
 * A visually hidden polite live region for the state of a search the app runs, such as
 * "Searching…", an error or the number of results. Screen readers announce each change of its
 * children while it stays mounted, so render the message as its children, and place it beside
 * `Autocomplete.Input`, outside `Autocomplete.Content`, where it stays mounted while the popup
 * opens and closes.
 */
export function AutocompleteStatus({
  className,
  ...props
}: ComponentProps<typeof AutocompletePrimitive.Status>): ReactElement {
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
