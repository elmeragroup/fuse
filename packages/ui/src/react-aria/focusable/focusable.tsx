"use client";

import type { FocusableOptions } from "react-aria";
import { useFocusable } from "react-aria";
import { Focusable } from "react-aria-components";

/**
 * RAC `Focusable` and `useFocusable` re-exports. Migration debt: dies with the react-aria interim
 * tier. Base-ui overlay triggers accept arbitrary render targets, which removes
 * the need for a focus-cloning wrapper.
 */
export { Focusable, useFocusable };

/**
 * RAC `FocusableOptions` re-export. Migration debt: dies with the react-aria
 * interim tier. Base-ui overlay triggers accept arbitrary render targets, which
 * removes the need for a focus-cloning wrapper.
 */
export type { FocusableOptions };
