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
import { isTextValueNode } from "../../internal/is-text-node";
import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import { controlMd } from "../../styles/control-size-md";
import { compactCornerClass } from "../../styles/corner-radius";
import { mergeClassName } from "../../styles/merge-class-name";
import { withinStateFaceClass, withinStateFaceControlClass } from "../../styles/state-face";
import { withinFocusRingClass, withinFocusRingControlClass } from "../../styles/utils";
import { Button } from "../button/button";
import { InputGroup } from "../input-group/input-group";
import {
  menuGroupLabelClass,
  menuItemClass,
  menuItemIndicatorClass,
  menuSeparatorClass,
  overlayPositionerClass,
  overlayTimedPopupClass,
} from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps, OverlayPositionerProps } from "../overlay/overlay-props";
import {
  ChipIndexCommit,
  ChipIndexContext,
  createChipIndexRegistry,
  useChipIndex,
} from "./hooks/use-chip-index";
import { comboboxStrings } from "./intl";

type ComboboxItemLabelFn = (itemValue: ReactNode) => string;

const ComboboxItemToStringLabelContext = createContext<ComboboxItemLabelFn | undefined>(undefined);

export type ComboboxRootProps<Value = unknown, Multiple extends boolean | undefined = false> = Omit<
  ComboboxRootType.Props<Value, Multiple>,
  "locale"
>;

function ComboboxRoot<Value = unknown, Multiple extends boolean | undefined = false>(
  props: ComboboxRootProps<Value, Multiple>
): ReactElement {
  const { locale } = useLocale();
  const itemToStringLabel = props.itemToStringLabel;
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
      <ComboboxPrimitive.Root {...props} locale={locale} />
    </ComboboxItemToStringLabelContext.Provider>
  );
}

function ComboboxValue({ ...props }: ComponentProps<typeof ComboboxPrimitive.Value>): ReactElement {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
}

function ComboboxTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Trigger>): ReactElement {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={mergeClassName(className, "[&_svg:not([class*='size-'])]:size-4")}
      {...props}>
      {children}
      <CaretDown className="ease-in-out pointer-events-none size-4 text-muted-foreground transition-transform duration-200 in-data-popup-open:rotate-180" />
    </ComboboxPrimitive.Trigger>
  );
}

export type ComboboxClearProps = ComponentProps<typeof ComboboxPrimitive.Clear> & {
  /**
   * Accessible name for the icon-only clear button. Defaults to the locale dictionary.
   */
  label?: string;
};

function ComboboxClear({ className, label, ...props }: ComboboxClearProps): ReactElement {
  const strings = useLocalizedStrings(comboboxStrings);
  const accessibleName = label ?? strings.format("clear");
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      render={<InputGroup.Button variant="ghost" size="icon-sm" aria-label={accessibleName} />}
      aria-label={accessibleName}
      className={mergeClassName(className)}
      {...props}>
      <X className="pointer-events-none" />
    </ComboboxPrimitive.Clear>
  );
}

export type ComboboxInputProps = Omit<
  ComponentProps<typeof ComboboxPrimitive.Input>,
  "children" | "className"
> & {
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
   * Forwarded to the inner `InputGroup.Input` and to the trigger/clear buttons.
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
};

function ComboboxInput({
  className,
  children,
  disabled = false,
  showTrigger = true,
  showClear = false,
  clearLabel,
  ...props
}: ComboboxInputProps): ReactElement {
  const strings = useLocalizedStrings(comboboxStrings);
  return (
    <InputGroup.Root className={cn("w-auto", className)}>
      <ComboboxPrimitive.Input render={<InputGroup.Input disabled={disabled} />} {...props} />
      <InputGroup.Addon align="inline-end">
        {showTrigger ? (
          <InputGroup.Button
            size="icon-sm"
            variant="ghost"
            aria-label={strings.format("toggle")}
            // Field.Label labelledby would win over aria-label; drop it so the
            // caret stays dictionary `toggle`.
            aria-labelledby={undefined}
            render={<ComboboxTrigger />}
            data-slot="input-group-button"
            className="group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent"
            disabled={disabled}
          />
        ) : null}
        {showClear ? <ComboboxClear disabled={disabled} label={clearLabel} /> : null}
      </InputGroup.Addon>
      {children}
    </InputGroup.Root>
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

function ComboboxContent({
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
          className={mergeClassName(
            className,
            overlayTimedPopupClass,
            // Popup padding insets a search group; a child margin plus the group's w-full
            // overflowed the box. Scope it to popups that directly own one, so a plain list
            // keeps the menu family's single p-1 inset instead of double-insetting.
            "group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] overflow-hidden has-[>[data-slot=input-group]]:px-1 has-[>[data-slot=input-group]]:pt-1.5 data-[external-anchor=true]:min-w-(--anchor-width) *:data-[slot=input-group]:h-(--control-h-sm) *:data-[slot=input-group]:border-input/30 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:shadow-none"
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </OverlayPortal>
  );
}

function ComboboxList({ className, ...props }: ComponentProps<typeof ComboboxPrimitive.List>): ReactElement {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={mergeClassName(
        className,
        "no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0"
      )}
      {...props}
    />
  );
}

function ComboboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Item>): ReactElement {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- option padding is menu layout, not a control rung
      className={mergeClassName(
        className,
        menuItemClass,
        // oxlint-disable-next-line elmera/no-local-focus-ring -- the highlight face menuItemClass leaves to the family; base-ui spells it `data-highlighted:` on listbox options
        "w-full pr-8 pl-2 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground"
      )}
      {...props}>
      {children}
      <ComboboxPrimitive.ItemIndicator render={<span className={cn(menuItemIndicatorClass, "size-4")} />}>
        <Check className="pointer-events-none" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

function ComboboxGroup({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Group>): ReactElement {
  return (
    <ComboboxPrimitive.Group data-slot="combobox-group" className={mergeClassName(className)} {...props} />
  );
}

function ComboboxLabel({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.GroupLabel>): ReactElement {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={mergeClassName(className, menuGroupLabelClass)}
      {...props}
    />
  );
}

function ComboboxCollection({ ...props }: ComponentProps<typeof ComboboxPrimitive.Collection>): ReactElement {
  return <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />;
}

function ComboboxEmpty({
  className,
  children,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Empty>): ReactElement {
  const strings = useLocalizedStrings(comboboxStrings);
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={mergeClassName(
        className,
        "text-sm hidden w-full justify-center py-2 text-center text-muted-foreground group-data-empty/combobox-content:flex"
      )}
      {...props}>
      {children ?? strings.format("empty")}
    </ComboboxPrimitive.Empty>
  );
}

function ComboboxSeparator({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Separator>): ReactElement {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      className={mergeClassName(className, menuSeparatorClass)}
      {...props}
    />
  );
}

function ComboboxChips({
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
        // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- chip wrap gap and compact chip padding are layout, not a control rung
        className={mergeClassName(
          className,
          controlMd.minHeight(),
          controlMd.inset(),
          "text-sm shadow-xs flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent bg-clip-padding py-1.5 transition-[color,box-shadow] has-data-[slot=combobox-chip]:px-1.5",
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

function ComboboxChip({
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
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- chip chrome is compact token, not a control rung
      className={mergeClassName(
        className,
        "text-xs font-medium flex h-[calc(--spacing(5.5))] w-fit items-center justify-center gap-1 rounded-sm bg-muted px-1.5 whitespace-nowrap text-foreground has-data-[slot=combobox-chip-remove]:pr-0"
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
      render={<Button variant="ghost" size="icon-sm" aria-label={label} />}
      // The remove button sits inside a chip in the field box, so it takes the compact
      // corner instead of Button's `--radius-button`.
      className={cn("-ml-1 opacity-50 enabled-hover:opacity-100", compactCornerClass)}
      aria-label={label}>
      <X className="pointer-events-none" />
    </ComboboxPrimitive.ChipRemove>
  );
}

function ComboboxChipsInput({
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
        withinFocusRingControlClass,
        withinStateFaceControlClass
      )}
      {...props}
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

export const Combobox = {
  Root: ComboboxRoot,
  Input: ComboboxInput,
  Trigger: ComboboxTrigger,
  Clear: ComboboxClear,
  Content: ComboboxContent,
  List: ComboboxList,
  Item: ComboboxItem,
  Group: ComboboxGroup,
  Label: ComboboxLabel,
  Collection: ComboboxCollection,
  Empty: ComboboxEmpty,
  Separator: ComboboxSeparator,
  Chips: ComboboxChips,
  Chip: ComboboxChip,
  ChipsInput: ComboboxChipsInput,
  Value: ComboboxValue,
};
