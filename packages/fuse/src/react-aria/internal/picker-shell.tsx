"use client";

import type { ReactElement, ReactNode } from "react";

import type { ValidationResult } from "react-aria-components";

import type { OverlayContainerProps } from "../../components/overlay/overlay-props";
import { CalendarBlank } from "../../icons/generated/calendar-blank";
import { useLocale } from "../../intl/locale-context";
import { pickerVariants } from "../../styles/picker";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Description, FieldError, FieldGroup, Label } from "./field";
import { Popover } from "./popover";

/**
 * The chrome both date pickers share: label, field box, trigger, help text, and the
 * popover and dialog the grid opens into. Only the segment rows and the popover body
 * differ between DatePicker and DateRangePicker, so those are the `children` and
 * `popover` props and everything else lives here.
 *
 * Package-private, like every module in this directory.
 *
 * Two things the shell is deliberately the sole owner of:
 *
 *  - **The read-only fill.** The picker recipe used to paint it twice — `bg-muted` on
 *    its `group` slot and again on its `icon` slot — while `fieldGroupVariants` has
 *    carried an `isReadOnly` axis all along and DateField already routed state through it. The shell
 *    hands `isReadOnly` to the FieldGroup and nothing else paints it.
 *  - **The trigger's missing label.** RAC's `useDatePicker` / `useDateRangePicker` fills
 *    this default `Button` slot and supplies the localized accessible name ("Calendar"
 *    plus the field label); a local label would shadow it. That was two identical lint
 *    disables at two call sites and is now one.
 *
 * The dialog is the styled private `Dialog` with `closeButton={false}` and no `title`,
 * which supplies the accessible name: an untitled styled Dialog renders no heading,
 * so the name RAC publishes on `DialogContext` reaches the overlay unopposed. See
 * `internal/dialog.tsx` for why a rendered-but-empty heading would take that name instead.
 */
export type PickerShellProps = {
  /** Visible label, rendered as the private RAC `Label`. Omitted when absent. */
  label?: string;
  /** Supporting copy, rendered as the private RAC `Description`. */
  description?: string;
  /** Error copy, rendered as `FieldError` when the picker is invalid. */
  errorMessage?: ReactNode | ((validation: ValidationResult) => ReactNode);
  /** Paints the read-only fill on the field box — the only place it is painted. */
  isReadOnly?: boolean;
  /** Portal target for the popover, forwarded to the private RAC `Popover`. */
  container?: OverlayContainerProps["container"];
  /**
   * The picker's `range` axis. The shell resolves its own four slots from
   * `pickerVariants` rather than taking them as class strings: they always come from one
   * recipe call with one axis, so the axis is the honest parameter.
   */
  range?: boolean;
  /**
   * Which side of the segment row the trigger sits on, in DOM, tab and visual order.
   * Only DatePicker passes `"start"`: the range grid places its trigger column itself.
   * RAC's arrow-key and pointer focus walk the group in DOM order, so either order works.
   */
  triggerPlacement?: "start" | "end";
  /** The segment row(s) inside the field box, beside the trigger. */
  children: ReactNode;
  /** The popover body: a Calendar, a RangeCalendar, or a preset pane beside one. */
  popover: ReactNode;
};

export function PickerShell({
  children,
  container,
  description,
  errorMessage,
  isReadOnly,
  label,
  popover,
  range,
  triggerPlacement = "end",
}: PickerShellProps): ReactElement {
  // Throw for a missing LocaleProvider when the picker mounts. Nothing else in a closed
  // picker reads Fuse's locale: the calendar uses React Aria's, and the dialog and preset
  // pane that read Fuse strings mount only when the popover opens, which would defer the
  // error to the first click on the trigger.
  useLocale();
  const { dialog, group, icon, trigger } = pickerVariants({ range });
  const button = (
    // oxlint-disable-next-line elmera/require-icon-button-label -- RAC's DatePicker and DateRangePicker fill this default Button slot and supply the trigger's localized accessible name ("Calendar"); a local label would shadow it. Asserted in both browser suites.
    <Button size="icon-sm" variant="ghost" className={trigger()}>
      <CalendarBlank aria-hidden className={icon()} />
    </Button>
  );

  return (
    <>
      {label ? <Label>{label}</Label> : null}
      <FieldGroup className={group()} isReadOnly={isReadOnly}>
        {triggerPlacement === "start" ? button : null}
        {children}
        {triggerPlacement === "end" ? button : null}
      </FieldGroup>
      {description ? <Description>{description}</Description> : null}
      <FieldError>{errorMessage}</FieldError>
      <Popover container={container} placement="bottom right">
        <Dialog className={dialog()} closeButton={false}>
          {popover}
        </Dialog>
      </Popover>
    </>
  );
}

PickerShell.displayName = "ReactAriaInternal.PickerShell";
