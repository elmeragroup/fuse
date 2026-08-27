"use client";

import { use, useEffect, useState } from "react";
import type { ComponentProps, ReactElement, ReactNode, RefObject } from "react";

import { getLocalTimeZone, toCalendarDate, today } from "@internationalized/date";
import type { CalendarDate } from "@internationalized/date";
import {
  DatePicker as AriaDatePicker,
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  DatePickerStateContext,
  DialogContext,
} from "react-aria-components";
import type {
  DatePickerProps as AriaDatePickerProps,
  DateValue,
  ValidationResult,
} from "react-aria-components";

import { buttonVariants } from "../../components/button/button-variants";
import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { CalendarBlank } from "../../icons/generated/calendar-blank";
import { datePickerVariants } from "../../styles/date-picker";
import { Calendar } from "../calendar/calendar";
import { DateInput } from "../date-field/date-field";
import { Button } from "../internal/button";
import { Dialog } from "../internal/dialog";
import { Description, FieldError, FieldGroup, Label } from "../internal/field";
import { Popover } from "../internal/popover";
import { composeTailwindRenderProps } from "../internal/utils";
import { datePickerStrings } from "./intl";

/**
 * Labeled date-picker composite over RAC `DatePicker` (date-picker.md §2/§3): the public
 * `DateInput` and `Calendar` joined by the package-private popover/dialog/button chrome.
 * Client — the interim react-aria cluster owns segment state, overlay state and the
 * focused-month sync below.
 */
export type DatePickerProps<T extends DateValue> = {
  /** Visible label, rendered as the private RAC `Label`. */
  label?: string;
  /** Supporting copy, rendered as the private RAC `Description`. */
  description?: string;
  /**
   * Error copy, rendered as `FieldError` when the picker is invalid. Accepts a node or a
   * validation render function (§8.4 widens the reference's string-only face).
   */
  errorMessage?: ReactNode | ((validation: ValidationResult) => ReactNode);
  /**
   * The default value (uncontrolled). Widened to allow an explicit `null` so a form can
   * reset the picker to empty without dropping the prop (§8.5).
   */
  defaultValue?: T | null;
  /**
   * Quick-choice pane rendered beside the calendar — normally a
   * `DatePickerPresetGroup`. A renderable node is what turns the dialog into two panes;
   * a falsy one (`false` from a `&&` guard, `null`, `""`) keeps the single pane.
   */
  presetGroup?: ReactNode;
  /**
   * Pads day and month segments with a leading zero. The reference flips RAC's
   * locale-dependent default; this port keeps that flip.
   * @default true
   */
  shouldForceLeadingZeros?: boolean;
  /**
   * Portal target for the popover. Defaults to the nearest `ThemeScope`, so the overlay
   * inherits the theme it was opened from (theming.md §7.4); an explicit element or ref
   * wins.
   */
  container?: HTMLElement | RefObject<HTMLElement | null>;
} & Omit<AriaDatePickerProps<T>, "defaultValue" | "shouldForceLeadingZeros">;

/**
 * The month the popover opens on: the selected date's month, or the current month when
 * there is no value (date-picker.md §2 — the today-fallback is kept from the reference).
 */
function focusedMonthFor<T extends DateValue>(value: T | null | undefined): CalendarDate {
  return toCalendarDate(value ?? today(getLocalTimeZone()));
}

/**
 * Whether a node a caller handed us would paint anything. `presetGroup={showPresets &&
 * <DatePickerPresetGroup />}` is the idiomatic conditional, so `false` — like `null`,
 * `undefined` and `""` — has to read as "no preset pane" and leave the dialog in its
 * single-pane layout (§2).
 */
function isRenderableNode(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false && node !== "";
}

/**
 * The popover's dialog, named the way RAC intends.
 *
 * `useDatePicker` publishes `aria-labelledby` ("Calendar" plus the field label) on
 * `DialogContext`, but RAC's Dialog honours a context label only as a fallback for a
 * dialog without a `<Heading slot="title">`. The private styled Dialog always renders its
 * heading, and with no `title` that heading is empty — which would silently become the
 * dialog's accessible name. Forwarding the context value as an explicit prop restores the
 * §7 name without touching the internal (whose heading gating is ticket 17's business).
 */
function PickerDialog({ children, className }: { children: ReactNode; className: string }): ReactElement {
  const context = use(DialogContext);
  const labelledBy =
    context !== null && context !== undefined && "aria-labelledby" in context
      ? context["aria-labelledby"]
      : undefined;

  return (
    <Dialog aria-labelledby={labelledBy} className={className} closeButton={false}>
      {children}
    </Dialog>
  );
}

/**
 * The popover's calendar, month-synced to the picker's own committed value.
 *
 * The month the grid shows is local state so paging never rewrites the value, and it is
 * derived from the RAC `DatePickerStateContext` rather than from `props.value` — that is
 * what makes the sync hold for an uncontrolled `defaultValue` picker as well as a
 * controlled one (§8.11), because `state.value` is the committed value in both modes.
 * Two triggers cover §2's stated effect: the popover unmounts its content on close, so
 * this component mounts once per open and the `useState` initializer *is* the per-open
 * resync, while the effect follows a value that changes with the dialog still open — a
 * preset pane lives inside the popover. The compare guard keeps that effect from
 * committing a fresh, equal `CalendarDate` on every mount.
 */
function PickerCalendar({ className }: { className: string }): ReactElement {
  const state = use(DatePickerStateContext);
  const value = state?.value;
  const [focusedValue, setFocusedValue] = useState(() => focusedMonthFor(value));

  useEffect(() => {
    const month = focusedMonthFor(value);
    setFocusedValue((current) => (current.compare(month) === 0 ? current : month));
  }, [value]);

  return <Calendar className={className} focusedValue={focusedValue} onFocusChange={setFocusedValue} />;
}

export function DatePicker<T extends DateValue>({
  className,
  container,
  description,
  errorMessage,
  isReadOnly,
  label,
  presetGroup,
  shouldForceLeadingZeros = true,
  ...props
}: DatePickerProps<T>): ReactElement {
  const { base, calendar, dialog, group, icon, input } = datePickerVariants({ isReadOnly });

  return (
    <AriaDatePicker
      {...props}
      isReadOnly={isReadOnly}
      shouldForceLeadingZeros={shouldForceLeadingZeros}
      className={composeTailwindRenderProps(className, base())}>
      {label ? <Label>{label}</Label> : null}
      <FieldGroup className={group()}>
        <DateInput className={input()} />
        {/* oxlint-disable-next-line elmera/require-icon-button-label -- date-picker.md §7: RAC's DatePicker fills this default Button slot and supplies the trigger's localized accessible name ("Calendar"); a local label would shadow it. Asserted in the browser suite. */}
        <Button size="icon-sm" variant="ghost">
          <CalendarBlank aria-hidden className={icon()} />
        </Button>
      </FieldGroup>
      {description ? <Description>{description}</Description> : null}
      <FieldError>{errorMessage}</FieldError>
      <Popover container={container} placement="bottom right">
        <PickerDialog className={dialog()}>
          <div className={isRenderableNode(presetGroup) ? "flex gap-x-3 divide-x pr-3 pb-3" : undefined}>
            {presetGroup}
            <PickerCalendar className={calendar()} />
          </div>
        </PickerDialog>
      </Popover>
    </AriaDatePicker>
  );
}

export type DatePickerPresetGroupProps = ComponentProps<typeof AriaRadioGroup> & {
  /**
   * Accessible name for the preset pane. Defaults to the `datePicker.presets` row of
   * the locale dictionary (accessibility.md §4.1); an explicit string wins.
   */
  label?: string;
};

/**
 * The quick-choice pane beside the calendar: a radio group whose options are dates.
 * Only one preset can be in effect at a time, which is why this is a `radiogroup` and
 * not a row of buttons (§7).
 */
export function DatePickerPresetGroup({
  className,
  label,
  ...props
}: DatePickerPresetGroupProps): ReactElement {
  const strings = useLocalizedStrings(datePickerStrings);

  return (
    <AriaRadioGroup
      data-slot="date-picker-preset-group"
      {...props}
      aria-label={label ?? strings.format("presets")}
      className={composeTailwindRenderProps(className, "flex flex-col gap-2 px-3")}
    />
  );
}

export type DatePickerPresetItemProps = ComponentProps<typeof AriaRadio> & {
  /**
   * Supporting copy carried alongside the preset, kept from the reference face (§3).
   * RAC `Radio` renders only its children, so this never joins the accessible name.
   */
  description?: string;
  /**
   * Closes the picker dialog on double-click, after the caller's own `onDoubleClick`.
   * A pointer-only affordance: single click (and Space from the keyboard) selects
   * without closing, so nothing is reachable by pointer alone.
   */
  isCloseDialogOnDoubleClick?: boolean;
};

/**
 * One preset. Styled as a ghost `sm` button from the shared public `buttonVariants`
 * recipe (§4) so a preset reads as the affordance it is, and named by its visible
 * children — the library never synthesises copy from the item's `value` (§8.8).
 */
export function DatePickerPresetItem({
  className,
  isCloseDialogOnDoubleClick,
  onDoubleClick,
  ...props
}: DatePickerPresetItemProps): ReactElement {
  const state = use(DatePickerStateContext);

  return (
    <AriaRadio
      data-slot="date-picker-preset-item"
      {...props}
      className={composeTailwindRenderProps(
        className,
        buttonVariants({
          size: "sm",
          variant: "ghost",
          // The radio's own indicator, if a caller's children render one, stays hidden:
          // the preset is a button-shaped choice, not a bullet list (§3).
          className:
            "justify-start text-left data-disabled:pointer-events-none data-selected:bg-accent *:data-[slot=radio-indicator]:hidden",
        })
      )}
      onDoubleClick={(event) => {
        onDoubleClick?.(event);

        if (isCloseDialogOnDoubleClick === true && state !== null && state.isOpen) {
          state.close();
        }
      }}
    />
  );
}

DatePicker.displayName = "DatePicker";
DatePickerPresetGroup.displayName = "DatePickerPresetGroup";
DatePickerPresetItem.displayName = "DatePickerPresetItem";
