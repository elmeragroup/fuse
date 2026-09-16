"use client";

import type { ReactElement, ReactNode } from "react";

import {
  Calendar as AriaCalendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader as AriaCalendarGridHeader,
  CalendarHeaderCell,
  Heading as AriaHeading,
  Text as AriaText,
  useLocale,
} from "react-aria-components";
import type { CalendarProps as AriaCalendarProps, DateValue } from "react-aria-components";

import { Heading } from "../../components/heading/heading";
import { Text } from "../../components/text/text";
import { CaretLeft } from "../../icons/generated/caret-left";
import { CaretRight } from "../../icons/generated/caret-right";
import { calendarVariants, cellVariants } from "../../styles/calendar";
import { Button } from "../internal/button";
import { composeTailwindRenderProps } from "../internal/utils";

/**
 * Single-month calendar composite over RAC `Calendar`. The locale controls layout
 * direction. RTL calendars use narrow weekday labels with full accessible names.
 * Client — the interim react-aria cluster owns grid state, selection, and focus.
 */
export type CalendarProps<T extends DateValue> = {
  /**
   * Error copy, rendered through the public Text onto RAC `Text slot="errorMessage"`
   * when present. Calendar has no ValidationResult render face.
   */
  errorMessage?: ReactNode;
} & Omit<AriaCalendarProps<T>, "children" | "visibleDuration">;

export function Calendar<T extends DateValue>({
  errorMessage,
  className,
  ...props
}: CalendarProps<T>): ReactElement {
  const { base, body, error } = calendarVariants();
  const { direction } = useLocale();

  return (
    <AriaCalendar dir={direction} {...props} className={composeTailwindRenderProps(className, base())}>
      <CalendarHeader />
      <CalendarGrid className={body()} weekdayStyle={direction === "rtl" ? "narrow" : "short"}>
        <CalendarGridHeader />
        <CalendarGridBody>
          {(date) => <CalendarCell date={date} className={(values) => cellVariants(values)} />}
        </CalendarGridBody>
      </CalendarGrid>
      {errorMessage ? (
        <Text className={error()} render={<AriaText slot="errorMessage" />}>
          {errorMessage}
        </Text>
      ) : null}
    </AriaCalendar>
  );
}

/**
 * Month navigation row. Reads `useLocale()` so caret icons flip in RTL.
 * The month title is the public Heading rendered onto RAC Heading.
 * Reused by RangeCalendar.
 */
export function CalendarHeader(): ReactElement {
  const { direction } = useLocale();
  const { header, heading } = calendarVariants();

  return (
    <header className={header()}>
      <Button variant="ghost" size="icon" slot="previous">
        {direction === "rtl" ? <CaretRight aria-hidden /> : <CaretLeft aria-hidden />}
      </Button>
      <Heading size="lg" className={heading()} render={<AriaHeading />} />
      <Button variant="ghost" size="icon" slot="next">
        {direction === "rtl" ? <CaretLeft aria-hidden /> : <CaretRight aria-hidden />}
      </Button>
    </header>
  );
}

/**
 * Weekday column-header row. Reused by RangeCalendar.
 */
export function CalendarGridHeader(): ReactElement {
  const { headerCell } = calendarVariants();
  return (
    <AriaCalendarGridHeader>
      {(day) => <CalendarHeaderCell className={headerCell()}>{day}</CalendarHeaderCell>}
    </AriaCalendarGridHeader>
  );
}

Calendar.displayName = "Calendar";
CalendarHeader.displayName = "CalendarHeader";
CalendarGridHeader.displayName = "CalendarGridHeader";
