"use client";

import type { ComponentProps, HTMLAttributes, ReactElement } from "react";
import { Children, cloneElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import type { FocusableOptions } from "react-aria";
import { useFocusable as useRacFocusable } from "react-aria";
import type { FocusableElement } from "react-aria-components";
import { Focusable as FocusablePrimitive } from "react-aria-components";

type FocusablePrimitiveProps = ComponentProps<typeof FocusablePrimitive>;

type FocusableProps = FocusablePrimitiveProps &
  Omit<HTMLAttributes<FocusableElement>, keyof FocusablePrimitiveProps>;

/** The props RAC `Focusable` reads: its ref and focus options. `id`, a DOM prop, goes to the child. */
const PRIMITIVE_KEYS = {
  ref: true,
  isDisabled: true,
  excludeFromTabOrder: true,
  autoFocus: true,
  onFocus: true,
  onBlur: true,
  onFocusChange: true,
  onKeyDown: true,
  onKeyUp: true,
} satisfies Record<Exclude<keyof FocusablePrimitiveProps, "children" | "id" | "key">, true>;

/**
 * Makes its one child element focusable, over RAC `Focusable`, so a non-interactive element can
 * be a Base UI trigger's `render` target. Client — RAC owns the focus wiring.
 *
 * The ref and `FocusableOptions` go to RAC. Every other prop, such as the `data-slot`,
 * `aria-describedby` and handlers a trigger passes its `render` element, lands on the child,
 * merged with the child's own: handlers chain, classes join, and the child's other values win.
 * RAC's own `Focusable` hands the child its focus props alone and drops the rest.
 *
 * The child also gets `data-focusable-child=""`, unless it sets its own value. The density role
 * table reads it: a `Tooltip.Trigger` rendered through `Focusable` reads no control metric. The
 * name is not `data-focusable`, which Base UI's Toolbar parts write when they stay focusable while
 * disabled.
 *
 * Migration debt: dies with the react-aria interim tier. Base-ui overlay triggers accept
 * arbitrary render targets, which removes the need for a focus-cloning wrapper.
 */
export function Focusable({ children, ...props }: FocusableProps): ReactElement {
  const child = Children.only(children);
  const entries = Object.entries(props);
  // SAFETY: Object.entries loses key/value correlation; PRIMITIVE_KEYS names RAC's props.
  const primitiveProps = Object.fromEntries(
    entries.filter(([key]) => Object.hasOwn(PRIMITIVE_KEYS, key))
  ) as Omit<FocusablePrimitiveProps, "children">;
  const forwarded = Object.fromEntries(entries.filter(([key]) => !Object.hasOwn(PRIMITIVE_KEYS, key)));
  // Cloning keeps the child's key; its `ref` rides in its props, as React 19 passes it.
  // SAFETY: a clone keeps its element's type, which RAC requires to be a host string.
  const clone = cloneElement(
    child,
    mergeProps({ "data-focusable-child": "" }, forwarded, child.props)
  ) as typeof child;
  return <FocusablePrimitive {...primitiveProps}>{clone}</FocusablePrimitive>;
}

/**
 * React Aria's `useFocusable`, the same function under Fuse's entry. It makes an element
 * focusable and wires its focus and keyboard handlers. Migration debt: dies with the react-aria
 * interim tier.
 *
 * @param props - The focus options, such as `autoFocus`, `excludeFromTabOrder` and the focus and
 * keyboard handlers.
 * @param domRef - The ref of the element to make focusable.
 * @returns The props to spread on the element.
 */
export const useFocusable: typeof useRacFocusable = useRacFocusable;

/**
 * RAC `FocusableOptions` re-export. Migration debt: dies with the react-aria
 * interim tier. Base-ui overlay triggers accept arbitrary render targets, which
 * removes the need for a focus-cloning wrapper.
 */
export type { FocusableOptions };
