import type { ComponentProps, ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

import { Check } from "../../icons/generated/check";
import { X } from "../../icons/generated/x";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import type { SkeletonPart } from "../../theme/tokens/skeleton-roles";
import { isThemeDevelopment } from "../../theme/validate-theme";
import { Heading } from "../heading/heading";
import { TimelineListStatusLabel } from "./timeline-list-status-label";
import { timelineListVariants } from "./timeline-list-variants";

/** The slot classes that read no axis, resolved once at module scope. */
const {
  opposite: oppositeCell,
  rail,
  incoming,
  indicator: lane,
  outgoing,
  content,
  title,
  time,
  description,
} = timelineListVariants();

/** Props for `TimelineList.Root`, a native `ol`'s props and the list's layout axes. */
export type TimelineListRootProps = ComponentProps<"ol"> & {
  /**
   * The direction the list runs. `alternate` is a vertical list with the body and the `opposite`
   * content on either side of the rail, swapped on every other `TimelineList.Item`. It folds to one side, the
   * `opposite` content above the body, when the list is narrower than 32rem. It measures its own
   * width, so give an alternate list a definite inline size, such as a block parent's width; in a
   * parent that sizes to its content it has no width of its own. `horizontal` runs along the
   * inline axis, with each `TimelineList.Item` at least 10rem wide. A horizontal list wider than its parent
   * overflows and neither clips nor scrolls, so wrap it in `ScrollArea.Root` with
   * `orientation="horizontal"`.
   */
  layout?: "vertical" | "alternate" | "horizontal";
  /** The space between the list's `TimelineList.Item`s. */
  spacing?: "default" | "compact";
  /**
   * The size of the lane every `TimelineList.Item`'s indicator sits in: `dot` is 8.75px, `md`
   * 24px and `lg` 32px. The status marks fill the lane, and at `md` and `lg` the complete and
   * error marks carry a check and a cross. An Item without `status` keeps the 8.75px dot. In a vertical
   * or alternate list the text moves down so a first line 22px tall centers on the mark. A
   * `TimelineList.Title` has that line from level 3 down; a title at level 1 or 2 does not center
   * on the mark. In a horizontal list the text sits under the rail, its start on the mark's start.
   */
  indicatorSize?: "dot" | "md" | "lg";
};

/** Props for `TimelineList.Item`, a native `li`'s props and the event's status and indicator. */
export type TimelineListItemProps = ComponentProps<"li"> &
  (
    | {
        /**
         * The event's status, which draws its own mark. `current` sets `aria-current="step"` and
         * adds no text. An `aria-current` the Item gets, `false` included, replaces it.
         * `complete`, `upcoming` and `error` add visually hidden text before the children:
         * "Completed", "Upcoming" or "Error" in the reader's locale. That text needs a
         * `LocaleProvider` above the list.
         */
        status: "complete" | "current" | "upcoming" | "error";
        /**
         * The visually hidden text that names the status, in place of the locale text. It also
         * renders for `current`. An empty string renders no text.
         */
        statusLabel?: string;
      }
    | {
        /** Unset, the lane shows the default dot and the content gains no text. */
        status?: undefined;
        /** Not allowed without `status`. */
        statusLabel?: never;
      }
  ) & {
    /**
     * What shows in the lane. Unset, it shows the default mark for its `status`. `null`, `true`,
     * `false` and `""` show nothing, and the line runs on to the Item's text. A node replaces the mark, centered in the lane, so pair
     * it with an `indicatorSize` of `md` or `lg` on `TimelineList.Root`. The node is decorative
     * and hidden from assistive technology, so keep its meaning in the text, and render no
     * focusable control in it.
     */
    indicator?: ReactNode;
    /**
     * The content across the rail from the body, such as a `TimelineList.Time`. A vertical list
     * then gives every `TimelineList.Item` a 7rem column before the rail, and a horizontal list
     * puts the content above the rail. Below Chrome 117, which lacks row subgrid, a horizontal
     * list shows it under the rail. `true`, `false` and `""` render no cell, so a condition such as
     * `showDates && date` works. A `TimelineList.Time` among the children stays
     * inline with the body.
     */
    opposite?: ReactNode;
  };
/** The statuses an Item can show. */
type TimelineListStatus = NonNullable<TimelineListItemProps["status"]>;
type HeadingProps = ComponentPropsWithoutRef<typeof Heading>;

/** Props for `TimelineList.Title`, Heading's props except `noMargin`. */
export type TimelineListTitleProps = Omit<HeadingProps, "noMargin" | "level" | "size" | "font"> & {
  /** The type size. It replaces the size the `level` sets. */
  size?: HeadingProps["size"];
  /** The font weight. It replaces the medium weight every level sets. */
  font?: HeadingProps["font"];
  /**
   * The outline level, `1` to `6`, which picks the rendered `h1` to `h6`. The title keeps the same
   * type in every theme: 24/33 at level 1, 18/24.75 at level 2 and 16/22 from level 3 down, all at
   * 500, unless `size` or `font` replaces it.
   */
  level?: HeadingProps["level"];
};
/** Props for `TimelineList.Time`, a native `time`'s props with `date` in place of `dateTime`. */
export type TimelineListTimeProps = Omit<ComponentProps<"time">, "dateTime"> & {
  /**
   * The event's date or instant. An HTML date or date-time string passes through unchanged onto
   * the host `dateTime`, so a server and a browser in different time zones render the same value.
   * Such a string is a date, such as `2026-10-20`, or a date-time with an offset, such as
   * `2026-10-20T10:00Z` or `2026-10-20T10:00+02:00`. A date-time without an offset names a
   * different instant in each time zone, so development builds warn about one. The part normalizes
   * a `Date` with `toISOString()`, and also any other string the JavaScript date parser reads, such
   * as `June 15, 2024`, or `2024-02-30`, which the parser rolls over to March 1. An invalid value
   * throws `RangeError("TimelineList.Time received an invalid date")`.
   */
  date: string | Date;
};
/** Props for `TimelineList.Description`, a native `div`'s props. */
export type TimelineListDescriptionProps = ComponentProps<"div">;

/** The ordered list of events. */
function TimelineListRoot({
  className,
  layout = "vertical",
  spacing = "default",
  indicatorSize = "dot",
  // Safari drops the list role of a list whose items draw no marker, as these flex and grid items
  // do, unless the list states it. Destructured, so a forwarded `role={undefined}` keeps it and a
  // defined role replaces it.
  role = "list",
  ...props
}: TimelineListRootProps): ReactElement {
  const { root } = timelineListVariants({ layout, spacing, indicatorSize });
  return (
    <ol
      role={role}
      data-slot="timeline-list"
      data-layout={layout}
      data-spacing={spacing}
      data-indicator-size={indicatorSize}
      className={cn(root(), className)}
      {...props}
    />
  );
}

/** The default mark for a status: its silhouette, and the check or cross the lane size shows. */
function TimelineListMark({ status }: { readonly status: TimelineListStatus | undefined }): ReactElement {
  const { mark, glyph } = timelineListVariants({ status: status ?? "none" });
  return (
    <span
      data-slot="timeline-list-mark"
      data-skeleton-part={"timeline-list-mark" satisfies SkeletonPart}
      className={mark()}>
      {status === "complete" ? <Check className={glyph()} /> : null}
      {status === "error" ? <X className={glyph()} /> : null}
      {status === "current" ? <span className={glyph()} /> : null}
    </span>
  );
}

/** The hidden status text: `statusLabel` when given, else the locale text for a labeled status. */
function TimelineListStatusText({
  status,
  statusLabel,
}: {
  readonly status: TimelineListStatus;
  readonly statusLabel: string | undefined;
}): ReactElement | null {
  if (statusLabel !== undefined) {
    return statusLabel === "" ? null : <span className="sr-only">{`${statusLabel} `}</span>;
  }
  if (status === "current") {
    return null;
  }
  return <TimelineListStatusLabel status={status} />;
}

/**
 * Whether a node renders anything: `null`, `undefined`, `true`, `false` and the empty string render
 * nothing, so a condition such as `showDates && date` leaves no empty cell or lane. A numeric `0`
 * renders.
 */
function rendersSomething(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== true && node !== false && node !== "";
}

/** The mark an Item draws along the rail: its own node or status mark, the default dot, or none. */
function drawnMark(indicator: ReactNode, status: TimelineListStatus | undefined): "lane" | "dot" | "none" {
  if (indicator === undefined) return status === undefined ? "dot" : "lane";
  return rendersSomething(indicator) ? "lane" : "none";
}

/** One event: its `opposite` content, the rail with its indicator, and the body. */
function TimelineListItem({
  className,
  children,
  status,
  statusLabel,
  indicator,
  opposite,
  "aria-current": ariaCurrent,
  ...props
}: TimelineListItemProps): ReactElement {
  const drawn = drawnMark(indicator, status);
  const { item } = timelineListVariants({ drawn });
  return (
    <li
      data-slot="timeline-list-item"
      // A forwarded `aria-current={undefined}` keeps the automatic `"step"`, and any explicit
      // value, `false` included, replaces it.
      {...definedProps({
        "data-status": status,
        "aria-current": ariaCurrent ?? (status === "current" ? "step" : undefined),
      })}
      className={cn(item(), className)}
      {...props}>
      {rendersSomething(opposite) ? (
        <div data-slot="timeline-list-opposite" className={oppositeCell()}>
          {opposite}
        </div>
      ) : null}
      <div data-slot="timeline-list-rail" aria-hidden="true" className={rail()}>
        <span data-slot="timeline-list-connector" className={incoming()} />
        {drawn === "none" ? null : (
          <div data-slot="timeline-list-indicator" className={lane()}>
            {indicator ?? <TimelineListMark status={status} />}
          </div>
        )}
        <span data-slot="timeline-list-connector" className={outgoing()} />
      </div>
      <div data-slot="timeline-list-content" className={content()}>
        {status === undefined ? null : <TimelineListStatusText status={status} statusLabel={statusLabel} />}
        {children}
      </div>
    </li>
  );
}

/**
 * The size Heading gave each level before the theme roles: `2xl` at level 1, `lg` at level 2 and
 * the default size from level 3 down.
 */
function levelSize(level: NonNullable<HeadingProps["level"]>): NonNullable<HeadingProps["size"]> {
  switch (level) {
    case 1:
      return "2xl";
    case 2:
      return "lg";
    default:
      return "default";
  }
}

/**
 * An item's title, a level 3 Heading by default. It is not a document section heading, so it
 * keeps Heading's scale from before the theme roles at 500 in every theme instead of reading the
 * level's roles. A `size` or `font` prop still replaces either. The title passes the resolved size
 * and font after the rest props, so a forwarded `undefined` cannot erase them.
 */
function TimelineListTitle({
  className,
  level = 3,
  size,
  font,
  ...props
}: TimelineListTitleProps): ReactElement {
  return (
    <Heading
      data-slot="timeline-list-title"
      className={cn(title(), className)}
      level={level}
      {...props}
      size={size ?? levelSize(level)}
      font={font ?? "default"}
      noMargin
    />
  );
}

/**
 * An HTML valid date, such as `2026-10-20`, or date-time, such as `2026-10-20T10:00` with optional
 * seconds and fraction. The `time` group holds a date-time's time, and the `offset` group its
 * optional time-zone offset: `Z`, `+02:00` or `+0200`. The JavaScript parser also reads a
 * lowercase `z`; HTML does not.
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

/** The event's date, as a `time` element whose `dateTime` comes from `date`. */
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

/** The event's description. */
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
