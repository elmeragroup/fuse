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
import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import { controlMd } from "../../styles/control-size-md";
import { fieldBoxShellClass } from "../../styles/inner-corner/field";
import { chipRemoveShellClass, chipShellClass, chipsShellClass } from "../../styles/inner-corner/listbox";
import { mergeClassName } from "../../styles/merge-class-name";
import { withinStateFaceClass, withinStateFaceControlClass } from "../../styles/state-face";
import { withinFocusRingClass, withinFocusRingControlClass } from "../../styles/utils";
import { Button } from "../button/button";
import {
  InputGroupAddon,
  InputGroupButton,
  InputGroupPlainInput,
  InputGroupRoot,
} from "../input-group/input-group";
import { overlayPositionerClass } from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps, OverlayPositionerProps } from "../overlay/overlay-props";
import { comboboxVariants } from "./combobox-variants";
import {
  ChipIndexCommit,
  ChipIndexContext,
  createChipIndexRegistry,
  useChipIndex,
} from "./hooks/use-chip-index";
import { comboboxStrings } from "./intl";

const comboboxSlots = comboboxVariants();

type ComboboxItemLabelFn = (itemValue: ReactNode) => string;

const ComboboxItemToStringLabelContext = createContext<ComboboxItemLabelFn | undefined>(undefined);

/**
 * `Combobox.Root` takes Base UI Combobox Root's props, without `locale`.
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
 * receive. `items` decides it; without `items`, `filteredItems` does; when neither is given,
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
     * Filtered items to display in the list. When given, the list shows these instead of
     * filtering `items` itself. With `items` also given, this array keeps its flat or grouped
     * structure. Nullish entries are not supported, as in `items`. Use it to filter outside the
     * list, such as with Base UI's `useFilter()` hook.
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

export function ComboboxValue({ ...props }: ComponentProps<typeof ComboboxPrimitive.Value>): ReactElement {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
}

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

export type ComboboxClearProps = ComponentProps<typeof ComboboxPrimitive.Clear> & {
  /**
   * Accessible name for the icon-only clear button. An explicit `aria-label` wins over it;
   * both default to the locale dictionary.
   */
  label?: string;
};

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

export type ComboboxInputProps = Omit<
  ComponentProps<typeof ComboboxPrimitive.Input>,
  "children" | "className"
> & {
  /**
   * The input's id. Inside a `Field`, set `id` on `Combobox.Root` instead: the Root's id is the
   * one `Field.Label` points at, so an id here leaves the label's `for` unmatched.
   */
  id?: string;
  /**
   * Renders the caret trigger button in the inline-end addon.
   * Hidden at runtime whenever a clear button is present in the group.
   * @default true
   */
  showTrigger?: boolean;
  /**
   * Renders `Combobox.Clear` in the inline-end addon.
   * @default false
   */
  showClear?: boolean;
  /**
   * Disables the input and the trigger/clear buttons. Combines with `disabled` on
   * `Combobox.Root` and `Field.Root`: any of the three disables the input.
   * @default false
   */
  disabled?: boolean;
  /**
   * Extra classes, applied to the outer InputGroup (`w-auto`), not the input element.
   */
  className?: string;
  /**
   * Rendered inside the InputGroup after the addon (extra addons, hidden inputs).
   */
  children?: ReactNode;
  /**
   * Accessible name for the auto-rendered Clear button when `showClear`. Defaults to
   * the locale dictionary.
   */
  clearLabel?: string;
  /**
   * Accessible name for the auto-rendered caret trigger when `showTrigger`. Defaults to
   * the locale dictionary.
   */
  triggerLabel?: string;
};

export function ComboboxInput({
  className,
  children,
  disabled = false,
  showTrigger = true,
  showClear = false,
  clearLabel,
  triggerLabel,
  ...props
}: ComboboxInputProps): ReactElement {
  const strings = useLocalizedStrings(comboboxStrings);
  return (
    <InputGroupRoot className={cn("w-auto", className)}>
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
            // Field.Label labelledby would win over aria-label. An empty list overrides it,
            // so the caret stays dictionary `toggle`.
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
    </InputGroupRoot>
  );
}

export type ComboboxContentProps = ComponentProps<typeof ComboboxPrimitive.Popup> &
  OverlayPositionerProps<ComponentProps<typeof ComboboxPrimitive.Positioner>> & {
    /**
     * Element, ref, or virtual element to position against. Pass `useComboboxAnchor()`'s
     * ref; also flips `data-external-anchor` on the popup.
     */
    anchor?: ComponentProps<typeof ComboboxPrimitive.Positioner>["anchor"];
  } & OverlayContainerProps;

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
 * The scrolling list of options. It is the part that publishes `--inner-corner`: it pads its
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

export function ComboboxGroup({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Group>): ReactElement {
  return (
    <ComboboxPrimitive.Group data-slot="combobox-group" className={mergeClassName(className)} {...props} />
  );
}

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

export function ComboboxCollection({
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Collection>): ReactElement {
  return <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />;
}

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

/**
 * The chips field box. It publishes `--inner-corner`, the field corner less its border and padding,
 * for the chips inside it.
 */
export function ComboboxChips({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Chips>): ReactElement {
  const [registry] = useState(createChipIndexRegistry);
  return (
    <ChipIndexContext.Provider value={registry}>
      <ComboboxPrimitive.Value>
        {(selected: ReactNode) => <ChipIndexCommit selected={selected} />}
      </ComboboxPrimitive.Value>
      <ComboboxPrimitive.Chips
        data-slot="combobox-chips"
        className={mergeClassName(
          className,
          controlMd.minHeight(),
          controlMd.inset(),
          controlMd.type(),
          controlMd.gap(),
          "shadow-xs flex flex-wrap items-center border border-input bg-transparent bg-clip-padding transition-[color,box-shadow]",
          fieldBoxShellClass,
          chipsShellClass,
          withinFocusRingClass,
          withinStateFaceClass
        )}
        {...props}
      />
    </ChipIndexContext.Provider>
  );
}

export type ComboboxChipProps = ComponentProps<typeof ComboboxPrimitive.Chip> & {
  /**
   * Renders the chip-remove button with an `X`.
   * @default true
   */
  showRemove?: boolean;
  /**
   * Accessible name for the remove button. Defaults to dictionary `removeItem`
   * formatted with the chip's string children, then `itemToStringLabel(value)`.
   * When neither yields text, the localized "Remove" string with no trailing space.
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
      className={mergeClassName(
        className,
        "text-xs font-medium flex h-[calc(--spacing(5.5))] w-fit items-center justify-center gap-1 bg-muted px-1.5 whitespace-nowrap text-foreground",
        chipShellClass
      )}
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
          // chip's corner instead of with Button's `--radius-button`. The inline square is as tall as the
          // chip's 16px line and fits inside it. The explicit `text-xs` replaces icon-inline's
          // inherited size and line height, so the square is the xs line's 16px, the chip's own
          // line, even if a consumer restyles the chip's type; family and weight still inherit.
          // The ghost button drops its transparent border, and Button's inline hit area makes
          // the target 24px.
          // The target reaches into the chip's inset and the chips' gap without meeting the
          // next chip. The glyph takes the xs size, as on Button's
          // smallest square.
          className={cn("text-xs border-0 opacity-50 enabled-hover:opacity-100", chipRemoveShellClass)}
        />
      }
      aria-label={label}>
      <X className="pointer-events-none size-3" />
    </ComboboxPrimitive.ChipRemove>
  );
}

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
        // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; ring comes from the shared within adapter
        "min-w-16 flex-1 outline-none",
        // The text-entry 16px floor under `entry-floor` (see `controlMdInsetTypeClass`), over the
        // chips box's 14px. In `font-size`, `1em` is the inherited size.
        "entry-floor:[--entry-text:max(16px,1em)] text-[length:var(--entry-text,1em)]",
        withinFocusRingControlClass,
        withinStateFaceControlClass
      )}
      {...definedProps(props)}
    />
  );
}

/**
 * Typed ref helper to anchor `Combobox.Content` to an external element
 * (e.g. the `Combobox.Chips` container or an `InputGroup.Root`).
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
