import { createElement } from "react";
import type { ComponentProps, ReactElement } from "react";

import type { Check } from "@phosphor-icons/react/dist/ssr/Check";

import { decorativeSvgProps } from "./bespoke-svg";

/**
 * Props for every curated Phosphor icon.
 *
 * `title` is the only naming prop: a nonempty title renders `role="img"` and a
 * `<title>`; an omitted or empty title renders the icon decorative
 * (`aria-hidden="true"`, `focusable="false"`). An untitled icon stays
 * `aria-hidden` even with `aria-label`; name it with `title`. Caller
 * `aria-hidden` or `role` still override the defaults.
 */
export type ElmeraIconProps = Omit<ComponentProps<typeof Check>, "alt" | "weight"> & {
  /** Accessible name. Omit it, or pass an empty string, for a decorative icon. */
  title?: string;
  /**
   * Glyph weight. Defaults to `"bold"`; `"regular"` draws a thinner stroke and `"fill"`
   * marks a selected or active state.
   */
  weight?: "regular" | "bold" | "fill";
};

/**
 * Wrap a Phosphor SSR icon in the public icon adapter.
 *
 * @param Icon - The Phosphor SSR icon to render.
 * @param name - The public display name.
 * @returns A server-safe icon component that follows the titled-or-decorative SVG contract.
 */
export function createElmeraIcon(Icon: typeof Check, name: string): (props: ElmeraIconProps) => ReactElement {
  // Bold is the default because Phosphor's regular stroke inks about 28% less than the
  // Lucide set the products used before, at every size; bold tracks it within a few percent.
  function ElmeraIcon({ title, weight = "bold", ...props }: ElmeraIconProps): ReactElement {
    // Phosphor renders its `alt` prop as the `<title>` element.
    return createElement(Icon, { ...decorativeSvgProps(title), ...props, alt: title, weight });
  }
  ElmeraIcon.displayName = name;
  return ElmeraIcon;
}
