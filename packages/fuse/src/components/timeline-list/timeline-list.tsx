import type { ComponentProps, ComponentPropsWithoutRef, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { isThemeDevelopment } from "../../theme/validate-theme";
import { Heading } from "../heading/heading";
import { timelineListVariants } from "./timeline-list-variants";

/** Resolved once at module scope — the recipe has no axes (no per-render work). */
const { root, item, dot, title, time, description } = timelineListVariants();

export type TimelineListRootProps = ComponentProps<"ol">;
export type TimelineListItemProps = ComponentProps<"li">;
export type TimelineListTitleProps = Omit<ComponentPropsWithoutRef<typeof Heading>, "noMargin">;
export type TimelineListTimeProps = Omit<ComponentProps<"time">, "dateTime"> & {
  /**
   * The event's date or instant. An HTML date or date-time string passes through unchanged onto
   * the host `dateTime`, so a server and a browser in different time zones render the same value:
   * a date (`2026-10-20`) or a date-time with an offset (`2026-10-20T10:00Z`,
   * `2026-10-20T10:00+02:00`). A date-time without an offset names a different instant in each
   * time zone, so development builds warn about one. A `Date`, or another string the JavaScript
   * date parser reads (`June 15, 2024`, or `2024-02-30`, which it rolls over to March 1), is
   * normalized with `toISOString()`. Every invalid value throws
   * `RangeError("TimelineList.Time received an invalid date")`.
   */
  date: string | Date;
};
export type TimelineListDescriptionProps = ComponentProps<"div">;

function TimelineListRoot({ className, ...props }: TimelineListRootProps): ReactElement {
  return <ol data-slot="timeline-list" className={cn(root(), className)} {...props} />;
}

function TimelineListItem({ className, children, ...props }: TimelineListItemProps): ReactElement {
  return (
    <li data-slot="timeline-list-item" className={cn(item(), className)} {...props}>
      <span data-slot="timeline-list-dot" aria-hidden="true" className={dot()} />
      {children}
    </li>
  );
}

function TimelineListTitle({ className, level = 3, ...props }: TimelineListTitleProps): ReactElement {
  return (
    <Heading
      data-slot="timeline-list-title"
      className={cn(title(), className)}
      level={level}
      {...props}
      noMargin
    />
  );
}

/**
 * An HTML valid date (`2026-10-20`) or date-time (`2026-10-20T10:00`, with optional seconds and
 * fraction) in the `time` group, with its optional time-zone offset (`Z`, `+02:00` or `+0200`)
 * in the `offset` group. The JavaScript parser also reads a lowercase `z`; HTML does not.
 */
const HTML_DATE_TIME =
  /^(?<year>\d{4,})-(?<month>\d{2})-(?<day>\d{2})(?<time>[T ](?<hour>\d{2}):\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?<offset>Z|[+-]\d{2}:?\d{2})?)?$/u;

/**
 * Whether a grammar match names a day that fits its month and an hour from 00 to 23. The
 * JavaScript parser rolls `2024-02-30` over to March 1 and `T24:00` over to the next day, where
 * HTML rejects both.
 */
function fitsCalendar({ year, month, day, hour }: Record<string, string | undefined>): boolean {
  const calendarDay = new Date(0);
  calendarDay.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  return calendarDay.getUTCDate() === Number(day) && (hour === undefined || Number(hour) < 24);
}

function machineDateTime(date: string | Date): string {
  const timeDate = new Date(date);
  if (Number.isNaN(timeDate.getTime())) {
    throw new RangeError("TimelineList.Time received an invalid date");
  }
  const grammar = date instanceof Date ? null : HTML_DATE_TIME.exec(date);
  if (grammar?.groups === undefined || !fitsCalendar(grammar.groups)) {
    return timeDate.toISOString();
  }
  const { time, offset } = grammar.groups;
  if (isThemeDevelopment() && time !== undefined && offset === undefined) {
    console.warn(
      `TimelineList.Time: "${grammar.input}" has no time-zone offset, so it names a different instant in each time zone. Add an offset such as "Z" or "+02:00", or pass a Date.`
    );
  }
  return grammar.input;
}

function TimelineListTime({ children, className, date, ...props }: TimelineListTimeProps): ReactElement {
  return (
    <time
      data-slot="timeline-list-time"
      className={cn(time(), className)}
      {...props}
      dateTime={machineDateTime(date)}>
      {children}
    </time>
  );
}

function TimelineListDescription({ className, ...props }: TimelineListDescriptionProps): ReactElement {
  return <div data-slot="timeline-list-description" className={cn(description(), className)} {...props} />;
}

TimelineListRoot.displayName = "TimelineList.Root";
TimelineListItem.displayName = "TimelineList.Item";
TimelineListTitle.displayName = "TimelineList.Title";
TimelineListTime.displayName = "TimelineList.Time";
TimelineListDescription.displayName = "TimelineList.Description";

export const TimelineList = {
  Root: TimelineListRoot,
  Item: TimelineListItem,
  Title: TimelineListTitle,
  Time: TimelineListTime,
  Description: TimelineListDescription,
};
