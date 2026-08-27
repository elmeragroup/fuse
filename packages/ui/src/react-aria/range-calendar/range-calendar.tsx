"use client";

import type { ReactElement, ReactNode } from "react";

import {
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  RangeCalendar as AriaRangeCalendar,
  Text as AriaText,
} from "react-aria-components";
import type { DateValue, RangeCalendarProps as AriaRangeCalendarProps } from "react-aria-components";
import type { VariantProps } from "tailwind-variants";

import { Text } from "../../components/text/text";
import { rangeCalendarVariants } from "../../styles/range-calendar";
import { CalendarGridHeader, CalendarHeader } from "../calendar/calendar";

/**
 * Single-month range calendar composite over RAC `RangeCalendar` (range-calendar.md
 * §2/§3). Client — the interim react-aria cluster owns range state, anchoring and focus.
 *
 * The header row and the weekday header row are Calendar's public parts, not copies:
 * they are the reuse seam the calendar spec §2 mints them for.
 */
export type RangeCalendarProps<T extends DateValue> = {
  /**
   * Error copy, rendered through the public Text onto RAC `Text slot="errorMessage"`
   * when present. RangeCalendar has no ValidationResult render face.
   */
  errorMessage?: ReactNode;
} & Omit<AriaRangeCalendarProps<T>, "children" | "visibleDuration">;

type SelectionState = NonNullable<VariantProps<typeof rangeCalendarVariants>["selectionState"]>;

/**
 * Which of the pill's three fills a date wears (§2). A cap is either end of the
 * highlighted range — including the single-day range where both ends are the same date.
 */
function getSelectionState(
  isSelected: boolean,
  isSelectionStart: boolean,
  isSelectionEnd: boolean
): SelectionState {
  if (isSelected && (isSelectionStart || isSelectionEnd)) {
    return "cap";
  }
  if (isSelected) {
    return "middle";
  }
  return "none";
}

export function RangeCalendar<T extends DateValue>({
  errorMessage,
  ...props
}: RangeCalendarProps<T>): ReactElement {
  const { body, outerCell, error } = rangeCalendarVariants();

  return (
    <AriaRangeCalendar {...props}>
      <CalendarHeader />
      <CalendarGrid className={body()}>
        <CalendarGridHeader />
        <CalendarGridBody>
          {(date) => (
            <CalendarCell date={date} className={outerCell()}>
              {({
                formattedDate,
                isSelected,
                isSelectionStart,
                isSelectionEnd,
                isFocusVisible,
                isDisabled,
              }) => (
                <span
                  className={rangeCalendarVariants({
                    selectionState: getSelectionState(isSelected, isSelectionStart, isSelectionEnd),
                    isDisabled,
                    isFocusVisible,
                  }).cell()}>
                  {formattedDate}
                </span>
              )}
            </CalendarCell>
          )}
        </CalendarGridBody>
      </CalendarGrid>
      {errorMessage ? (
        <Text className={error()} render={<AriaText slot="errorMessage" />}>
          {errorMessage}
        </Text>
      ) : null}
    </AriaRangeCalendar>
  );
}

RangeCalendar.displayName = "RangeCalendar";
