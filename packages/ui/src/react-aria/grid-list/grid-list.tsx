"use client";

import type { ReactElement, RefAttributes } from "react";

import {
  Checkbox as AriaCheckbox,
  GridList as AriaGridList,
  GridListItem as AriaGridListItem,
  composeRenderProps,
} from "react-aria-components";
import type {
  CheckboxProps,
  GridListItemProps as AriaGridListItemProps,
  GridListProps as AriaGridListProps,
} from "react-aria-components";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { Check } from "../../icons/generated/check";
import { DotsSixVertical } from "../../icons/generated/dots-six-vertical";
import { Minus } from "../../icons/generated/minus";
import { gridListVariants, itemStyles } from "../../styles/grid-list";
import { Button } from "../internal/button";
import { checkboxVariants } from "../internal/checkbox";
import { composeTailwindRenderProps } from "../internal/utils";
import { gridListStrings } from "./intl";

/**
 * Module-private RAC selection checkbox (grid-list.md §2). RAC GridList requires
 * `<Checkbox slot="selection">`; this wrapper is not exported.
 */
function Checkbox({
  children,
  className,
  isDisabled,
  variant,
  ...other
}: CheckboxProps & { variant?: "success" }): ReactElement {
  const { base, box, icon } = checkboxVariants({ variant });

  return (
    <AriaCheckbox
      isDisabled={isDisabled}
      {...other}
      className={composeRenderProps(className, (className, renderProps) =>
        base({ ...renderProps, className, variant })
      )}>
      {({ isSelected, isIndeterminate, ...renderProps }) => (
        <>
          <div className={box({ isSelected: isSelected || isIndeterminate, ...renderProps })}>
            {isIndeterminate ? <Minus aria-hidden className={icon({ isSelected, isDisabled })} /> : null}
            {isSelected ? <Check aria-hidden className={icon({ isSelected, isDisabled })} /> : null}
          </div>
          {children}
        </>
      )}
    </AriaCheckbox>
  );
}

/**
 * Interim grid list over RAC `GridList` (grid-list.md §2/§3). Client — the
 * quarantined react-aria cluster owns collection state, selection, and keyboard.
 */
export type GridListProps<T extends object> = AriaGridListProps<T>;

export function GridList<T extends object>({
  children,
  className,
  ...props
}: GridListProps<T> & RefAttributes<HTMLDivElement>): ReactElement {
  const { base } = gridListVariants();

  return (
    <AriaGridList data-slot="grid-list" {...props} className={composeTailwindRenderProps(className, base())}>
      {children}
    </AriaGridList>
  );
}

/**
 * A row in `GridList`. `textValue` is derived when `children` is a string so
 * typeahead has a value without an explicit prop (grid-list.md §3).
 */
export type GridListItemProps<T extends object = object> = AriaGridListItemProps<T>;

/** Spec §3: only a string `children` auto-derives `textValue` for typeahead. */
function stringChild(node: GridListItemProps["children"]): string | undefined {
  // Consumer-owned ReactNode I/O: typeahead takes a string label only.
  // oxlint-disable-next-line anti-slop/no-runtime-typeof
  if (typeof node === "string") {
    return node;
  }
  return undefined;
}

export function GridListItem<T extends object = object>({
  children,
  className,
  ...props
}: GridListItemProps<T> & RefAttributes<HTMLDivElement>): ReactElement {
  const textValue = stringChild(children);
  const strings = useLocalizedStrings(gridListStrings);

  return (
    <AriaGridListItem
      data-slot="grid-list-item"
      textValue={textValue}
      {...props}
      className={composeRenderProps(className, (className, renderProps) =>
        itemStyles({
          isSelected: renderProps.isSelected,
          isDisabled: renderProps.isDisabled,
          isFocusVisible: renderProps.isFocusVisible,
          className,
        })
      )}>
      {composeRenderProps(children, (children, { selectionMode, selectionBehavior, allowsDragging }) => (
        <>
          {allowsDragging ? (
            <Button
              slot="drag"
              variant="ghost"
              size="icon-sm"
              aria-label={strings.format("drag")}
              // RAC injects pointer-events:none so the row owns HTML5 drag; override
              // so the handle can take mouse focus for the shared ring helper.
              style={{ pointerEvents: "auto" }}>
              <DotsSixVertical />
            </Button>
          ) : null}
          {selectionMode !== "none" && selectionBehavior === "toggle" ? <Checkbox slot="selection" /> : null}
          {children}
        </>
      ))}
    </AriaGridListItem>
  );
}

GridList.displayName = "GridList";
GridListItem.displayName = "GridListItem";
