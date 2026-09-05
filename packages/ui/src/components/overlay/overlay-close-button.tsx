import type { ReactElement } from "react";

import { X } from "../../icons/generated/x";
import { cn } from "../../styles/cn";
import { Button } from "../button/button";

/**
 * Package-private close-button rendering shared by every overlay family
 * (dialog.md §8.3, sheet.md §8.3): one canonical close affordance instead of
 * per-overlay hand-rolled markup. Sheet reuses these renderers verbatim.
 *
 * The returned elements are meant for the overlay's `Close` part `render` prop:
 * `<Dialog.Close render={overlayCornerCloseButton({ label })} />`.
 */

/** Corner dismiss affordance: ghost `icon-sm` Button, expanded hit area, `aria-label`. */
export function overlayCornerCloseButton({
  label,
  className,
}: {
  label: string;
  className?: string;
}): ReactElement {
  return (
    <Button
      aria-label={label}
      variant="ghost"
      size="icon-sm"
      className={cn("hit-area-1 absolute top-4 right-4", className)}>
      <X />
    </Button>
  );
}

/** Footer close action: outline Button carrying the resolved label as visible children. */
export function overlayFooterCloseButton({
  label,
  className,
}: {
  label: string;
  className?: string;
}): ReactElement {
  return (
    <Button variant="outline" className={className}>
      {label}
    </Button>
  );
}
