/**
 * Specimens for the date and data components: Calendar, RangeCalendar, DateField, DatePicker,
 * DateRangePicker, Table, DataTable, DescriptionList, GridList, TimelineList and Item.
 *
 * The calendars draw March 2026, which starts on a Sunday, so its first en-US week row is the
 * 1st to the 7th. A month grid at the 24px floor is taller than the stage, so the picker
 * specimens crop at the stage's bottom edge the way a screenshot of an open popover would.
 */

import type { CSSProperties, ReactElement, ReactNode } from "react";

import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  CaretUp,
  CaretUpDown,
  Check,
  Lightning,
  Minus,
} from "@elmeragroup/fuse/icons";

import { glyph } from "../og-icons";
import {
  Button,
  Column,
  compact,
  controlText,
  focusRingShadow,
  Label,
  Row,
  shadow,
  text,
} from "../specimen-kit";
import type { IconSlot, SpecimenContext } from "../specimen-kit";
import type { Specimen } from "./specimen";

/** En-US short weekday names, Sunday first, as RAC's `weekdayStyle: "short"` prints them. */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** One day cell of the drawn month. */
type Day = { readonly day: number; readonly outside: boolean };

/** March 2026 in en-US week rows; the last row runs into April. */
const MARCH_2026: readonly (readonly Day[])[] = [0, 1, 2, 3, 4].map((week) =>
  Array.from({ length: 7 }, (_, column) => {
    const date = week * 7 + column + 1;
    return date > 31 ? { day: date - 31, outside: true } : { day: date, outside: false };
  })
);

/** A drawing that only needs the context and its children. */
type Drawing = {
  readonly ctx: SpecimenContext;
  readonly children: ReactNode;
  readonly style?: CSSProperties;
};

/**
 * A stage-tall window that clips its content at the bottom, so a popover or month grid taller
 * than the stage reads as cropped by the frame instead of shrinking under the 24px floor.
 */
function Crop({ ctx, children, top }: Drawing & { readonly top: number }): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        height: 352,
        paddingTop: ctx.px(top),
        overflow: "hidden",
      }}>
      {children}
    </div>
  );
}

/** The page surface a bare component sits on in the docs, so the stage grid does not cross it. */
function Plate({ ctx, children, style }: Drawing): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: ctx.px(8),
        backgroundColor: ctx.c("background"),
        color: ctx.c("foreground"),
        ...style,
      }}>
      {children}
    </div>
  );
}

/**
 * `CalendarHeader` (`styles/calendar.ts` `header`): `px-1 pb-4 gap-1`, ghost `icon` buttons
 * with the carets, and a centred `Heading size="lg"` (`text-lg font-medium`).
 */
function CalendarHeader({
  ctx,
  month,
}: {
  readonly ctx: SpecimenContext;
  readonly month: string;
}): ReactElement {
  return (
    <Row
      gap={ctx.px(4)}
      style={{
        paddingLeft: ctx.px(4),
        paddingRight: ctx.px(4),
        paddingBottom: ctx.px(16),
        alignSelf: "stretch",
      }}>
      <Button ctx={ctx} variant="ghost" square start={glyph(CaretLeft)} />
      <div style={{ display: "flex", flexGrow: 1, justifyContent: "center", ...text(ctx, "lg", 500) }}>
        {month}
      </div>
      <Button ctx={ctx} variant="ghost" square start={glyph(CaretRight)} />
    </Row>
  );
}

/** What a month grid drawing takes. */
type MonthGridDrawing = {
  readonly ctx: SpecimenContext;
  /** How many week rows to draw from the top of the month. */
  readonly weeks: number;
  /** Draws one 36px day square. */
  readonly cell: (day: Day, column: number) => ReactElement;
};

/**
 * The shared weekday grid (`internal/calendar-grid.tsx`): a `text-sm font-medium
 * text-muted-foreground` header row over seven 36px (`size-9`) day columns.
 */
function MonthGrid({ ctx, weeks, cell }: MonthGridDrawing): ReactElement {
  return (
    <Column gap={0}>
      <div style={{ display: "flex" }}>
        {WEEKDAYS.map((name) => (
          <div
            key={name}
            style={{
              display: "flex",
              justifyContent: "center",
              width: ctx.px(36),
              color: ctx.c("muted-foreground"),
              ...text(ctx, "sm", 500),
            }}>
            {name}
          </div>
        ))}
      </div>
      {MARCH_2026.slice(0, weeks).map((week) => (
        <div key={week[0]?.day ?? 0} style={{ display: "flex" }}>
          {week.map((day, column) => (
            <div key={`${String(day.day)}-${String(day.outside)}`} style={{ display: "flex" }}>
              {cell(day, column)}
            </div>
          ))}
        </div>
      ))}
    </Column>
  );
}

/**
 * Calendar's day cell (`cellVariants`): a `size-9 rounded-full text-sm` circle, `bg-primary
 * text-primary-foreground` when selected, muted when disabled (outside the visible month).
 */
function dayCell(ctx: SpecimenContext, selected: number): (day: Day) => ReactElement {
  return (day) => {
    const isSelected = !day.outside && day.day === selected;
    return (
      <div
        style={compact({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: ctx.px(36),
          height: ctx.px(36),
          borderRadius: 9999,
          backgroundColor: isSelected ? ctx.c("primary") : undefined,
          color: isSelected
            ? ctx.c("primary-foreground")
            : day.outside
              ? ctx.c("muted-foreground")
              : ctx.c("foreground"),
          ...text(ctx, "sm"),
        })}>
        {day.day}
      </div>
    );
  };
}

/**
 * RangeCalendar's two-layer cell (`styles/range-calendar.ts`): the `outerCell` band paints
 * `bg-primary/20` across the range, rounding at the caps and the row edges, and the inner
 * `cell` pill fills the caps with `bg-primary`.
 */
function rangeCell(
  ctx: SpecimenContext,
  start: number,
  end: number
): (day: Day, column: number) => ReactElement {
  return (day, column) => {
    const inRange = !day.outside && day.day >= start && day.day <= end;
    const isCap = inRange && (day.day === start || day.day === end);
    const roundStart = inRange && (day.day === start || column === 0);
    const roundEnd = inRange && (day.day === end || column === 6);
    return (
      <div
        style={compact({
          display: "flex",
          width: ctx.px(36),
          height: ctx.px(36),
          backgroundColor: inRange ? ctx.c("primary", 0.2) : undefined,
          borderTopLeftRadius: roundStart ? 9999 : 0,
          borderBottomLeftRadius: roundStart ? 9999 : 0,
          borderTopRightRadius: roundEnd ? 9999 : 0,
          borderBottomRightRadius: roundEnd ? 9999 : 0,
        })}>
        <div
          style={compact({
            display: "flex",
            flexGrow: 1,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 9999,
            backgroundColor: isCap ? ctx.c("primary") : undefined,
            color: isCap
              ? ctx.c("primary-foreground")
              : day.outside
                ? ctx.c("muted-foreground")
                : ctx.c("foreground"),
            ...text(ctx, "sm"),
          })}>
          {day.day}
        </div>
      </div>
    );
  };
}

/**
 * A date as DateInput's segments (`styles/date-field.ts` `segment`): each `p-0.5 rounded-xs`,
 * the literal separators without inline padding, the focused one in `bg-primary`.
 */
function Segments({
  ctx,
  parts,
  focused,
}: {
  readonly ctx: SpecimenContext;
  readonly parts: readonly string[];
  readonly focused?: number;
}): ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {parts.map((part, index) => {
        const literal = index % 2 === 1;
        const isFocused = index === focused;
        return (
          <div
            key={`${String(index)}-${part}`}
            style={compact({
              display: "flex",
              padding: literal ? `${String(ctx.px(2))}px 0` : ctx.px(2),
              borderRadius: ctx.radius("xs"),
              backgroundColor: isFocused ? ctx.c("primary") : undefined,
              color: isFocused ? ctx.c("primary-foreground") : ctx.c("foreground"),
            })}>
            {part}
          </div>
        );
      })}
    </div>
  );
}

/** A `MM/DD/YYYY` date split into segments with the literal slashes between. */
function dateParts(month: string, day: string, year: string): readonly string[] {
  return [month, "/", day, "/", year];
}

/** The field box chrome (`styles/field-box.ts`) a picker's FieldGroup paints. */
function fieldChrome(ctx: SpecimenContext): CSSProperties {
  return {
    boxSizing: "border-box",
    borderRadius: ctx.radius("md"),
    border: `${String(ctx.px(1))}px solid ${ctx.c("input")}`,
    backgroundColor: ctx.c("card"),
    boxShadow: shadow(ctx, "xs"),
    color: ctx.c("foreground"),
    ...controlText(ctx),
  };
}

/**
 * The picker's calendar trigger (`internal/picker-shell.tsx`): a ghost `icon-sm` Button with
 * CalendarBlank, rounded by `compactCornerClass` (the theme radius on internal themes).
 */
function PickerTrigger({ ctx }: { readonly ctx: SpecimenContext }): ReactElement {
  return (
    <Button
      ctx={ctx}
      variant="ghost"
      size="sm"
      square
      start={glyph(CalendarBlank)}
      style={{ borderRadius: ctx.radius("md") }}
    />
  );
}

/**
 * The RAC Popover surface (`internal/popover.tsx`): `--popover` fill, a hairline `--border`
 * border, `shadow-md`, `rounded-md`, 8px off its trigger.
 */
function PickerPopover({ ctx, children }: Drawing): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        marginTop: ctx.px(8),
        padding: ctx.px(8),
        borderRadius: ctx.radius("md"),
        border: `${String(ctx.px(1))}px solid ${ctx.c("border")}`,
        backgroundColor: ctx.c("popover"),
        color: ctx.c("popover-foreground"),
        boxShadow: shadow(ctx, "md"),
      }}>
      {children}
    </div>
  );
}

/** Calendar: the bordered card with March 2026 and one day selected, cropped below the fourth week. */
export const calendar: Specimen = {
  caption: "A selected date",
  scale: 1.75,
  draw: (ctx) => (
    <Crop ctx={ctx} top={12}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: ctx.px(8),
          borderRadius: ctx.radius("lg"),
          border: `${String(ctx.px(1))}px solid ${ctx.c("border")}`,
          backgroundColor: ctx.c("card"),
          color: ctx.c("card-foreground"),
          boxShadow: shadow(ctx, "md"),
        }}>
        <CalendarHeader ctx={ctx} month="March 2026" />
        <MonthGrid ctx={ctx} weeks={4} cell={dayCell(ctx, 12)} />
      </div>
    </Crop>
  ),
};

/** RangeCalendar: the borderless calendar with a range banded across two week rows. */
export const rangeCalendar: Specimen = {
  caption: "A selected range",
  scale: 1.75,
  draw: (ctx) => (
    <Plate ctx={ctx}>
      <CalendarHeader ctx={ctx} month="March 2026" />
      <MonthGrid ctx={ctx} weeks={3} cell={rangeCell(ctx, 10, 19)} />
    </Plate>
  ),
};

/** DateField: a label over the segmented field box, focused with the day segment active. */
export const dateField: Specimen = {
  caption: "Focused, editing the day",
  scale: 2.25,
  draw: (ctx) => (
    <Column gap={ctx.px(4)}>
      <Label ctx={ctx}>Meter reading date</Label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: ctx.px(190),
          height: ctx.metric("control-h-md"),
          paddingLeft: ctx.metric("control-px-md"),
          paddingRight: ctx.metric("control-px-md"),
          ...fieldChrome(ctx),
          boxShadow: focusRingShadow(ctx),
        }}>
        <Segments ctx={ctx} parts={dateParts("03", "12", "2026")} focused={2} />
      </div>
    </Column>
  ),
};

/** DatePicker: the labelled field with its calendar popover open below, cropped at the stage edge. */
export const datePicker: Specimen = {
  caption: "Open, with the selected date",
  scale: 1.75,
  draw: (ctx) => (
    <Crop ctx={ctx} top={10}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <Column gap={ctx.px(4)}>
          <Label ctx={ctx}>Move-in date</Label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: ctx.px(200),
              height: ctx.metric("control-h-md"),
              paddingLeft: ctx.metric("control-px-md"),
              ...fieldChrome(ctx),
            }}>
            <div style={{ display: "flex", flexGrow: 1 }}>
              <Segments ctx={ctx} parts={dateParts("03", "05", "2026")} />
            </div>
            <PickerTrigger ctx={ctx} />
          </div>
        </Column>
        <PickerPopover ctx={ctx}>
          <CalendarHeader ctx={ctx} month="March 2026" />
          <MonthGrid ctx={ctx} weeks={2} cell={dayCell(ctx, 5)} />
        </PickerPopover>
      </div>
    </Crop>
  ),
};

/**
 * DateRangePicker: the narrow field (under the 24rem container break the two dates stack beside
 * a row-spanning trigger) with its RangeCalendar popover open, cropped at the stage edge.
 */
export const dateRangePicker: Specimen = {
  caption: "Open, with a range selected",
  scale: 1.75,
  draw: (ctx) => (
    <Crop ctx={ctx} top={10}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <div style={{ display: "flex", alignItems: "center", width: ctx.px(208), ...fieldChrome(ctx) }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
              paddingLeft: ctx.metric("control-px-md"),
              paddingTop: ctx.px(4),
              paddingBottom: ctx.px(4),
            }}>
            <Segments ctx={ctx} parts={dateParts("03", "02", "2026")} />
            <Segments ctx={ctx} parts={dateParts("03", "06", "2026")} />
          </div>
          <PickerTrigger ctx={ctx} />
        </div>
        <PickerPopover ctx={ctx}>
          <CalendarHeader ctx={ctx} month="March 2026" />
          <MonthGrid ctx={ctx} weeks={2} cell={rangeCell(ctx, 2, 6)} />
        </PickerPopover>
      </div>
    </Crop>
  ),
};

/** What a table cell drawing takes. */
type CellDrawing = {
  readonly ctx: SpecimenContext;
  readonly width: number;
  readonly children?: ReactNode;
  readonly head?: boolean;
  /** The checkbox column: `has-[[role=checkbox]]:pe-0`. */
  readonly checkbox?: boolean;
  readonly style?: CSSProperties;
};

/**
 * A Table cell (`table-cell-classes.ts`, `TableHead`): `p-2 leading-none whitespace-nowrap`, and
 * for a head `h-10 px-2 font-medium text-muted-foreground`.
 */
function Cell({ ctx, width, children, head = false, checkbox = false, style }: CellDrawing): ReactElement {
  const fontSize = ctx.px(14);
  return (
    <div
      style={compact({
        display: "flex",
        alignItems: "center",
        boxSizing: "border-box",
        width: ctx.px(width),
        height: head ? ctx.px(40) : undefined,
        padding: head ? `0 ${String(ctx.px(8))}px` : ctx.px(8),
        paddingRight: checkbox ? 0 : undefined,
        fontSize,
        lineHeight: `${String(fontSize)}px`,
        fontWeight: head ? 500 : undefined,
        color: head ? ctx.c("muted-foreground") : undefined,
        whiteSpace: "nowrap",
        ...style,
      })}>
      {children}
    </div>
  );
}

/** A Table row (`TableRow`): `border-b`, `bg-muted/72` when `data-state="selected"`. */
function TableRow({
  ctx,
  children,
  selected = false,
  last = false,
  style,
}: Drawing & { readonly selected?: boolean; readonly last?: boolean }): ReactElement {
  return (
    <div
      style={compact({
        display: "flex",
        borderBottom: last ? undefined : `${String(ctx.px(1))}px solid ${ctx.c("border")}`,
        backgroundColor: selected ? ctx.c("muted", 0.72) : undefined,
        ...style,
      })}>
      {children}
    </div>
  );
}

/** Table: header, three body rows with the middle one selected, and the footer total. */
export const table: Specimen = {
  caption: "With a selected row and a footer",
  scale: 2,
  draw: (ctx) => {
    const widths = [64, 80, 92] as const;
    const rows = [
      { order: "#1042", status: "Active", amount: "NOK 1 240", selected: false },
      { order: "#1043", status: "Pending", amount: "NOK 890", selected: true },
      { order: "#1044", status: "Paid", amount: "NOK 2 110", selected: false },
    ] as const;
    return (
      <Plate ctx={ctx}>
        <TableRow ctx={ctx}>
          <Cell ctx={ctx} width={widths[0]} head>
            Order
          </Cell>
          <Cell ctx={ctx} width={widths[1]} head>
            Status
          </Cell>
          <Cell ctx={ctx} width={widths[2]} head>
            Amount
          </Cell>
        </TableRow>
        {rows.map((row, index) => (
          <TableRow key={row.order} ctx={ctx} selected={row.selected} last={index === rows.length - 1}>
            <Cell ctx={ctx} width={widths[0]}>
              {row.order}
            </Cell>
            <Cell ctx={ctx} width={widths[1]}>
              {row.status}
            </Cell>
            <Cell ctx={ctx} width={widths[2]}>
              {row.amount}
            </Cell>
          </TableRow>
        ))}
        <TableRow
          ctx={ctx}
          last
          style={{
            borderTop: `${String(ctx.px(1))}px solid ${ctx.c("border")}`,
            backgroundColor: ctx.c("muted", 0.72),
          }}>
          <Cell ctx={ctx} width={widths[0] + widths[1]} style={{ fontWeight: 500 }}>
            Total
          </Cell>
          <Cell ctx={ctx} width={widths[2]} style={{ fontWeight: 500 }}>
            NOK 4 240
          </Cell>
        </TableRow>
      </Plate>
    );
  },
};

/**
 * Checkbox (`checkbox.tsx`): a 16px `border-input` box on `--card` with `shadow-xs`, filled with
 * `--primary` and a 14px check (or minus, indeterminate) when on.
 */
function Checkbox({
  ctx,
  state,
}: {
  readonly ctx: SpecimenContext;
  readonly state: "off" | "on" | "mixed";
}): ReactElement {
  const on = state !== "off";
  const icon: IconSlot | undefined =
    state === "on" ? glyph(Check) : state === "mixed" ? glyph(Minus) : undefined;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        width: ctx.px(16),
        height: ctx.px(16),
        borderRadius: ctx.radius("md"),
        border: `${String(ctx.px(1))}px solid ${on ? ctx.c("primary") : ctx.c("input")}`,
        backgroundColor: on ? ctx.c("primary") : ctx.c("card"),
        boxShadow: shadow(ctx, "xs"),
      }}>
      {icon?.(ctx.px(14), ctx.c("primary-foreground"))}
    </div>
  );
}

/** DataTable: a select column and sortable headers over Table, sorted by customer with a row picked. */
export const dataTable: Specimen = {
  caption: "Sorted, with a row selected",
  scale: 1.85,
  draw: (ctx) => {
    const widths = [24, 132, 100] as const;
    const rows = [
      { name: "Aurora Bakeri", city: "Tromsø", selected: false },
      { name: "Fjellstue AS", city: "Lillehammer", selected: true },
      { name: "Havbris", city: "Bergen", selected: false },
      { name: "Nordlys Kafé", city: "Bodø", selected: false },
    ] as const;
    // DataTable.SortButton: a ghost `sm` Button, `-ms-2 gap-1.5`, the caret `text-muted-foreground`.
    const sortButton = (label: string, icon: IconSlot): ReactElement => (
      <Button
        ctx={ctx}
        variant="ghost"
        size="sm"
        end={(size) => icon(size, ctx.c("muted-foreground"))}
        style={{ marginLeft: ctx.px(-8), gap: ctx.px(6), color: ctx.c("foreground") }}>
        {label}
      </Button>
    );
    return (
      <Plate ctx={ctx}>
        <TableRow ctx={ctx}>
          <Cell ctx={ctx} width={widths[0]} head checkbox>
            <Checkbox ctx={ctx} state="mixed" />
          </Cell>
          <Cell ctx={ctx} width={widths[1]} head>
            {sortButton("Customer", glyph(CaretUp))}
          </Cell>
          <Cell ctx={ctx} width={widths[2]} head>
            {sortButton("City", glyph(CaretUpDown))}
          </Cell>
        </TableRow>
        {rows.map((row, index) => (
          <TableRow key={row.name} ctx={ctx} selected={row.selected} last={index === rows.length - 1}>
            <Cell ctx={ctx} width={widths[0]} checkbox>
              <Checkbox ctx={ctx} state={row.selected ? "on" : "off"} />
            </Cell>
            <Cell ctx={ctx} width={widths[1]}>
              {row.name}
            </Cell>
            <Cell ctx={ctx} width={widths[2]}>
              {row.city}
            </Cell>
          </TableRow>
        ))}
      </Plate>
    );
  },
};

/** DescriptionList: the `text-lg` heading over term/details pairs in the two-column `sm:` layout. */
export const descriptionList: Specimen = {
  caption: "Two columns, from sm up",
  scale: 1.75,
  draw: (ctx) => {
    const pairs = [
      ["Name", "Kari Nordmann"],
      ["Customer number", "10492831"],
      ["Meter point", "7070575000"],
      ["Price plan", "Spot"],
    ] as const;
    // Term `py-2 pr-2 text-muted-foreground`, Details `py-2`, both `border-t` except the first row.
    const pairStyle = (index: number): CSSProperties =>
      compact({
        display: "flex",
        paddingTop: ctx.px(8),
        paddingBottom: ctx.px(8),
        borderTop: index === 0 ? undefined : `${String(ctx.px(1))}px solid ${ctx.c("border")}`,
        ...text(ctx, "sm"),
        lineHeight: `${String(ctx.px(24))}px`,
      });
    return (
      <Plate ctx={ctx} style={{ width: ctx.px(270) }}>
        <div style={{ display: "flex", ...text(ctx, "lg", 500) }}>Customer</div>
        {pairs.map(([term, details], index) => (
          <div key={term} style={{ display: "flex" }}>
            <div
              style={{
                ...pairStyle(index),
                width: "50%",
                paddingRight: ctx.px(8),
                color: ctx.c("muted-foreground"),
              }}>
              {term}
            </div>
            <div style={{ ...pairStyle(index), flexGrow: 1, color: ctx.c("foreground") }}>{details}</div>
          </div>
        ))}
      </Plate>
    );
  },
};

/** GridList: toggle selection, each row led by its checkbox, one row selected and one disabled. */
export const gridList: Specimen = {
  caption: 'selectionMode="multiple"',
  scale: 2.75,
  draw: (ctx) => {
    const rows = [
      { label: "Main house meter", selected: true, disabled: false },
      { label: "Garage meter", selected: false, disabled: false },
      { label: "Cabin meter", selected: false, disabled: true },
    ] as const;
    const corner = ctx.radius("lg");
    return (
      <Plate ctx={ctx} style={{ width: ctx.px(170) }}>
        {rows.map((row, index) => {
          const first = index === 0;
          const last = index === rows.length - 1;
          return (
            // GridListItem (`itemStyles`): `px-1.5 py-1 gap-3 text-sm`, the outer rows rounded
            // `lg`, a selected row `border bg-muted`.
            <div
              key={row.label}
              style={compact({
                display: "flex",
                alignItems: "center",
                gap: ctx.px(12),
                padding: `${String(ctx.px(4))}px ${String(ctx.px(6))}px`,
                border: row.selected ? `${String(ctx.px(1))}px solid ${ctx.c("border")}` : undefined,
                borderTop: row.selected || first ? undefined : `${String(ctx.px(1))}px solid transparent`,
                borderTopLeftRadius: first ? corner : 0,
                borderTopRightRadius: first ? corner : 0,
                borderBottomLeftRadius: last ? corner : 0,
                borderBottomRightRadius: last ? corner : 0,
                backgroundColor: row.selected ? ctx.c("muted") : undefined,
                color: row.disabled ? ctx.c("muted-foreground") : ctx.c("foreground"),
                ...text(ctx, "sm"),
              })}>
              {/* The GridList checkbox (`internal/checkbox.ts`): `size-4.5 rounded-xs`, a `--border`
                  edge on `--card`, `--primary` when on, `--muted` when disabled. */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxSizing: "border-box",
                  width: ctx.px(18),
                  height: ctx.px(18),
                  borderRadius: ctx.radius("xs"),
                  border: `${String(ctx.px(1))}px solid ${row.selected ? ctx.c("primary") : row.disabled ? ctx.c("muted") : ctx.c("border")}`,
                  backgroundColor: row.selected
                    ? ctx.c("primary")
                    : row.disabled
                      ? ctx.c("muted")
                      : ctx.c("card"),
                }}>
                {row.selected ? glyph(Check)(ctx.px(16), ctx.c("primary-foreground")) : null}
              </div>
              {row.label}
            </div>
          );
        })}
      </Plate>
    );
  },
};

/** TimelineList: two events, each with its dot, title, time and description, joined by the connector. */
export const timelineList: Specimen = {
  caption: "Title, time and description",
  scale: 1.75,
  draw: (ctx) => {
    const events = [
      { title: "Order placed", time: "3 March 2026", description: "Confirmed at checkout." },
      { title: "Invoice issued", time: "1 April 2026", description: "NOK 2 310,00 due 15 April." },
    ] as const;
    return (
      <Plate ctx={ctx} style={{ gap: ctx.px(40) }}>
        {events.map((event, index) => (
          // TimelineList.Item (`timeline-list-variants.ts`): `pl-6 mb-10`, an 8.75px `bg-foreground`
          // dot at `top-2 left-0`, and on every item but the last a `w-px bg-border` connector
          // from `top-8` at `left-[4px]`, `h-full`.
          <div
            key={event.title}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              paddingLeft: ctx.px(24),
            }}>
            <div
              style={{
                position: "absolute",
                top: ctx.px(8),
                left: 0,
                width: ctx.px(8.75),
                height: ctx.px(8.75),
                borderRadius: 9999,
                backgroundColor: ctx.c("foreground"),
              }}
            />
            {index < events.length - 1 ? (
              <div
                style={{
                  position: "absolute",
                  top: ctx.px(32),
                  left: ctx.px(4),
                  width: ctx.px(1),
                  height: "100%",
                  backgroundColor: ctx.c("border"),
                }}
              />
            ) : null}
            <div
              style={{
                display: "flex",
                ...text(ctx, "base", 500),
                lineHeight: `${String(ctx.px(22))}px`,
                color: ctx.c("foreground"),
              }}>
              {event.title}
            </div>
            <div style={{ display: "flex", ...text(ctx, "sm"), color: ctx.c("foreground") }}>
              {event.time}
            </div>
            <div style={{ display: "flex", ...text(ctx, "base"), color: ctx.c("foreground") }}>
              {event.description}
            </div>
          </div>
        ))}
      </Plate>
    );
  },
};

/** Item: the outline variant with an icon, title, description and an action button. */
export const item: Specimen = {
  caption: 'variant="outline"',
  scale: 1.85,
  draw: (ctx) => (
    // Item (`item-variants.ts`): `rounded-md border`, size default `gap-3.5 px-4 py-3.5`.
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        width: ctx.px(250),
        gap: ctx.px(14),
        padding: `${String(ctx.px(14))}px ${String(ctx.px(16))}px`,
        borderRadius: ctx.radius("md"),
        border: `${String(ctx.px(1))}px solid ${ctx.c("border")}`,
        backgroundColor: ctx.c("background"),
        color: ctx.c("foreground"),
      }}>
      {/* Item.Media icon: a 16px glyph, nudged `translate-y-0.5` beside a description. */}
      <div style={{ display: "flex", marginTop: ctx.px(2) }}>
        {glyph(Lightning)(ctx.px(16), ctx.c("foreground"))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, flexShrink: 1, gap: ctx.px(4) }}>
        <div style={{ display: "flex", ...text(ctx, "sm", 500), lineHeight: `${String(ctx.px(17.5))}px` }}>
          Spot price
        </div>
        <div
          style={{
            display: "flex",
            ...text(ctx, "sm"),
            lineHeight: `${String(ctx.px(21))}px`,
            color: ctx.c("muted-foreground"),
          }}>
          Hourly price with no lock-in.
        </div>
      </div>
      <div style={{ display: "flex", alignSelf: "center" }}>
        <Button ctx={ctx} variant="outline" size="sm">
          Change
        </Button>
      </div>
    </div>
  ),
};
