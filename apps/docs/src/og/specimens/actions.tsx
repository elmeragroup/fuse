/**
 * Specimens for the action and navigation atoms: ButtonGroup, ConfirmButton, Toggle,
 * ToggleGroup, FileTrigger, Link, PopoverInfoButton, Focusable, Loader, Pagination and
 * Breadcrumb.
 */

import type { CSSProperties, ReactElement, ReactNode } from "react";

import { CaretLeft, CaretRight, Info, Paperclip, SpinnerGap, Star } from "@elmeragroup/fuse/icons";

import { glyph } from "../og-icons";
import { Button, compact, controlText, focusRingOutline, Popup, Row, shadow, text } from "../specimen-kit";
import type { SpecimenContext } from "../specimen-kit";
import type { Specimen } from "./specimen";

/** What a toggle drawing takes. */
type ToggleDrawing = {
  readonly ctx: SpecimenContext;
  readonly children: ReactNode;
  readonly pressed?: boolean;
  /** A leading `data-icon="inline-start"` glyph, which swaps the start inset for the icon inset. */
  readonly start?: boolean;
  readonly style?: CSSProperties;
};

/**
 * A Toggle at the default size (`toggle-variants.ts`): the md control's `min-square` label fit,
 * `rounded-md`, `font-medium`, transparent until pressed, then `bg-muted`.
 */
function ToggleFace({ ctx, children, pressed = false, start = false, style }: ToggleDrawing): ReactElement {
  const color = ctx.c("foreground");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        height: ctx.metric("control-h-md"),
        minWidth: ctx.metric("control-h-md"),
        paddingLeft: start ? ctx.metric("control-px-icon-md") : ctx.metric("control-px-md"),
        paddingRight: ctx.metric("control-px-md"),
        gap: ctx.metric("control-gap-md"),
        borderRadius: ctx.radius("md"),
        backgroundColor: pressed ? ctx.c("muted") : "transparent",
        color,
        whiteSpace: "nowrap",
        ...controlText(ctx, 500),
        ...style,
      }}>
      {start ? glyph(Star)(ctx.px(16), color) : null}
      {children}
    </div>
  );
}

/**
 * ButtonGroup (`button-group-variants.ts`): three outline Buttons joined horizontally, the inner
 * corners squared and every border after the first dropping its left edge.
 */
export const buttonGroup: Specimen = {
  caption: 'Horizontal, variant="outline"',
  scale: 2.5,
  draw: (ctx) => {
    const labels = ["Download", "Print", "Share"] as const;
    const round = ctx.radius("button");
    return (
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {labels.map((label, index) => (
          <Button
            key={label}
            ctx={ctx}
            variant="outline"
            style={compact({
              borderTopLeftRadius: index === 0 ? round : 0,
              borderBottomLeftRadius: index === 0 ? round : 0,
              borderTopRightRadius: index === labels.length - 1 ? round : 0,
              borderBottomRightRadius: index === labels.length - 1 ? round : 0,
              borderLeftWidth: index === 0 ? undefined : 0,
            })}>
            {label}
          </Button>
        ))}
      </div>
    );
  },
};

/**
 * ConfirmButton (`confirm-button-variants.ts`): the destructive Button after its first press,
 * armed with `bg-error text-error-foreground` and the `armedChildren` label swapped in.
 */
export const confirmButton: Specimen = {
  caption: 'Armed, variant="destructive"',
  scale: 2.5,
  draw: (ctx) => (
    <Button
      ctx={ctx}
      variant="destructive"
      style={{ backgroundColor: ctx.c("error"), color: ctx.c("error-foreground") }}>
      Confirm delete
    </Button>
  ),
};

/** Toggle (`toggle-variants.ts`): the default variant pressed, with a leading Star. */
export const toggle: Specimen = {
  caption: "Pressed, with a leading icon",
  scale: 3,
  draw: (ctx) => (
    <ToggleFace ctx={ctx} pressed start>
      Favorite
    </ToggleFace>
  ),
};

/**
 * ToggleGroup (`toggle-group.tsx`): the outline segmented mode (`spacing={0}`), items joined
 * with squared inner corners, the shared left border dropped, the segmented icon inset
 * (`toggle-group-variants.ts`), `shadow-xs` on the group, and one item pressed with `bg-muted`.
 */
export const toggleGroup: Specimen = {
  caption: 'variant="outline" spacing={0}',
  scale: 2.5,
  draw: (ctx) => {
    const items = ["Day", "Week", "Month"] as const;
    const round = ctx.radius("md");
    return (
      <div style={{ display: "flex", borderRadius: round, boxShadow: shadow(ctx, "xs") }}>
        {items.map((item, index) => (
          <ToggleFace
            key={item}
            ctx={ctx}
            pressed={item === "Week"}
            style={compact({
              paddingLeft: ctx.metric("control-px-icon-md"),
              paddingRight: ctx.metric("control-px-icon-md"),
              border: `${String(ctx.px(1))}px solid ${ctx.c("input")}`,
              borderTopLeftRadius: index === 0 ? round : 0,
              borderBottomLeftRadius: index === 0 ? round : 0,
              borderTopRightRadius: index === items.length - 1 ? round : 0,
              borderBottomRightRadius: index === items.length - 1 ? round : 0,
              borderLeftWidth: index === 0 ? undefined : 0,
            })}>
            {item}
          </ToggleFace>
        ))}
      </div>
    );
  },
};

/**
 * FileTrigger (`react-aria/file-trigger/file-trigger.tsx`): its default `sm` primary Button with
 * the Paperclip glyph and the `gap-x-2` it adds while the icon is on.
 */
export const fileTrigger: Specimen = {
  caption: 'size="sm", with the default icon',
  scale: 2.5,
  draw: (ctx) => (
    <Button ctx={ctx} size="sm" start={glyph(Paperclip)} style={{ gap: ctx.px(8) }}>
      Attach invoice
    </Button>
  ),
};

/**
 * Link (`styles/link.ts`): the `primary` colour and `bold` (`font-medium`) weight after muted
 * body text, keyboard-focused with the shared state ring (`ring-2 ring-ring ring-offset-2`);
 * the recipe draws no underline.
 */
export const link: Specimen = {
  caption: 'variant="primary", focus-visible',
  scale: 2,
  draw: (ctx) => (
    <Row gap={ctx.px(5)} style={{ ...text(ctx, "base") }}>
      <span style={{ color: ctx.c("muted-foreground") }}>Need help?</span>
      <div
        style={{
          display: "flex",
          color: ctx.c("primary"),
          fontWeight: 500,
          ...focusRingOutline(ctx),
        }}>
        Contact support
      </div>
    </Row>
  ),
};

/**
 * PopoverInfoButton (`popover-info-button.tsx`): the ghost `icon-sm` Info button with its Popover
 * open to the right, 8px off, with the arrow, `text-sm p-4`.
 */
export const popoverInfoButton: Specimen = {
  caption: "Open, popover to the right",
  scale: 2,
  draw: (ctx) => {
    const arrow = ctx.px(6 * Math.SQRT2);
    return (
      <Row gap={ctx.px(8 + 6)}>
        <Button
          ctx={ctx}
          variant="ghost"
          size="sm"
          square
          start={glyph(Info)}
          style={{ backgroundColor: ctx.c("muted") }}
        />
        <div style={{ display: "flex", position: "relative" }}>
          <Popup ctx={ctx} width={ctx.px(200)} padding={ctx.px(16)} style={{ ...text(ctx, "sm") }}>
            Estimated from your meter readings over the last 12 months.
          </Popup>
          <div
            style={{
              display: "flex",
              position: "absolute",
              left: ctx.px(-6),
              top: "50%",
              marginTop: ctx.px(-6),
              width: ctx.px(6),
              height: ctx.px(12),
              overflow: "hidden",
            }}>
            <div
              style={{
                position: "absolute",
                left: ctx.px(6) - arrow / 2,
                top: ctx.px(6) - arrow / 2,
                width: arrow,
                height: arrow,
                boxSizing: "border-box",
                transform: "rotate(45deg)",
                border: `${String(ctx.px(1))}px solid ${ctx.c("border")}`,
                backgroundColor: ctx.c("popover"),
              }}
            />
          </div>
        </div>
      </Row>
    );
  },
};

/**
 * Focusable (`react-aria/focusable/focusable.tsx`, as in its docs demo): a muted, dotted-underline
 * span given a tab stop, focused with the shared ring, and its Tooltip open above it
 * (`tooltip.tsx`: `bg-foreground text-background text-xs px-3 py-1.5 rounded-md`, a rotated arrow).
 */
export const focusable: Specimen = {
  caption: "Focused, with its tooltip open",
  scale: 2,
  draw: (ctx) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          position: "relative",
          maxWidth: ctx.px(220),
          padding: `${String(ctx.px(6))}px ${String(ctx.px(12))}px`,
          borderRadius: ctx.radius("md"),
          backgroundColor: ctx.c("foreground"),
          color: ctx.c("background"),
          textAlign: "center",
          ...text(ctx, "xs"),
        }}>
        This action is unavailable because the meter is already closed.
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: ctx.px(-4),
            width: ctx.px(10),
            height: ctx.px(10),
            marginLeft: ctx.px(-5),
            borderRadius: ctx.px(2),
            transform: "rotate(45deg)",
            backgroundColor: ctx.c("foreground"),
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          ...focusRingOutline(ctx),
          marginTop: ctx.px(4 + 8 - 4),
        }}>
        <span
          style={{
            color: ctx.c("muted-foreground"),
            textDecorationLine: "underline",
            textDecorationStyle: "dotted",
            textDecorationColor: ctx.c("muted-foreground"),
            ...text(ctx, "sm"),
          }}>
          Closed meter
        </span>
      </div>
    </div>
  ),
};

/**
 * Loader (`loader-variants.ts`): the `p-4` status wrapper around the SpinnerGap glyph at the
 * default `size-4`, in `text-foreground`. Drawn at 7x, since it carries no text and the `p-4` wrapper must fit the stage.
 */
export const loader: Specimen = {
  caption: 'size="default"',
  scale: 7,
  draw: (ctx) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: ctx.px(16) }}>
      {glyph(SpinnerGap)(ctx.px(16), ctx.c("foreground"))}
    </div>
  ),
};

/** What a pagination link drawing takes. */
type PageDrawing = {
  readonly ctx: SpecimenContext;
  readonly page: string;
  readonly active?: boolean;
};

/** A page link (`pagination.tsx`): Button's `icon` square, `outline` when current, else `ghost`. */
function PageLink({ ctx, page, active = false }: PageDrawing): ReactElement {
  return (
    <Button ctx={ctx} variant={active ? "outline" : "ghost"} square>
      {page}
    </Button>
  );
}

/**
 * Pagination (`pagination-variants.ts`): ghost Previous and Next at the default size with `gap-1`
 * and the `pl-2.5`/`pr-2.5` caret side, `icon`-square page links with the current page outline,
 * all in a `gap-1` row.
 */
export const pagination: Specimen = {
  caption: "Page 2 of 3 current",
  scale: 1.72,
  draw: (ctx) => (
    <Row gap={ctx.px(4)}>
      <Button
        ctx={ctx}
        variant="ghost"
        start={glyph(CaretLeft)}
        style={{ gap: ctx.px(4), paddingLeft: ctx.px(10) }}>
        Previous
      </Button>
      <PageLink ctx={ctx} page="1" />
      <PageLink ctx={ctx} page="2" active />
      <PageLink ctx={ctx} page="3" />
      <Button
        ctx={ctx}
        variant="ghost"
        end={glyph(CaretRight)}
        style={{ gap: ctx.px(4), paddingRight: ctx.px(10) }}>
        Next
      </Button>
    </Row>
  ),
};

/**
 * Breadcrumb (`breadcrumb.tsx`): a `text-sm` muted trail with `gap-2.5`, 14px CaretRight
 * separators and the current page in `text-foreground`.
 */
export const breadcrumb: Specimen = {
  caption: "Three levels, current page last",
  scale: 1.8,
  draw: (ctx) => {
    const muted = ctx.c("muted-foreground");
    return (
      <Row gap={ctx.px(10)} style={{ ...text(ctx, "sm"), color: muted, whiteSpace: "nowrap" }}>
        <span>Home</span>
        {glyph(CaretRight)(ctx.px(14), muted)}
        <span>Invoices</span>
        {glyph(CaretRight)(ctx.px(14), muted)}
        <span style={{ color: ctx.c("foreground") }}>Invoice 1042</span>
      </Row>
    );
  },
};
