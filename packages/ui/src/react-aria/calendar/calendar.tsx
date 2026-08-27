"use client";

import { useId } from "react";
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
import { tv } from "tailwind-variants";

import { Heading } from "../../components/heading/heading";
import { Text } from "../../components/text/text";
import { CaretLeft } from "../../icons/generated/caret-left";
import { CaretRight } from "../../icons/generated/caret-right";
import { cn } from "../../styles/cn";
import { focusRing } from "../../styles/utils";
import { Button } from "../internal/button";
import { composeTailwindRenderProps } from "../internal/utils";

/**
 * Single-month calendar composite over RAC `Calendar` (calendar.md §2/§3).
 * Client — the interim react-aria cluster owns grid state, selection, and focus.
 */
export type CalendarProps<T extends DateValue> = {
  /**
   * Error copy, rendered through the public Text onto RAC `Text slot="errorMessage"`
   * when present. Calendar has no ValidationResult render face.
   */
  errorMessage?: ReactNode;
} & Omit<AriaCalendarProps<T>, "children" | "visibleDuration">;

const cellVariants = tv({
  // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- calendar.md §4/§5 decorative day-cell circle, not a control-box rung
  base: cn(
    "text-sm flex size-9 cursor-default items-center justify-center rounded-full forced-color-adjust-none",
    focusRing({ target: "state" }).root()
  ),
  variants: {
    isFocusVisible: {
      true: focusRing({ target: "state", isFocusVisible: true }).root(),
      false: "",
    },
    isSelected: {
      false: "text-foreground hover:bg-muted aria-pressed:bg-accent",
      true: "bg-primary text-primary-foreground invalid:bg-error forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:invalid:bg-[Mark]",
    },
    isDisabled: {
      true: "text-muted-foreground hover:bg-transparent forced-colors:text-[GrayText]",
    },
    isUnavailable: {
      true: "text-muted-foreground hover:bg-transparent forced-colors:text-[GrayText]",
    },
  },
});

const calendarVariants = tv({
  slots: {
    base: "max-w-sm rounded text-sm shadow-md min-h-80 min-w-32 border border-border bg-card bg-clip-padding p-2 text-card-foreground will-change-transform",
    header: "flex w-full items-center gap-1 px-1 pb-4",
    heading: "mx-2 flex-1 text-center",
    headerCell: "text-sm font-medium text-muted-foreground",
    body: "mx-auto my-0 min-h-[246px]",
    cell: cellVariants(),
    error: "text-sm text-error",
  },
});

export function Calendar<T extends DateValue>({
  errorMessage,
  className,
  ...props
}: CalendarProps<T>): ReactElement {
  const { base, body, error } = calendarVariants();
  const errorMessageId = useId();
  const describedBy =
    [props["aria-describedby"], errorMessage && props.isInvalid ? errorMessageId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <AriaCalendar
      {...props}
      aria-describedby={describedBy}
      className={composeTailwindRenderProps(className, base())}>
      <CalendarHeader />
      <CalendarGrid className={body()} weekdayStyle="short">
        <CalendarGridHeader />
        <CalendarGridBody>
          {(date) => <CalendarCell date={date} className={(values) => cellVariants(values)} />}
        </CalendarGridBody>
      </CalendarGrid>
      {errorMessage ? (
        <Text id={errorMessageId} className={error()} render={<AriaText slot="errorMessage" />}>
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
