"use client";

import type { FocusableOptions } from "react-aria";
import { useFocusable as useRacFocusable } from "react-aria";
import { Focusable } from "react-aria-components";

/**
 * RAC `Focusable` re-export. Migration debt: dies with the react-aria interim tier. Base-ui
 * overlay triggers accept arbitrary render targets, which removes the need for a focus-cloning
 * wrapper.
 */
export { Focusable };

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
