"use client";

import type { ReactNode } from "react";

import { CheckboxItem } from "@elmeragroup/fuse/checkbox";
import { RadioItem } from "@elmeragroup/fuse/radio-group";

/** A client row around the title and SubSection a server component writes. */
type PlanRowProps = { readonly value: string; readonly children?: ReactNode };

/**
 * The client row of the "Server checkbox rows" demo. A real row of this kind adds what needs the
 * client, such as state or a handler, and the server component still writes its children.
 */
export function AddOnRow({ value, children }: PlanRowProps) {
  return <CheckboxItem value={value}>{children}</CheckboxItem>;
}

/** The client row of the "Server radio rows" demo, rendered around server children. */
export function TariffRow({ value, children }: PlanRowProps) {
  return <RadioItem value={value}>{children}</RadioItem>;
}
