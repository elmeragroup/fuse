"use client";

import { createContext, useContext, useRef, useState } from "react";
import type { ComponentProps, ReactElement, ReactNode, RefObject } from "react";

// Subpath import (`@base-ui/react/combobox`) type-checks but crashes at runtime with a
// null React context. Keep the package-root import until upstream fixes it.
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import type { ComboboxRoot as ComboboxRootType } from "@base-ui/react";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { useMergedRefs } from "../../hooks/use-merged-refs";
import { CaretDown } from "../../icons/generated/caret-down";
import { Check } from "../../icons/generated/check";
import { X } from "../../icons/generated/x";
import { definedProps } from "../../internal/defined-props";
import { isTextValueNode } from "../../internal/is-text-node";
import type { ListItemOf, ListItems } from "../../internal/list-items";
import { pressesRegion } from "../../internal/own-click";
import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import { chipRemoveShellClass } from "../../styles/inner-corner/listbox";
import { mergeClassName } from "../../styles/merge-class-name";
import { withinStateFaceControlClass } from "../../styles/state-face";
import { withinFocusRingControlClass } from "../../styles/utils";
import { Button } from "../button/button";
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
import { comboboxChipsVariants, comboboxVariants } from "./combobox-variants";
import {
  ChipIndexCommit,
  ChipIndexContext,
  createChipIndexRegistry,
  useChipIndex,
} from "./hooks/use-chip-index";
import { comboboxStrings } from "./intl";

const comboboxSlots = comboboxVariants();
/** The chip slot, which no size changes. */
const chipsSlots = comboboxChipsVariants();

type ComboboxItemLabelFn = (itemValue: ReactNode) => string;

const ComboboxItemToStringLabelContext = createContext<ComboboxItemLabelFn | undefined>(undefined);

/**
 * Props for `Combobox.Root`, Base UI Combobox Root's props without `locale`.
 *
 * @template Value - One item of `items`, which is the selected value and what the callbacks receive.
 * @template Multiple - Whether the user can select more than one item.
 */
export type ComboboxRootProps<Value = unknown, Multiple extends boolean | undefined = false> = Omit<
  ComboboxRootType.Props<Value, Multiple>,
  "locale"
>;

/**
 * The combobox's state, which renders no element. Its value is the selected item, or an array of
 * them with `multiple`.
 *
 * `items` is a flat array, or an array of groups that each carry their own `items`; with groups,
 * the value and the callbacks take one item of a group.
 *
 * @template Items - The `items` array, flat or of groups.
 * @template Filtered - The `filteredItems` array, flat or of groups.
 * @template Value - One item of `items`, which is the selected value and what the callbacks
 * receive. `items` decides it. Without `items`, `filteredItems` decides it. When neither is given,
 * `value`, `defaultValue` or an annotated callback sets it.
 * @template Multiple - Whether the user can select more than one item, which `multiple` sets.
 */
export function ComboboxRoot<
  Items extends readonly unknown[] = readonly never[],
  Filtered extends readonly unknown[] = readonly never[],
  Value = ListItemOf<Items extends readonly never[] ? Filtered : Items>,
  Multiple extends boolean | undefined = false,
>(
  // `NoInfer` checks `items` and `filteredItems` against `Value` without inferring it from either,
  // so `Value` takes its default from the array that decides it.
  props: Omit<ComboboxRootProps<Value, Multiple>, "items" | "filteredItems"> & {
    /**
     * The items to select from: a flat array, or an array of groups that each carry their own
     * `items`. Nullish entries are not supported.
     */
    items?: (Items & NoInfer<ListItems<Items, Value>>) | undefined;
    /**
     * The items the list shows, for filtering outside the list, such as with Base UI's
     * `useFilter()` hook. When given, the list shows these and does not filter `items` itself.
     * With `items` also given, this array keeps its own flat or grouped structure. Nullish
     * entries are not supported, as in `items`.
     */
    filteredItems?: (Filtered & NoInfer<ListItems<Filtered, Value>>) | undefined;
  }
): ReactElement {
  const { locale } = useLocale();
  // SAFETY: `Value` is one item of `items` (flat, or of a group), or of `filteredItems` without
  // `items`, which is the value Base UI selects and passes each callback. TypeScript cannot match
  // the `items` and `filteredItems` intersections to Base UI's `items` while the type parameters
  // are generic, so this erases them.
  const rootProps = props as ComboboxRootProps<Value, Multiple>;
  const itemToStringLabel = rootProps.itemToStringLabel;
  return (
    <ComboboxItemToStringLabelContext.Provider
      value={
        itemToStringLabel === undefined
          ? undefined
          : (itemValue) => {
              // SAFETY: Chip only calls this with the selected value from this Root,
              // which is `Value`.
              return itemToStringLabel(itemValue as Value);
            }
      }>
      <ComboboxPrimitive.Root {...rootProps} locale={locale} />
    </ComboboxItemToStringLabelContext.Provider>
  );
}

/**
 * The selection. Its `children` function receives the selected item, or the array of
 * them with `multiple`, as for the chips in `Combobox.Chips`.
 */
export function ComboboxValue({ ...props }: ComponentProps<typeof ComboboxPrimitive.Value>): ReactElement {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
}

/**
 * The button that opens the popup, with a caret after its children. `Combobox.Input` renders its
 * own. Use this one when the search input sits inside `Combobox.Content`.
 */
export function ComboboxTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Trigger>): ReactElement {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={mergeClassName(className, comboboxSlots.trigger())}
      {...definedProps(props)}>
      {children}
      <CaretDown className={comboboxSlots.caret()} />
    </ComboboxPrimitive.Trigger>
  );
}

/** Props for {@link ComboboxClear}. */
export type ComboboxClearProps = ComponentProps<typeof ComboboxPrimitive.Clear> & {
  /**
   * The accessible name of the icon-only clear button. An `aria-label` wins over it. Defaults to the
   * locale dictionary's `clear` string.
   */
  label?: string;
};

/** The icon button that clears the input and the selection. */
export function ComboboxClear({
  className,
  label,
  "aria-label": ariaLabel,
  ...props
}: ComboboxClearProps): ReactElement {
  const strings = useLocalizedStrings(comboboxStrings);
  // The render element's props win in Base UI's merge, so the resolved name must live there.
  const accessibleName = ariaLabel ?? label ?? strings.format("clear");
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      render={<InputGroupButton variant="ghost" size="icon-sm" aria-label={accessibleName} />}
      aria-label={accessibleName}
      className={mergeClassName(className)}
      {...definedProps(props)}>
      <X className="pointer-events-none" />
    </ComboboxPrimitive.Clear>
  );
}

/** Props for {@link ComboboxInput}. */
export type ComboboxInputProps = Omit<
  ComponentProps<typeof ComboboxPrimitive.Input>,
  "children" | "className" | "size"
> & {
  /**
   * The control size of the field box, the outer InputGroup, emitted as `data-size`. `default` is
   * the md control size, and `sm` the sm one. It replaces the native numeric `size` attribute, so
   * set the width with a class.
   */
  size?: InputGroupRootProps["size"];
  /**
   * The input's id. Inside a `Field`, set `id` on `Combobox.Root` instead. `Field.Label` points at
   * the Root's id, so an id here leaves the label's `for` unmatched.
   */
  id?: string;
  /**
   * Whether the input renders the caret button in the inline-end addon. The caret hides while the
   * group holds a clear button. Pass `false` for a search input inside `Combobox.Content`.
   */
  showTrigger?: boolean;
  /**
   * Whether the input renders `Combobox.Clear` in the inline-end addon. It shows while an item is
   * selected, and the caret hides while it shows.
   */
  showClear?: boolean;
  /**
   * Whether the input and its caret and clear buttons are disabled. `disabled` on `Combobox.Root` or
   * `Field.Root` disables the input too.
   */
  disabled?: boolean;
  /** Extra classes for the outer InputGroup, which is `w-auto`, not for the input element. */
  className?: string;
  /** Content after the inline-end addon inside the InputGroup, such as another addon or a hidden input. */
  children?: ReactNode;
  /**
   * The accessible name of the clear button that `showClear` renders. Defaults to the locale
   * dictionary's `clear` string.
   */
  clearLabel?: string;
  /**
   * The accessible name of the caret button that `showTrigger` renders. Defaults to the locale
   * dictionary's `toggle` string.
   */
  triggerLabel?: string;
};

/**
 * The text field, an InputGroup around Base UI's Combobox input with the caret and clear buttons
 * in its trailing addon. The InputGroup is Base UI's `Combobox.InputGroup`, which the popup
 * anchors to, so `Combobox.Content` takes the field box's width.
 */
export function ComboboxInput({
  className,
  children,
  disabled = false,
  showTrigger = true,
  showClear = false,
  clearLabel,
  triggerLabel,
  size = "default",
  ...props
}: ComboboxInputProps): ReactElement {
  const strings = useLocalizedStrings(comboboxStrings);
  return (
    // Base UI's InputGroup anchors the popup to the whole field box, not the input inside it, so
    // the popup spans the box to its trailing addon, as Autocomplete's does.
    <ComboboxPrimitive.InputGroup
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
      <ComboboxPrimitive.Input
        disabled={disabled}
        render={<InputGroupPlainInput />}
        {...definedProps(props)}
      />
      <InputGroupAddon align="inline-end">
        {showTrigger ? (
          <InputGroupButton
            size="icon-sm"
            variant="ghost"
            aria-label={triggerLabel ?? strings.format("toggle")}
            // oxlint-disable-next-line jsx-a11y/aria-proptypes -- the empty list overrides Field.Label's `aria-labelledby`, which would win over `aria-label`
            aria-labelledby=""
            render={<ComboboxTrigger />}
            data-slot="input-group-button"
            className={comboboxSlots.inputTrigger()}
            disabled={disabled}
          />
        ) : null}
        {showClear ? <ComboboxClear disabled={disabled} label={clearLabel} /> : null}
      </InputGroupAddon>
      {children}
    </ComboboxPrimitive.InputGroup>
  );
}

/** Props for {@link ComboboxContent}. */
export type ComboboxContentProps = ComponentProps<typeof ComboboxPrimitive.Popup> &
  OverlayPositionerProps<ComponentProps<typeof ComboboxPrimitive.Positioner>> & {
    /**
     * The element, ref or virtual element the popup positions against and takes its minimum width
     * from. Pass the ref from `useComboboxAnchor()` that sits on `Combobox.Chips` or another
     * element. It sets `data-external-anchor` on the popup. Defaults to `Combobox.Input`'s field
     * box, or to `Combobox.Trigger` when the input sits in the popup.
     */
    anchor?: ComponentProps<typeof ComboboxPrimitive.Positioner>["anchor"];
  } & OverlayContainerProps;

/** The popup that holds the list, portaled with its positioner. */
export function ComboboxContent({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  anchor,
  container,
  ...props
}: ComboboxContentProps): ReactElement | null {
  return (
    <OverlayPortal portal={ComboboxPrimitive.Portal} container={container}>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className={overlayPositionerClass}>
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          data-external-anchor={anchor ? "true" : "false"}
          className={mergeClassName(className, comboboxSlots.content())}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </OverlayPortal>
  );
}

/**
 * The scrolling list of options. It is the part that publishes `--inner-corner`. It pads its
 * rows inside the popup's corner, so a custom block placed in the List with `rounded-inner`
 * rounds like the rows. A block directly in `Combobox.Content` rounds with `--radius`.
 */
export function ComboboxList({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.List>): ReactElement {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={mergeClassName(className, comboboxSlots.list())}
      {...props}
    />
  );
}

/** An option, with a check while it is selected. */
export function ComboboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Item>): ReactElement {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={mergeClassName(className, comboboxSlots.item())}
      {...props}>
      {children}
      <ComboboxPrimitive.ItemIndicator render={<span className={comboboxSlots.itemIndicator()} />}>
        <Check className="pointer-events-none" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

/** A group of options. Pass the group's `items` and render them with a `Combobox.Collection`. */
export function ComboboxGroup({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Group>): ReactElement {
  return (
    <ComboboxPrimitive.Group data-slot="combobox-group" className={mergeClassName(className)} {...props} />
  );
}

/** The label of a `Combobox.Group`. */
export function ComboboxLabel({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.GroupLabel>): ReactElement {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={mergeClassName(className, comboboxSlots.label())}
      {...props}
    />
  );
}

/** The items of the nearest `items`, each rendered through its `children` function. */
export function ComboboxCollection({
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Collection>): ReactElement {
  return <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />;
}

/**
 * The row that shows while no item matches. Without `children`, it shows the locale dictionary's
 * `empty` string.
 */
export function ComboboxEmpty({
  className,
  children,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Empty>): ReactElement {
  const strings = useLocalizedStrings(comboboxStrings);
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={mergeClassName(className, comboboxSlots.empty())}
      {...props}>
      {children ?? strings.format("empty")}
    </ComboboxPrimitive.Empty>
  );
}

/** A line between groups of options. */
export function ComboboxSeparator({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Separator>): ReactElement {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      className={mergeClassName(className, comboboxSlots.separator())}
      {...props}
    />
  );
}

/** Props for {@link ComboboxChips}. */
export type ComboboxChipsProps = ComponentProps<typeof ComboboxPrimitive.Chips> & {
  /**
   * The control size of the chips field box, emitted as `data-size`. `default` is the md control
   * size, and `sm` the sm one. The box's minimum height, inset, gap and text follow it, and one
   * row of chips fits the sm height. At both sizes, chips that do not fit one row grow the box.
   */
  size?: "sm" | "default";
};

/**
 * The chips field box. It publishes `--inner-corner`, the field corner less its border and padding,
 * for the chips inside it.
 */
export function ComboboxChips({ className, size = "default", ...props }: ComboboxChipsProps): ReactElement {
  const [registry] = useState(createChipIndexRegistry);
  return (
    <ChipIndexContext.Provider value={registry}>
      <ComboboxPrimitive.Value>
        {(selected: ReactNode) => <ChipIndexCommit selected={selected} />}
      </ComboboxPrimitive.Value>
      <ComboboxPrimitive.Chips
        data-slot="combobox-chips"
        data-size={size}
        className={mergeClassName(className, comboboxChipsVariants({ size }).chips())}
        {...props}
      />
    </ChipIndexContext.Provider>
  );
}

/** Props for {@link ComboboxChip}. */
export type ComboboxChipProps = ComponentProps<typeof ComboboxPrimitive.Chip> & {
  /** Whether the chip renders its remove button, an `X`. */
  showRemove?: boolean;
  /**
   * The accessible name of the remove button. Defaults to the dictionary's `removeItem` string
   * with the chip's text children, or else with `itemToStringLabel(value)`. When neither gives
   * text, it is the localized "Remove" string with no trailing space.
   */
  removeLabel?: string;
};

function chipItemName(children: ReactNode): string {
  if (!isTextValueNode(children)) {
    return "";
  }
  return children.toString().trim();
}

function chipValueAt(selected: ReactNode, index: number): ReactNode {
  if (!Array.isArray(selected)) {
    return selected;
  }
  // SAFETY: multiple-mode `Value` yields the consumer's selected items; Chip
  // indexes that list by committed DOM order, matching Base UI removal.
  return (selected[index] ?? null) as ReactNode;
}

function stringifyChipValue(value: ReactNode, itemToStringLabel?: ComboboxItemLabelFn): string {
  if (value == null || value === false || value === true) {
    return "";
  }
  if (itemToStringLabel !== undefined) {
    return itemToStringLabel(value).trim();
  }
  return chipItemName(value);
}

/** One selected item in `Combobox.Chips`, with a remove button. */
export function ComboboxChip({
  ref,
  className,
  children,
  showRemove = true,
  removeLabel,
  ...props
}: ComboboxChipProps): ReactElement {
  const { ref: indexRef, index } = useChipIndex();
  const mergedRef = useMergedRefs(ref, indexRef);
  return (
    <ComboboxPrimitive.Chip
      ref={mergedRef}
      data-slot="combobox-chip"
      className={mergeClassName(className, chipsSlots.chip())}
      {...props}>
      {children}
      {showRemove ? (
        <ComboboxChipRemoveLabel removeLabel={removeLabel} chipChildren={children} index={index} />
      ) : null}
    </ComboboxPrimitive.Chip>
  );
}

function ComboboxChipRemoveLabel({
  removeLabel,
  chipChildren,
  index,
}: {
  removeLabel?: string;
  chipChildren: ReactNode;
  index: number;
}): ReactElement {
  const strings = useLocalizedStrings(comboboxStrings);
  const itemToStringLabel = useContext(ComboboxItemToStringLabelContext);
  return (
    <ComboboxPrimitive.Value>
      {(selected: ReactNode) => {
        const fromChildren = chipItemName(chipChildren);
        const item = fromChildren || stringifyChipValue(chipValueAt(selected, index), itemToStringLabel);
        const accessibleName = removeLabel ?? strings.format("removeItem", { item });
        return <ComboboxChipRemove label={accessibleName} />;
      }}
    </ComboboxPrimitive.Value>
  );
}

function ComboboxChipRemove({ label }: { label: string }): ReactElement {
  return (
    <ComboboxPrimitive.ChipRemove
      data-slot="combobox-chip-remove"
      render={
        <Button
          variant="ghost"
          size="icon-inline"
          aria-label={label}
          // The remove button sits inside a chip in the field box, so it rounds inside the
          // chip's corner instead of with Button's `--radius-button`. The inline square is as tall
          // as the chip's 16px line and fits inside it. The explicit `text-xs` replaces
          // icon-inline's inherited size and line height, so the square is the xs line's 16px, the
          // chip's own line, even if a consumer restyles the chip's type. Family and weight still
          // inherit. The ghost button drops its transparent border, and Button's inline hit area
          // makes the target 24px. The target reaches into the chip's inset and the chips' gap
          // without meeting the next chip. The glyph takes the xs size, as on Button's smallest
          // square.
          className={cn("text-xs border-0 opacity-50 enabled-hover:opacity-100", chipRemoveShellClass)}
        />
      }
      aria-label={label}>
      <X className="pointer-events-none size-3" />
    </ComboboxPrimitive.ChipRemove>
  );
}

/** The text input inside `Combobox.Chips`, after the chips. */
export function ComboboxChipsInput({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Input>): ReactElement {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-chip-input"
      data-focus-ring-control=""
      // The chips box keys its face off this `data-focus-ring-control` input while it is a
      // direct child. The control half keeps the `not-allowed` cursor on the input and cancels
      // its own ring, so only the chips box paints the face.
      className={mergeClassName(
        className,
        // No UA border, padding or fill, and the box's leading rather than the UA `normal`, in a
        // preflight-free host, where they would make the input taller than an sm chips box.
        // oxlint-disable-next-line elmera/no-local-focus-ring -- the native outline is off, and the shared within adapter draws the ring
        "min-w-16 flex-1 border-0 bg-transparent p-0 outline-none",
        // The placeholder role color `fieldBox` gives Combobox.Input. It sits on the input: the
        // chips box paints only the shell, so a `placeholder:` class there would not reach it.
        "placeholder:text-muted-foreground",
        // The text-entry 16px floor under `entry-floor` (see `entryType` in `field-size.ts`), over the
        // chips box's 14px. In `font-size`, `1em` is the inherited size.
        // The leading follows the font size so tailwind-merge keeps it after the font-size class.
        "entry-floor:[--entry-text:max(16px,1em)] text-[length:var(--entry-text,1em)] leading-[inherit]",
        withinFocusRingControlClass,
        withinStateFaceControlClass
      )}
      {...definedProps(props)}
    />
  );
}

/**
 * A ref to put on the element `Combobox.Content` anchors to, such as `Combobox.Chips` or
 * an `InputGroup.Root`. Pass the same ref to `Combobox.Content`'s `anchor`.
 */
export function useComboboxAnchor(): RefObject<HTMLDivElement | null> {
  return useRef<HTMLDivElement | null>(null);
}

ComboboxRoot.displayName = "Combobox.Root";
ComboboxInput.displayName = "Combobox.Input";
ComboboxTrigger.displayName = "Combobox.Trigger";
ComboboxClear.displayName = "Combobox.Clear";
ComboboxContent.displayName = "Combobox.Content";
ComboboxList.displayName = "Combobox.List";
ComboboxItem.displayName = "Combobox.Item";
ComboboxGroup.displayName = "Combobox.Group";
ComboboxLabel.displayName = "Combobox.Label";
ComboboxCollection.displayName = "Combobox.Collection";
ComboboxEmpty.displayName = "Combobox.Empty";
ComboboxSeparator.displayName = "Combobox.Separator";
ComboboxChips.displayName = "Combobox.Chips";
ComboboxChip.displayName = "Combobox.Chip";
ComboboxChipsInput.displayName = "Combobox.ChipsInput";
ComboboxValue.displayName = "Combobox.Value";
