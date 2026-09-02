"use client";

import { createContext, useContext, useMemo, useRef } from "react";
import type { ComponentProps, ReactElement, ReactNode, RefObject } from "react";

// Subpath import (`@base-ui/react/combobox`) type-checks but crashes at runtime with a
// null React context. Keep the package-root import until upstream fixes it (combobox.md §8).
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import type { ComboboxRoot as ComboboxRootType } from "@base-ui/react";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { CaretDown } from "../../icons/generated/caret-down";
import { Check } from "../../icons/generated/check";
import { X } from "../../icons/generated/x";
import { cn } from "../../styles/cn";
import { focusRing } from "../../styles/utils";
import { useElmeraGroupUi } from "../../theme/elmera-group-ui";
import { useThemeScopeContainer } from "../../theme/theme-scope-container";
import { Button } from "../button/button";
import { InputGroup } from "../input-group/input-group";
import { overlayLayer } from "../overlay/overlay-classes";
import { comboboxStrings } from "./intl";

/** Resolved once at module scope — the recipe below does the same (no per-render work). */
const withinFocusRing = focusRing({ target: "within" });

type ComboboxItemLabelFn = (itemValue: ReactNode) => string;

const ComboboxItemToStringLabelContext = createContext<ComboboxItemLabelFn | undefined>(undefined);

const ComboboxChipIndexContext = createContext<{ next: () => number } | null>(null);

export type ComboboxRootProps<Value = unknown, Multiple extends boolean | undefined = false> = Omit<
  ComboboxRootType.Props<Value, Multiple>,
  "locale"
>;

function ComboboxRoot<Value = unknown, Multiple extends boolean | undefined = false>(
  props: ComboboxRootProps<Value, Multiple>
): ReactElement {
  const { locale } = useElmeraGroupUi();
  const itemToStringLabel = props.itemToStringLabel;
  return (
    <ComboboxItemToStringLabelContext.Provider
      value={
        itemToStringLabel === undefined
          ? undefined
          : (itemValue) => {
              // SAFETY: Chip only calls this with the selected value from this Root,
              // which is `Value` (combobox.md §3 removeLabel).
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
      className={cn("[&_svg:not([class*='size-'])]:size-4", className)}
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
      className={cn(className)}
      {...props}>
      <X className="pointer-events-none" />
    </ComboboxPrimitive.Clear>
  );
}

export type ComboboxInputProps = Omit<ComponentProps<typeof ComboboxPrimitive.Input>, "children"> & {
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
            // caret stays dictionary `toggle` (combobox.md §7).
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

export type ComboboxContentProps = ComponentProps<typeof ComboboxPrimitive.Popup> & {
  /**
   * Which side of the trigger the popup is placed on.
   * @default "bottom"
   */
  side?: ComponentProps<typeof ComboboxPrimitive.Positioner>["side"];
  /**
   * Distance from the trigger, in pixels.
   * @default 6
   */
  sideOffset?: ComponentProps<typeof ComboboxPrimitive.Positioner>["sideOffset"];
  /**
   * How the popup aligns to the trigger on the cross axis.
   * @default "start"
   */
  align?: ComponentProps<typeof ComboboxPrimitive.Positioner>["align"];
  /**
   * Offset along the alignment axis, in pixels.
   * @default 0
   */
  alignOffset?: ComponentProps<typeof ComboboxPrimitive.Positioner>["alignOffset"];
  /**
   * Element, ref, or virtual element to position against. Pass `useComboboxAnchor()`'s
   * ref; also flips `data-chips` on the popup.
   */
  anchor?: ComponentProps<typeof ComboboxPrimitive.Positioner>["anchor"];
  /**
   * Portal target for the popup. Defaults to the nearest enclosing `ThemeScope`
   * element, so an overlay never escapes the theme that opened it.
   */
  container?: HTMLElement | RefObject<HTMLElement | null>;
};

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
  const resolvedContainer = useThemeScopeContainer(container);

  // theming.md §7.4: an explicit ref or an enclosing ThemeScope whose element is not
  // attached yet means wait — never a brief escape to the document body. Only an absent
  // scope (`undefined`) leaves the primitive default in place.
  if (resolvedContainer === null) {
    return null;
  }

  return (
    <ComboboxPrimitive.Portal container={resolvedContainer}>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className={cn("isolate", overlayLayer)}>
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          data-chips={anchor ? "true" : "false"}
          className={cn(
            "group/combobox-content shadow-md relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) overflow-hidden rounded-md bg-popover text-popover-foreground ring-1 ring-foreground/10 duration-100 data-[chips=true]:min-w-(--anchor-width) data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:border-input/30 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:shadow-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

function ComboboxList({ className, ...props }: ComponentProps<typeof ComboboxPrimitive.List>): ReactElement {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        "no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0",
        className
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
      className={cn(
        "text-sm relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}>
      {children}
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }>
        <Check className="pointer-events-none" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

function ComboboxGroup({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Group>): ReactElement {
  return <ComboboxPrimitive.Group data-slot="combobox-group" className={cn(className)} {...props} />;
}

function ComboboxLabel({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.GroupLabel>): ReactElement {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn("text-xs px-2 py-1.5 text-muted-foreground", className)}
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
      className={cn(
        "text-sm hidden w-full justify-center py-2 text-center text-muted-foreground group-data-empty/combobox-content:flex",
        className
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
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function ComboboxChips({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Chips>): ReactElement {
  return (
    <ComboboxPrimitive.Value>
      {() => <ComboboxChipsIndexed className={className} {...props} />}
    </ComboboxPrimitive.Value>
  );
}

function ComboboxChipsIndexed({
  className,
  ...props
}: ComponentProps<typeof ComboboxPrimitive.Chips>): ReactElement {
  const counter = useRef(0);
  counter.current = 0;
  const indexApi = useMemo(() => ({ next: () => counter.current++ }), []);
  return (
    <ComboboxChipIndexContext.Provider value={indexApi}>
      <ComboboxPrimitive.Chips
        data-slot="combobox-chips"
        className={cn(
          "text-sm shadow-xs flex min-h-(--control-h-md) flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent bg-clip-padding px-(--control-px-md) py-1.5 transition-[color,box-shadow] has-aria-invalid:border-error has-aria-invalid:ring-3 has-aria-invalid:ring-error/20 has-data-[slot=combobox-chip]:px-1.5",
          withinFocusRing.root(),
          className
        )}
        {...props}
      />
    </ComboboxChipIndexContext.Provider>
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

function isChipText(value: ReactNode): value is string | number {
  const tag = Object.prototype.toString.call(value);
  return tag === "[object String]" || tag === "[object Number]";
}

function chipItemName(children: ReactNode): string {
  if (!isChipText(children)) {
    return "";
  }
  return children.toString().trim();
}

function chipValueAt(selected: ReactNode, index: number): ReactNode {
  if (!Array.isArray(selected)) {
    return selected;
  }
  // SAFETY: multiple-mode `Value` yields the consumer's selected items; Chip
  // indexes that list in render order (combobox.md §3 removeLabel).
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
  className,
  children,
  showRemove = true,
  removeLabel,
  ...props
}: ComboboxChipProps): ReactElement {
  const indexApi = useContext(ComboboxChipIndexContext);
  const index = indexApi?.next() ?? 0;
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      className={cn(
        "text-xs font-medium flex h-[calc(--spacing(5.5))] w-fit items-center justify-center gap-1 rounded-sm bg-muted px-1.5 whitespace-nowrap text-foreground has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[slot=combobox-chip-remove]:pr-0",
        className
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
      className="-ml-1 opacity-50 hover:opacity-100"
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
      className={cn("min-w-16 flex-1 outline-none", withinFocusRing.control(), className)}
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
