"use client";

import type { ReactElement } from "react";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { X } from "../../icons/generated/x";
import { cn } from "../../styles/cn";
import { Button } from "../button/button";
import type { ButtonProps } from "../button/button";
import { overlayCloseStrings } from "./intl";

/**
 * The package-private close button every overlay family shares, so no overlay writes its own close
 * markup. Sheet reuses it unchanged.
 *
 * Pass it to the `render` prop of the overlay's `Close` part, as in
 * `<Dialog.Close render={<OverlayCloseButton />} />`.
 */

export type OverlayCloseButtonProps = Omit<ButtonProps, "aria-label" | "children" | "variant" | "size"> & {
  /**
   * The accessible name. Defaults to the shared `close` row for the active locale. A host that
   * already resolved a `closeLabel` passes it here.
   */
  label?: string;
  /**
   * Extra classes, merged last. The corner close button is this component with
   * `overlayCornerCloseClass`, and an in-flow host passes its header-row classes instead.
   */
  className?: string;
};

/**
 * The shared dismiss control, a ghost `icon-sm` Button with an expanded hit area. Its accessible
 * name comes from the shared overlay dictionary unless `label` sets one.
 */
export function OverlayCloseButton({ label, className, ...props }: OverlayCloseButtonProps): ReactElement {
  const strings = useLocalizedStrings(overlayCloseStrings);

  return (
    <Button
      aria-label={label ?? strings.format("close")}
      variant="ghost"
      size="icon-sm"
      className={cn("hit-area-1", className)}
      {...props}>
      <X />
    </Button>
  );
}

/** Props for the footer close action, a labeled outline Button. */
export type OverlayFooterCloseButtonProps = Omit<
  ButtonProps,
  "aria-label" | "children" | "variant" | "size"
> & {
  /** The visible close text, which the host has already resolved from the shared overlay dictionary. */
  label: string;
};

/**
 * The footer close action, an outline Button with the resolved label as its visible children. It
 * forwards the rest of the Button props, so a host's `render` prop can inject its own close behavior
 * the same way the corner close button does.
 */
export function OverlayFooterCloseButton({ label, ...props }: OverlayFooterCloseButtonProps): ReactElement {
  return (
    <Button variant="outline" {...props}>
      {label}
    </Button>
  );
}
