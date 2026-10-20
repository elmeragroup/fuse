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
   * The event's date or instant. A string passes through unchanged onto the host `dateTime`, so
   * a server and a browser in different time zones render the same value: a date (`2026-10-20`)
   * or a date-time with an offset (`2026-10-20T10:00Z`, `2026-10-20T10:00+02:00`). A date-time
   * without an offset names a different instant in each time zone, so development builds warn
   * about one. A `Date` is normalized with `toISOString()`. Every invalid value throws
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

/** A time of day after the date, which makes the string a date-time. */
const TIME_PART = /[T ]\d{2}:\d{2}/u;
/** A trailing `Z` or a numeric offset such as `+02:00`, `+0200` or `+02`. */
const OFFSET = /(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/u;

function machineDateTime(date: string | Date): string {
  const timeDate = new Date(date);
  if (Number.isNaN(timeDate.getTime())) {
    throw new RangeError("TimelineList.Time received an invalid date");
  }
  if (date instanceof Date) {
    return timeDate.toISOString();
  }
  if (isThemeDevelopment() && TIME_PART.test(date) && !OFFSET.test(date)) {
    console.warn(
      `TimelineList.Time: "${date}" has no time-zone offset, so it names a different instant in each time zone. Add an offset such as "Z" or "+02:00", or pass a Date.`
    );
  }
  return date;
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
