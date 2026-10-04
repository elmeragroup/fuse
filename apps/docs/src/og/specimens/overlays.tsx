/**
 * Specimens for the overlays and disclosure parts: Dialog, AlertDialog, Sheet, Popover,
 * Tooltip, DropdownMenu, NavigationMenu, Toast, Alert, Accordion, Collapsible and Tabs.
 */

import type { CSSProperties, ReactElement, ReactNode } from "react";

import {
  CaretDown,
  CheckCircle,
  Copy,
  Download,
  Info,
  Pencil,
  Trash,
  WarningOctagon,
  X,
} from "@elmeragroup/fuse/icons";

import { glyph } from "../og-icons";
import type { IconSlot } from "../og-icons";
import { compact } from "../satori-style";
import { Button, Column, controlText, hairline, Popup, Row, shadow, text } from "../specimen-kit";
import type { SpecimenContext } from "../specimen-kit";
import type { Specimen } from "./specimen";

/** `overlayScrimClass`: `bg-black/10`, a raw palette literal in the recipe too. */
const SCRIM = "rgba(0, 0, 0, 0.1)";

type CtxProps = { readonly ctx: SpecimenContext };

/** The shared dismiss control (`OverlayCloseButton`): a ghost `icon-sm` Button holding `X`. */
function CloseButton({ ctx, color }: CtxProps & { readonly color: string }): ReactElement {
  const size = ctx.metric("control-h-sm");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: ctx.radius("button"),
      }}>
      {glyph(X)(ctx.px(16), color)}
    </div>
  );
}

/** A bar of placeholder page content. */
function Bar({
  ctx,
  width,
  tone = "muted",
}: CtxProps & { readonly width: number; readonly tone?: "muted" | "border" }): ReactElement {
  return (
    <div
      style={{ width: ctx.px(width), height: ctx.px(6), borderRadius: 9999, backgroundColor: ctx.c(tone) }}
    />
  );
}

/**
 * A miniature page under the overlay scrim, so a modal reads as covering something. The
 * overlay draws over the scrim through `children`, absolutely placed by the caller.
 */
function MiniPage({
  ctx,
  width,
  height,
  children,
}: CtxProps & {
  readonly width: number;
  readonly height: number;
  readonly children: ReactNode;
}): ReactElement {
  const rule = hairline(ctx, ctx.c("border"));
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: ctx.px(width),
        height: ctx.px(height),
        overflow: "hidden",
        borderRadius: ctx.radius("lg"),
        border: rule,
        backgroundColor: ctx.c("background"),
      }}>
      <Row
        gap={ctx.px(8)}
        style={{
          height: ctx.px(24),
          paddingLeft: ctx.px(10),
          paddingRight: ctx.px(10),
          borderBottom: rule,
        }}>
        <div
          style={{
            width: ctx.px(10),
            height: ctx.px(10),
            borderRadius: ctx.px(2),
            backgroundColor: ctx.c("foreground"),
          }}
        />
        <Bar ctx={ctx} width={28} />
        <Bar ctx={ctx} width={22} />
        <Bar ctx={ctx} width={26} />
      </Row>
      <Column gap={ctx.px(10)} style={{ padding: ctx.px(12) }}>
        <Bar ctx={ctx} width={96} />
        <Row gap={ctx.px(8)}>
          {[0, 1, 2].map((key) => (
            <Column
              key={key}
              gap={ctx.px(6)}
              style={{
                flexGrow: 1,
                padding: ctx.px(8),
                height: ctx.px(48),
                borderRadius: ctx.radius("lg"),
                border: rule,
              }}>
              <Bar ctx={ctx} width={34} />
              <Bar ctx={ctx} width={52} tone="border" />
            </Column>
          ))}
        </Row>
        {[180, 150, 200, 120, 170].map((barWidth) => (
          <Bar key={barWidth} ctx={ctx} width={barWidth} tone="border" />
        ))}
      </Column>
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: SCRIM }} />
      {children}
    </div>
  );
}

/** `overlayTitleClass`: `text-base font-medium leading-none`. */
function OverlayTitle({ ctx, children }: CtxProps & { readonly children: ReactNode }): ReactElement {
  return (
    <span
      style={{
        ...text(ctx, "base", 500),
        lineHeight: `${String(ctx.px(16))}px`,
        color: ctx.c("popover-foreground"),
      }}>
      {children}
    </span>
  );
}

/** `Dialog.Description`: `text-sm text-muted-foreground`. */
function Muted({
  ctx,
  children,
  size = "sm",
}: CtxProps & { readonly children: ReactNode; readonly size?: "sm" | "base" }): ReactElement {
  return <span style={{ ...text(ctx, size), color: ctx.c("muted-foreground") }}>{children}</span>;
}

/**
 * The Dialog popup (`dialog.tsx`): the shared popover surface raised to `rounded-xl` and
 * `shadow-lg`, `p-6`, `gap-6` between header, body and footer.
 */
function DialogSurface({
  ctx,
  width,
  children,
}: CtxProps & { readonly width: number; readonly children: ReactNode }): ReactElement {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        width: ctx.px(width),
        padding: ctx.px(24),
        gap: ctx.px(24),
        borderRadius: ctx.radius("xl"),
        backgroundColor: ctx.c("popover"),
        color: ctx.c("popover-foreground"),
        boxShadow: `0 0 0 ${String(ctx.px(1))}px ${ctx.c("foreground", 0.1)}, ${shadow(ctx, "lg")}`,
        ...text(ctx, "sm"),
      }}>
      {children}
    </div>
  );
}

/** Dialog: open over a page behind the scrim, with header, footer actions and the corner close. */
export const dialog: Specimen = {
  caption: "Open, over the page scrim",
  scale: 1.72,
  draw: (ctx) => (
    <MiniPage ctx={ctx} width={272} height={186}>
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
        <DialogSurface ctx={ctx} width={232}>
          <Column gap={ctx.px(8)}>
            <OverlayTitle ctx={ctx}>Edit address</OverlayTitle>
            <Muted ctx={ctx}>Used on your next invoice.</Muted>
          </Column>
          <Row gap={ctx.px(8)} style={{ justifyContent: "flex-end" }}>
            <Button ctx={ctx} variant="outline">
              Cancel
            </Button>
            <Button ctx={ctx}>Save</Button>
          </Row>
          <div style={{ position: "absolute", top: ctx.px(16), right: ctx.px(16), display: "flex" }}>
            <CloseButton ctx={ctx} color={ctx.c("foreground")} />
          </div>
        </DialogSurface>
      </div>
    </MiniPage>
  ),
};

/**
 * AlertDialog (`alert-dialog.tsx`): the Dialog surface without a corner close, the title beside
 * the destructive `WarningOctagon` (`size-5 text-error`), and `sm` ghost and destructive actions.
 */
export const alertDialog: Specimen = {
  caption: 'variant="destructive"',
  scale: 1.72,
  draw: (ctx) => (
    <DialogSurface ctx={ctx} width={264}>
      <Column gap={ctx.px(8)}>
        <Row gap={ctx.px(16)} style={{ alignItems: "flex-start", justifyContent: "space-between" }}>
          <OverlayTitle ctx={ctx}>Delete saved address?</OverlayTitle>
          {glyph(WarningOctagon)(ctx.px(20), ctx.c("error"))}
        </Row>
        <Muted ctx={ctx}>Invoices already sent keep the address they were sent to.</Muted>
      </Column>
      <Row gap={ctx.px(8)} style={{ justifyContent: "flex-end" }}>
        <Button ctx={ctx} variant="ghost" size="sm">
          Cancel
        </Button>
        <Button ctx={ctx} variant="destructive" size="sm">
          Delete
        </Button>
      </Row>
    </DialogSurface>
  ),
};

/**
 * Sheet (`sheet.tsx`): slid in from the right edge over the scrim, `bg-popover`, `border-l`,
 * `shadow-lg`; header `px-4 pt-4 gap-1.5` with the `text-xl` title, footer `p-4`.
 */
export const sheet: Specimen = {
  caption: 'side="right", open',
  scale: 1.72,
  draw: (ctx) => (
    <MiniPage ctx={ctx} width={272} height={186}>
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          width: ctx.px(184),
          gap: ctx.px(16),
          borderLeft: hairline(ctx, ctx.c("border")),
          backgroundColor: ctx.c("popover"),
          color: ctx.c("popover-foreground"),
          boxShadow: shadow(ctx, "lg"),
        }}>
        <Column
          gap={ctx.px(6)}
          style={{ paddingLeft: ctx.px(16), paddingRight: ctx.px(16), paddingTop: ctx.px(16) }}>
          <span style={{ ...text(ctx, "xl", 500), color: ctx.c("foreground") }}>Filters</span>
          <Muted ctx={ctx} size="base">
            Narrow the invoices.
          </Muted>
        </Column>
        <Column gap={ctx.px(8)} style={{ marginTop: "auto", padding: ctx.px(16) }}>
          <Button ctx={ctx}>Show 12 invoices</Button>
        </Column>
        <div style={{ position: "absolute", top: ctx.px(16), right: ctx.px(16), display: "flex" }}>
          <CloseButton ctx={ctx} color={ctx.c("foreground")} />
        </div>
      </div>
    </MiniPage>
  ),
};

/**
 * Popover (`popover.tsx`): the timed popup surface, `p-4 gap-4 text-sm`, below its trigger at
 * `sideOffset` 4 and centred on it; the header pairs a `font-medium` title with muted copy.
 */
export const popover: Specimen = {
  caption: "Open below its trigger",
  scale: 1.8,
  draw: (ctx) => (
    <Column gap={ctx.px(4)} style={{ alignItems: "center" }}>
      <Button ctx={ctx} variant="outline" end={glyph(CaretDown)}>
        Meter point
      </Button>
      <Popup
        ctx={ctx}
        width={ctx.px(240)}
        padding={ctx.px(16)}
        style={{ gap: ctx.px(16), ...text(ctx, "sm") }}>
        <Column gap={ctx.px(4)}>
          <span style={{ fontWeight: 500 }}>Reading due 12 May</span>
          <Muted ctx={ctx}>Submit it in the app.</Muted>
        </Column>
        <Row gap={ctx.px(8)}>
          <Button ctx={ctx} size="sm">
            Submit reading
          </Button>
        </Row>
      </Popup>
    </Column>
  ),
};

/**
 * Tooltip (`tooltip.tsx`): the inverted, frameless face, `bg-foreground text-background
 * text-xs px-3 py-1.5 rounded-md`, on its default `top` side with the rotated arrow.
 */
export const tooltip: Specimen = {
  caption: 'side="top", open',
  scale: 3,
  draw: (ctx) => (
    <Column gap={ctx.px(4)} style={{ alignItems: "center" }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            paddingLeft: ctx.px(12),
            paddingRight: ctx.px(12),
            paddingTop: ctx.px(6),
            paddingBottom: ctx.px(6),
            borderRadius: ctx.radius("md"),
            backgroundColor: ctx.c("foreground"),
            color: ctx.c("background"),
            whiteSpace: "nowrap",
            ...text(ctx, "xs"),
          }}>
          Download invoice
        </div>
        <div
          style={{
            position: "absolute",
            bottom: ctx.px(-3),
            width: ctx.px(10),
            height: ctx.px(10),
            borderRadius: ctx.px(2),
            backgroundColor: ctx.c("foreground"),
            transform: "rotate(45deg)",
          }}
        />
      </div>
      <Button ctx={ctx} variant="outline" square start={glyph(Download)} />
    </Column>
  ),
};

/** A DropdownMenu item (`dropdown-menu-variants.ts`): `menuItemClass` with `px-2`, `focus:bg-accent`. */
function DropdownItem({
  ctx,
  icon,
  shortcut,
  highlighted = false,
  destructive = false,
  children,
}: CtxProps & {
  readonly icon: IconSlot;
  readonly shortcut?: string;
  readonly highlighted?: boolean;
  readonly destructive?: boolean;
  readonly children: ReactNode;
}): ReactElement {
  const color = destructive
    ? ctx.c("error")
    : highlighted
      ? ctx.c("accent-foreground")
      : ctx.c("popover-foreground");
  return (
    <Row
      gap={ctx.px(8)}
      style={{
        paddingTop: ctx.px(6),
        paddingBottom: ctx.px(6),
        paddingLeft: ctx.px(8),
        paddingRight: ctx.px(8),
        borderRadius: ctx.radius("sm"),
        backgroundColor: highlighted ? ctx.c("accent") : "transparent",
        color,
        ...text(ctx, "sm"),
      }}>
      {icon(ctx.px(16), color)}
      <div style={{ display: "flex", flexGrow: 1 }}>{children}</div>
      {shortcut === undefined ? null : (
        <span
          style={{
            ...text(ctx, "xs"),
            letterSpacing: ctx.px(1.2),
            color: highlighted ? ctx.c("accent-foreground") : ctx.c("muted-foreground"),
          }}>
          {shortcut}
        </span>
      )}
    </Row>
  );
}

/**
 * DropdownMenu: the trigger and the open timed popup (`p-1`, `rounded-md`), one item
 * highlighted with a shortcut, a `menuSeparatorClass` rule and a destructive item.
 */
export const dropdownMenu: Specimen = {
  caption: "Open, with a highlighted item",
  scale: 2,
  draw: (ctx) => (
    <Column gap={ctx.px(4)} style={{ alignItems: "flex-start" }}>
      <Button ctx={ctx} variant="outline" end={glyph(CaretDown)}>
        Actions
      </Button>
      <Popup ctx={ctx} width={ctx.px(200)}>
        <DropdownItem ctx={ctx} icon={glyph(Pencil)} shortcut="Ctrl E" highlighted>
          Edit
        </DropdownItem>
        <DropdownItem ctx={ctx} icon={glyph(Copy)} shortcut="Ctrl D">
          Duplicate
        </DropdownItem>
        <div
          style={{
            marginTop: ctx.px(4),
            marginBottom: ctx.px(4),
            marginLeft: ctx.px(-4),
            marginRight: ctx.px(-4),
            height: ctx.px(1),
            backgroundColor: ctx.c("border"),
          }}
        />
        <DropdownItem ctx={ctx} icon={glyph(Trash)} destructive>
          Delete
        </DropdownItem>
      </Popup>
    </Column>
  ),
};

/** A horizontal NavigationMenu trigger or bar link: the md control box, `font-medium rounded-md`. */
function NavBarItem({
  ctx,
  open = false,
  caret = false,
  children,
}: CtxProps & {
  readonly open?: boolean;
  readonly caret?: boolean;
  readonly children: ReactNode;
}): ReactElement {
  const iconSize = ctx.px(16);
  return (
    <Row
      gap={ctx.metric("control-gap-md")}
      style={{
        height: ctx.metric("control-h-md"),
        paddingLeft: ctx.metric("control-px-md"),
        paddingRight: ctx.metric("control-px-md"),
        borderRadius: ctx.radius("md"),
        backgroundColor: open ? ctx.c("muted") : "transparent",
        color: ctx.c("foreground"),
        ...controlText(ctx, 500),
      }}>
      {children}
      {caret ? (
        <div style={compact({ display: "flex", transform: open ? "rotate(180deg)" : undefined })}>
          {glyph(CaretDown)(iconSize, ctx.c("muted-foreground"))}
        </div>
      ) : null}
    </Row>
  );
}

/** A NavigationMenu row link in a content panel: `text-sm px-2 py-1.5 rounded-sm`, `hover:bg-accent`. */
function NavRowLink({
  ctx,
  highlighted = false,
  children,
}: CtxProps & { readonly highlighted?: boolean; readonly children: ReactNode }): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        minHeight: ctx.metric("control-h-xs"),
        paddingLeft: ctx.px(8),
        paddingRight: ctx.px(8),
        paddingTop: ctx.px(6),
        paddingBottom: ctx.px(6),
        borderRadius: ctx.radius("sm"),
        backgroundColor: highlighted ? ctx.c("accent") : "transparent",
        color: highlighted ? ctx.c("accent-foreground") : ctx.c("popover-foreground"),
        ...text(ctx, "sm"),
      }}>
      {children}
    </div>
  );
}

/**
 * NavigationMenu (`navigation-menu-variants.ts`): a bar of md triggers with the open one on
 * `bg-muted` and its caret turned, the `bg-border` indicator arrow, and the panel (`p-2`) of row links.
 */
export const navigationMenu: Specimen = {
  caption: "One trigger open",
  scale: 1.72,
  draw: (ctx) => (
    <Column gap={ctx.px(6)} style={{ alignItems: "flex-start" }}>
      <Row gap={ctx.px(4)}>
        <div style={{ position: "relative", display: "flex" }}>
          <NavBarItem ctx={ctx} caret open>
            Private
          </NavBarItem>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: ctx.px(-6),
              height: ctx.px(6),
              display: "flex",
              justifyContent: "center",
              overflow: "hidden",
            }}>
            <div
              style={{
                marginTop: ctx.px(3.6),
                width: ctx.px(8),
                height: ctx.px(8),
                borderTopLeftRadius: ctx.radius("sm"),
                backgroundColor: ctx.c("border"),
                transform: "rotate(45deg)",
              }}
            />
          </div>
        </div>
        <NavBarItem ctx={ctx} caret>
          Business
        </NavBarItem>
        <NavBarItem ctx={ctx}>Help</NavBarItem>
      </Row>
      <Popup ctx={ctx} width={ctx.px(176)} padding={ctx.px(8)} style={{ gap: ctx.px(4) }}>
        <NavRowLink ctx={ctx}>Electricity</NavRowLink>
        <NavRowLink ctx={ctx} highlighted>
          Solar panels
        </NavRowLink>
        <NavRowLink ctx={ctx}>Home charging</NavRowLink>
      </Popup>
    </Column>
  ),
};

/** The success toast face (`toast-variants.ts`): `bg-success-soft`, a `ring-success/20` hairline, `rounded-lg shadow-lg`. */
function ToastFace({
  ctx,
  style,
  children,
}: CtxProps & { readonly style: CSSProperties; readonly children?: ReactNode }): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        boxSizing: "border-box",
        width: ctx.px(256),
        borderRadius: ctx.radius("lg"),
        backgroundColor: ctx.c("success-soft"),
        boxShadow: `0 0 0 ${String(ctx.px(1))}px ${ctx.c("success", 0.2)}, ${shadow(ctx, "lg")}`,
        ...style,
      }}>
      {children}
    </div>
  );
}

/**
 * Toast (`toast-variants.ts`): the success status, `p-4` with the `CheckCircle` glyph
 * (`mt-0.5 size-4 text-success`) and the corner close; the next toast peeks behind at
 * `scale(0.9)`, `--peek` 0.75rem up.
 */
export const toast: Specimen = {
  caption: 'type="success", stacked',
  scale: 1.8,
  draw: (ctx) => (
    <div style={{ position: "relative", display: "flex", paddingTop: ctx.px(12) }}>
      <ToastFace
        ctx={ctx}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: ctx.px(80),
          transform: "scale(0.9)",
          transformOrigin: "50% 0%",
        }}
      />
      <ToastFace
        ctx={ctx}
        style={{
          position: "relative",
          padding: ctx.px(16),
          color: ctx.c("success-soft-foreground"),
          ...text(ctx, "sm"),
        }}>
        <Row gap={ctx.px(8)} style={{ alignItems: "flex-start", paddingRight: ctx.px(32) }}>
          <div style={{ display: "flex", marginTop: ctx.px(2) }}>
            {glyph(CheckCircle)(ctx.px(16), ctx.c("success"))}
          </div>
          <Column gap={ctx.px(4)}>
            <span style={{ fontWeight: 500 }}>Reading submitted</span>
            <span>It is used on your next invoice.</span>
          </Column>
        </Row>
        <div style={{ position: "absolute", top: ctx.px(8), right: ctx.px(8), display: "flex" }}>
          <CloseButton ctx={ctx} color={ctx.c("muted-foreground")} />
        </div>
      </ToastFace>
    </div>
  ),
};

/**
 * Alert (`alert-variants.ts` over Item `outline`/`sm`): `rounded-md border px-3 py-2.5 gap-2.5`
 * on `bg-background`, the `Info` glyph at `size-5`, a `font-medium` title and foreground copy.
 */
export const alert: Specimen = {
  caption: 'variant="default"',
  scale: 1.8,
  draw: (ctx) => (
    <Row
      gap={ctx.px(10)}
      style={{
        alignItems: "flex-start",
        boxSizing: "border-box",
        width: ctx.px(256),
        paddingLeft: ctx.px(12),
        paddingRight: ctx.px(12),
        paddingTop: ctx.px(10),
        paddingBottom: ctx.px(10),
        borderRadius: ctx.radius("md"),
        border: hairline(ctx, ctx.c("border")),
        backgroundColor: ctx.c("background"),
        color: ctx.c("foreground"),
        ...text(ctx, "sm"),
      }}>
      <div style={{ display: "flex", marginTop: ctx.px(2) }}>
        {glyph(Info)(ctx.px(20), ctx.c("foreground"))}
      </div>
      <Column gap={ctx.px(4)} style={{ flexGrow: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 500, lineHeight: `${String(ctx.px(14 * 1.375))}px` }}>
          Planned maintenance
        </span>
        <span style={{ lineHeight: `${String(ctx.px(14 * 1.5))}px` }}>
          Meter readings are paused from 22:00 to 02:00 on Sunday.
        </span>
      </Column>
    </Row>
  ),
};

/** An Accordion item in the default variant (`accordion-variants.ts`): `p-4 rounded-sm bg-muted`. */
function AccordionItem({
  ctx,
  title,
  children,
}: CtxProps & { readonly title: string; readonly children?: string }): ReactElement {
  const open = children !== undefined;
  return (
    <Column
      gap={0}
      style={{ padding: ctx.px(16), borderRadius: ctx.radius("sm"), backgroundColor: ctx.c("muted") }}>
      <Row
        gap={ctx.px(8)}
        style={{ justifyContent: "space-between", paddingBottom: open ? ctx.px(16) : 0, fontWeight: 500 }}>
        <span>{title}</span>
        <div style={compact({ display: "flex", transform: open ? "rotate(180deg)" : undefined })}>
          {glyph(CaretDown)(ctx.px(16), ctx.c("foreground"))}
        </div>
      </Row>
      {open ? <span style={{ paddingTop: ctx.px(6) }}>{children}</span> : null}
    </Column>
  );
}

/**
 * Accordion: the default variant with its middle item open, the trigger's `pb-4` and turned
 * `CaretDown`, the panel's `pt-1.5` copy, and closed items either side.
 */
export const accordion: Specimen = {
  caption: "One item open",
  scale: 1.72,
  draw: (ctx) => (
    <Column gap={0} style={{ width: ctx.px(260), color: ctx.c("foreground"), ...text(ctx, "sm") }}>
      <AccordionItem ctx={ctx} title="How is my price set?" />
      <AccordionItem ctx={ctx} title="When is my invoice due?">
        On the 20th of each month.
      </AccordionItem>
      <AccordionItem ctx={ctx} title="Can I change my plan?" />
    </Column>
  ),
};

/**
 * Collapsible (`collapsible.tsx`, unstyled parts): open as the basic demo composes it, the
 * trigger `font-medium rounded-md px-2 py-1` in its `bg-foreground/5` hover face over a `pt-2` panel.
 */
export const collapsible: Specimen = {
  caption: "Open",
  scale: 2.5,
  draw: (ctx) => (
    <Column gap={0} style={{ width: ctx.px(176), color: ctx.c("foreground"), ...text(ctx, "sm") }}>
      <Row gap={0} style={{ alignSelf: "flex-start" }}>
        <div
          style={{
            display: "flex",
            paddingLeft: ctx.px(8),
            paddingRight: ctx.px(8),
            paddingTop: ctx.px(4),
            paddingBottom: ctx.px(4),
            borderRadius: ctx.radius("md"),
            backgroundColor: ctx.c("foreground", 0.05),
            fontWeight: 500,
          }}>
          Hide details
        </div>
      </Row>
      <span style={{ paddingTop: ctx.px(8), paddingLeft: ctx.px(8) }}>
        Delivery window, meter point and billing account.
      </span>
    </Column>
  ),
};

/** A Tabs trigger (`tabs.tsx`): md inset and type, `font-medium rounded-md`; active on `bg-background` with `shadow-sm`. */
function TabTrigger({
  ctx,
  active = false,
  children,
}: CtxProps & { readonly active?: boolean; readonly children: ReactNode }): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
        height: "100%",
        paddingLeft: ctx.metric("control-px-md"),
        paddingRight: ctx.metric("control-px-md"),
        borderRadius: ctx.radius("md"),
        border: hairline(ctx, "transparent"),
        backgroundColor: active ? ctx.c("background") : "transparent",
        color: active ? ctx.c("foreground") : ctx.c("foreground", 0.6),
        whiteSpace: "nowrap",
        ...controlText(ctx, 500),
        boxShadow: active ? shadow(ctx, "sm") : "0 0 0 0 transparent",
      }}>
      {children}
    </div>
  );
}

/**
 * Tabs (`tabs-variants.ts`): the default list, `bg-muted rounded-lg p-[3px]` at the md control
 * height, the first trigger active, over a `text-sm` panel at the root's `gap-2`.
 */
export const tabs: Specimen = {
  caption: "First tab active",
  scale: 2,
  draw: (ctx) => (
    <Column gap={ctx.px(8)} style={{ width: ctx.px(224) }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          boxSizing: "border-box",
          height: ctx.metric("control-h-md"),
          padding: ctx.px(3),
          borderRadius: ctx.radius("lg"),
          backgroundColor: ctx.c("muted"),
        }}>
        <TabTrigger ctx={ctx} active>
          Overview
        </TabTrigger>
        <TabTrigger ctx={ctx}>Usage</TabTrigger>
        <TabTrigger ctx={ctx}>Invoices</TabTrigger>
      </div>
      <Column
        gap={ctx.px(2)}
        style={{ ...text(ctx, "sm"), color: ctx.c("foreground"), paddingTop: ctx.px(4) }}>
        <span style={{ fontWeight: 500 }}>Fixed price</span>
        <span style={{ color: ctx.c("muted-foreground") }}>Renews on 1 January.</span>
      </Column>
    </Column>
  ),
};
