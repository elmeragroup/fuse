"use client";

import type { ReactElement, ReactNode, RefObject } from "react";

import type { ValidationResult } from "react-aria-components";

import { CalendarBlank } from "../../icons/generated/calendar-blank";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Description, FieldError, FieldGroup, Label } from "./field";
import { Popover } from "./popover";

/**
 * The chrome both date pickers wear (date-picker.md §2, date-range-picker.md §2): label,
 * field box, trigger, help text, and the popover/dialog the grid opens into. Only the
 * segment row(s) and the popover body differ between DatePicker and DateRangePicker, so
 * those two are the `children` and `popover` props and everything else lives here once
 * (spec 08 user story 5, 2026-09-03).
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
 * which is what gives §7's accessible name: an untitled styled Dialog renders no heading,
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
  container?: HTMLElement | RefObject<HTMLElement | null>;
  /** `pickerVariants().group()` — the field box's layout width. */
  groupClassName: string;
  /** `pickerVariants().icon()` — the trigger glyph. */
  iconClassName: string;
  /** `pickerVariants().dialog()` — the styled Dialog's padding override. */
  dialogClassName: string;
  /** The segment row(s) inside the field box, ahead of the trigger. */
  children: ReactNode;
  /** The popover body: a Calendar, a RangeCalendar, or a preset pane beside one. */
  popover: ReactNode;
};

export function PickerShell({
  children,
  container,
  description,
  dialogClassName,
  errorMessage,
  groupClassName,
  iconClassName,
  isReadOnly,
  label,
  popover,
}: PickerShellProps): ReactElement {
  return (
    <>
      {label ? <Label>{label}</Label> : null}
      <FieldGroup className={groupClassName} isReadOnly={isReadOnly}>
        {children}
        {/* oxlint-disable-next-line elmera/require-icon-button-label -- date-picker.md §7 / date-range-picker.md §7: RAC's DatePicker and DateRangePicker fill this default Button slot and supply the trigger's localized accessible name ("Calendar"); a local label would shadow it. Asserted in both browser suites. */}
        <Button size="icon-sm" variant="ghost">
          <CalendarBlank aria-hidden className={iconClassName} />
        </Button>
      </FieldGroup>
      {description ? <Description>{description}</Description> : null}
      <FieldError>{errorMessage}</FieldError>
      <Popover container={container} placement="bottom right">
        <Dialog className={dialogClassName} closeButton={false}>
          {popover}
        </Dialog>
      </Popover>
    </>
  );
}

PickerShell.displayName = "ReactAriaInternal.PickerShell";
