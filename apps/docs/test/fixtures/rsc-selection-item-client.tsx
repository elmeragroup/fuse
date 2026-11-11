"use client";

/**
 * A consumer's client rows for the SelectionItem Flight fixture. Each wraps `CheckboxItem` or
 * `RadioItem` around the children a server page passes it, so the row partitions SubSections
 * that crossed Flight rather than ones it created.
 */
import type { ReactElement, ReactNode } from "react";

import { CheckboxItem } from "@elmeragroup/fuse/checkbox";
import { RadioItem } from "@elmeragroup/fuse/radio-group";

/** Props of a client row: the children a server component wrote. */
type ClientRowProps = { readonly children?: ReactNode };

/**
 * A client component that renders `CheckboxItem` around server-authored children.
 *
 * @param props - The row's children.
 * @returns The checkbox row.
 */
export function ClientCheckboxRow({ children }: ClientRowProps): ReactElement {
  return <CheckboxItem value="fixed">{children}</CheckboxItem>;
}

/**
 * A client component that renders `RadioItem` around server-authored children.
 *
 * @param props - The row's children.
 * @returns The radio row.
 */
export function ClientRadioRow({ children }: ClientRowProps): ReactElement {
  return <RadioItem value="spot">{children}</RadioItem>;
}
