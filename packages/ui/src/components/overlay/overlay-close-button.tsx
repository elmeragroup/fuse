"use client";

import type { ReactElement } from "react";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { X } from "../../icons/generated/x";
import { cn } from "../../styles/cn";
import { Button } from "../button/button";
import type { ButtonProps } from "../button/button";
import { overlayCloseStrings } from "./intl";

/**
 * Package-private close-button rendering shared by every overlay family:
 * one canonical close affordance instead of
 * per-overlay hand-rolled markup. Sheet reuses it verbatim.
 *
 * Meant for the overlay's `Close` part `render` prop:
 * `<Dialog.Close render={<OverlayCloseButton />} />`.
 */

/** Positions the close button in the popup's top-right corner. */
export const overlayCornerCloseClass = cn("absolute top-4 right-4");

export type OverlayCloseButtonProps = Omit<ButtonProps, "aria-label" | "children" | "variant" | "size"> & {
  /**
   * Accessible name override. Defaults to the shared `close` row for the active locale,
   * so a host that already resolved a `closeLabel` passes it through here.
   */
  label?: string;
  /**
   * Extra classes merged last. The corner affordance is this component plus
   * `overlayCornerCloseClass`; an in-flow host passes its header-row classes instead.
   */
  className?: string;
};

/**
 * The canonical dismiss control: a ghost `icon-sm` Button with an expanded hit area and
 * an accessible name resolved from the shared overlay dictionary unless `label` wins.
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

/** Props for the footer close action, a labelled outline Button. */
export type OverlayFooterCloseButtonProps = Omit<
  ButtonProps,
  "aria-label" | "children" | "variant" | "size"
> & {
  /** Visible close copy, already resolved by the host from the shared overlay dictionary. */
  label: string;
};

/**
 * Footer close action: outline Button carrying the resolved label as visible children.
 * Forwards the rest of the Button surface, so a host's `render` prop can inject its own
 * close behavior the same way the corner affordance does.
 */
export function OverlayFooterCloseButton({ label, ...props }: OverlayFooterCloseButtonProps): ReactElement {
  return (
    <Button variant="outline" {...props}>
      {label}
    </Button>
  );
}
