import type { ComponentProps, ComponentPropsWithoutRef, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { Heading } from "../heading/heading";
import { timelineListVariants } from "./timeline-list-variants";

export type TimelineListRootProps = ComponentProps<"ol">;
export type TimelineListItemProps = ComponentProps<"li">;
export type TimelineListTitleProps = Omit<ComponentPropsWithoutRef<typeof Heading>, "noMargin">;
export type TimelineListTimeProps = Omit<ComponentProps<"time">, "dateTime"> & {
  /**
   * Event instant. A `Date` or parseable string, normalized with
   * `new Date(date).toISOString()` onto the host `dateTime`. Every invalid value
   * throws `RangeError("TimelineList.Time received an invalid date")`.
   */
  date: string | Date;
};
export type TimelineListDescriptionProps = ComponentProps<"div">;

function TimelineListRoot({ className, ...props }: TimelineListRootProps): ReactElement {
  const { root } = timelineListVariants();
  return <ol data-slot="timeline-list" className={cn(root(), className)} {...props} />;
}

function TimelineListItem({ className, children, ...props }: TimelineListItemProps): ReactElement {
  const { item, dot } = timelineListVariants();
  return (
    <li data-slot="timeline-list-item" className={cn(item(), className)} {...props}>
      <span data-slot="timeline-list-dot" aria-hidden="true" className={dot()} />
      {children}
    </li>
  );
}

function TimelineListTitle({ className, level = 3, ...props }: TimelineListTitleProps): ReactElement {
  const { title } = timelineListVariants();
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

function isoDateTime(date: string | Date): string {
  const timeDate = new Date(date);
  if (Number.isNaN(timeDate.getTime())) {
    throw new RangeError("TimelineList.Time received an invalid date");
  }
  return timeDate.toISOString();
}

function TimelineListTime({ children, className, date, ...props }: TimelineListTimeProps): ReactElement {
  const { time } = timelineListVariants();
  return (
    <time
      data-slot="timeline-list-time"
      className={cn(time(), className)}
      {...props}
      dateTime={isoDateTime(date)}>
      {children}
    </time>
  );
}

function TimelineListDescription({ className, ...props }: TimelineListDescriptionProps): ReactElement {
  const { description } = timelineListVariants();
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
