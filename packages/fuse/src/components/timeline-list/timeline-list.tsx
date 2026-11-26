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

// Every part writes `data-slot` first, as its public name, and `data-timeline-list-part` after the
// consumer's props. The custom variants in `styles/timeline-list-variants.css` and the recipe's
// cross-part selectors find a part by that marker, so a consumer's `data-slot` cannot take a part
// out of its list's layout or its Item's status; see issue #1021.

/** The slot classes that read no axis, resolved once at module scope. */
const {
  item,
  opposite: oppositeCell,
  indicator: rail,
  incoming,
  lane,
  outgoing,
  glyph,
  halo,
  content,
  title,
  time,
  description,
} = timelineListVariants();

/** Props for `TimelineList.Root`, a native `ol`'s props and the list's layout axes. */
export type TimelineListRootProps = ComponentProps<"ol"> & {
  /**
   * The direction the list runs. `alternate` is a vertical list with each Item's
   * `TimelineList.Content` and `TimelineList.Opposite` on either side of the rail, swapped on
   * every other `TimelineList.Item`. It folds to one side, the Opposite above the Content, when
   * the list is narrower than 32rem. It measures its own width, so give an alternate list a
   * definite inline size, such as a block parent's width; in a parent that sizes to its content it
   * has no width of its own. `horizontal` runs along the inline axis, with each
   * `TimelineList.Item` at least 10rem wide. A horizontal list wider than its parent overflows and
   * neither clips nor scrolls, so wrap it in `ScrollArea.Root` with `orientation="horizontal"`.
   */
  layout?: "vertical" | "alternate" | "horizontal";
  /** The space between the list's `TimelineList.Item`s. */
  spacing?: "default" | "compact";
  /**
   * The size of the lane every `TimelineList.Item`'s indicator sits in: `dot` is 8.75px, `md`
   * 24px and `lg` 32px. The status marks fill the lane, and at `md` and `lg` the complete and
   * error marks carry a check and a cross. An Item without `status` keeps the 8.75px dot when its
   * `TimelineList.Indicator` shows the default `TimelineList.Mark`. A node in the Indicator shows in
   * place of the dot, and an Indicator of `null` shows no mark. In a vertical or alternate list the
   * text moves down so a first line 22px tall centers on the mark. A
   * `TimelineList.Title` has that line from level 3 down; a title at level 1 or 2 does not center
   * on the mark. In a horizontal list the text sits under the rail, its start on the mark's start.
   */
  indicatorSize?: "dot" | "md" | "lg";
};

/** Props for `TimelineList.Item`, a native `li`'s props and the event's status. */
export type TimelineListItemProps = ComponentProps<"li"> &
  (
    | {
        /**
         * The event's status, which draws the item's `TimelineList.Mark`. `current` sets
         * `aria-current="step"` and adds no text. An `aria-current` the Item gets, `false`
         * included, replaces it. `complete`, `upcoming` and `error` add visually hidden text as
         * the Item's first child: "Completed", "Upcoming" or "Error" in the reader's locale. That
         * text needs a `LocaleProvider` above the list.
         */
        status: "complete" | "current" | "upcoming" | "error";
        /**
         * The visually hidden text that names the status, in place of the locale text. It also
         * renders for `current`. An empty string renders no text.
         */
        statusLabel?: string;
      }
    | {
        /** Unset, the default mark is the 8.75px dot and the Item gains no text. */
        status?: undefined;
        /** Not allowed without `status`. */
        statusLabel?: never;
      }
  ) & {
    /**
     * The event's parts, in this order: an optional `TimelineList.Opposite`, a
     * `TimelineList.Indicator` and a `TimelineList.Content`. An Item without an Indicator draws
     * no rail.
     */
    children?: ReactNode;
  };
/** Props for `TimelineList.Opposite`, a native `div`'s props. */
export type TimelineListOppositeProps = ComponentProps<"div"> & {
  /**
   * The content across the rail from the body, such as a `TimelineList.Time`. A vertical list
   * then gives every Item a 7rem column before the rail, and a horizontal list puts the content
   * above the rail; below Chrome 117, which lacks row subgrid, under it. An Opposite with no
   * children, such as one whose condition renders `false`, takes no column or row. A
   * `TimelineList.Time` in the `TimelineList.Content` stays inline with the body.
   */
  children?: ReactNode;
};
/** Props for `TimelineList.Indicator`, a native `div`'s props. */
export type TimelineListIndicatorProps = Omit<ComponentProps<"div">, "aria-hidden"> & {
  /**
   * What shows in the lane. Unset, the default `TimelineList.Mark` for the Item's `status`.
   * `null`, or any child that renders nothing, shows no mark, and the line runs on to the Item's
   * text. A node shows in the lane, centered, such as a `TimelineList.Mark` around a glyph or an
   * `Avatar`. Size the node to the lane that `indicatorSize` on `TimelineList.Root` sets. A
   * default `Avatar` is 32px, so it needs `lg`, and it overflows a 24px `md` lane. The rail is
   * hidden from assistive technology by default, so keep the node's meaning in the Item's text,
   * and render no focusable control in it. Write the Indicator between an optional
   * `TimelineList.Opposite` and the `TimelineList.Content`: a vertical list without opposite
   * content lays the parts out in the order they are written.
   */
  children?: ReactNode;
  /**
   * Whether assistive technology skips the rail. The rail is decorative, so the Indicator hides it
   * from assistive technology by default. Pass `false` to expose the rail and its children. A
   * forwarded `undefined` keeps the rail hidden.
   */
  "aria-hidden"?: ComponentProps<"div">["aria-hidden"];
};
/** Props for `TimelineList.Mark`, a native `span`'s props. */
export type TimelineListMarkProps = ComponentProps<"span"> & {
  /**
   * The mark's glyph. Unset, the mark draws the Item's `status`: the 8.75px dot without one, and
   * at `md` and `lg` a check on `complete` and a cross on `error`. With children, the mark fills
   * the lane and holds them, in the status's colors, or on a muted fill without a `status`. The
   * mark sizes a direct `svg` child to 60% of its content box, which a ring's border makes smaller
   * than the lane.
   */
  children?: ReactNode;
};
/** Props for `TimelineList.Content`, a native `div`'s props. */
export type TimelineListContentProps = ComponentProps<"div">;
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
      className={cn(root(), className)}
      {...props}
      // The state the custom variants read comes after the consumer's props, so a forwarded data
      // attribute cannot replace it.
      data-layout={layout}
      data-spacing={spacing}
      data-indicator-size={indicatorSize}
      data-timeline-list-part="root"
    />
  );
}

/**
 * The mark in the lane. Its fill, ring, shape and glyph follow the Item's `data-status` through
 * the parts between them, so it needs no status of its own. Without children it renders the
 * three glyphs, and its status classes show the one the status draws.
 */
function TimelineListMark({ className, children, ...props }: TimelineListMarkProps): ReactElement {
  if (children !== undefined) {
    // A mark with children is a lane-sized node around them. Its `null` marker states that it has
    // no skeleton role, so `SkeletonReveal` measures what it holds.
    const { mark } = timelineListVariants({ kind: "custom" });
    return (
      <span
        data-slot="timeline-list-mark"
        className={cn(mark(), className)}
        {...props}
        data-mark="custom"
        data-timeline-list-part="mark"
        data-skeleton-part={null}>
        {children}
      </span>
    );
  }
  const { mark } = timelineListVariants({ kind: "default" });
  return (
    <span
      data-slot="timeline-list-mark"
      className={cn(mark(), className)}
      {...props}
      data-mark="default"
      data-timeline-list-part="mark"
      data-skeleton-part={"timeline-list-mark" satisfies SkeletonPart}>
      <Check data-glyph="check" className={glyph()} />
      <X data-glyph="cross" className={glyph()} />
      <span data-glyph="halo" className={halo()} />
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

/** One event: its hidden status text, then its parts. */
function TimelineListItem({
  className,
  children,
  status,
  statusLabel,
  "aria-current": ariaCurrent,
  ...props
}: TimelineListItemProps): ReactElement {
  return (
    <li
      data-slot="timeline-list-item"
      // A forwarded `aria-current={undefined}` keeps the automatic `"step"`, and any explicit
      // value, `false` included, replaces it.
      {...definedProps({ "aria-current": ariaCurrent ?? (status === "current" ? "step" : undefined) })}
      className={cn(item(), className)}
      {...props}
      // After the consumer's props, so a forwarded `data-status` cannot replace the status, and an
      // Item without `status` writes none, which React leaves off the element.
      data-status={status}
      data-timeline-list-part="item">
      {status === undefined ? null : <TimelineListStatusText status={status} statusLabel={statusLabel} />}
      {children}
    </li>
  );
}

/** The cell across the rail from the body. */
function TimelineListOpposite({ className, ...props }: TimelineListOppositeProps): ReactElement {
  return (
    <div
      data-slot="timeline-list-opposite"
      className={cn(oppositeCell(), className)}
      {...props}
      data-timeline-list-part="opposite"
    />
  );
}

/**
 * The rail: the incoming connector, the lane with the mark, and the outgoing connector. An empty
 * lane draws no mark, and the two connectors meet.
 */
function TimelineListIndicator({
  className,
  children,
  // Destructured, so a forwarded `aria-hidden={undefined}` keeps the rail hidden and a defined
  // value replaces it.
  "aria-hidden": ariaHidden = true,
  ...props
}: TimelineListIndicatorProps): ReactElement {
  return (
    <div
      data-slot="timeline-list-indicator"
      aria-hidden={ariaHidden}
      className={cn(rail(), className)}
      {...props}
      data-timeline-list-part="indicator">
      <span data-slot="timeline-list-connector" className={incoming()} data-timeline-list-part="connector" />
      <div data-slot="timeline-list-lane" className={lane()} data-timeline-list-part="lane">
        {/* Unset shows the default mark; `null` stays `null`, which leaves the lane empty. */}
        {children === undefined ? <TimelineListMark /> : children}
      </div>
      <span data-slot="timeline-list-connector" className={outgoing()} data-timeline-list-part="connector" />
    </div>
  );
}

/** The event's body, beside or across from the rail. */
function TimelineListContent({ className, ...props }: TimelineListContentProps): ReactElement {
  return (
    <div
      data-slot="timeline-list-content"
      className={cn(content(), className)}
      {...props}
      data-timeline-list-part="content"
    />
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
      data-timeline-list-part="title"
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
      data-timeline-list-part="time"
      dateTime={machineDateTime(date)}>
      {children}
    </time>
  );
}

/** The event's description. */
function TimelineListDescription({ className, ...props }: TimelineListDescriptionProps): ReactElement {
  return (
    <div
      data-slot="timeline-list-description"
      className={cn(description(), className)}
      {...props}
      data-timeline-list-part="description"
    />
  );
}

TimelineListRoot.displayName = "TimelineList.Root";
TimelineListItem.displayName = "TimelineList.Item";
TimelineListOpposite.displayName = "TimelineList.Opposite";
TimelineListIndicator.displayName = "TimelineList.Indicator";
TimelineListMark.displayName = "TimelineList.Mark";
TimelineListContent.displayName = "TimelineList.Content";
TimelineListTitle.displayName = "TimelineList.Title";
TimelineListTime.displayName = "TimelineList.Time";
TimelineListDescription.displayName = "TimelineList.Description";

export const TimelineList = {
  Root: TimelineListRoot,
  Item: TimelineListItem,
  Opposite: TimelineListOpposite,
  Indicator: TimelineListIndicator,
  Mark: TimelineListMark,
  Content: TimelineListContent,
  Title: TimelineListTitle,
  Time: TimelineListTime,
  Description: TimelineListDescription,
};
