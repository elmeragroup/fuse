/**
 * The drawing kit every component specimen composes. Satori cannot run Fuse's Tailwind classes,
 * so each part redraws one Fuse recipe from the theme's tokens: the same control metrics (from
 * the generated landing facts, per density), radius rungs, borders, fills and shadows. A
 * specimen draws at a scale, so a 36px control reads at the size a link preview shows.
 *
 * Recipe owners, for review against `packages/fuse`: Button `button-variants.ts`, the field box
 * `styles/field-box.ts`, popups `overlay/` and `select/`, Badge `badge-variants.ts`, Card
 * `card-variants.ts`, the radius rungs `styles/fuse.css`.
 */

import type { CSSProperties, ReactElement, ReactNode } from "react";

import { Check, Minus } from "@elmeragroup/fuse/icons";
import type { Density } from "@elmeragroup/fuse/theme";
import type { DensityMetricName } from "@elmeragroup/fuse/theme-catalog";

import { LANDING_FACTS } from "../generated/landing-facts";
import type { OgColorRole } from "../generated/og-themes";
import { glyph } from "./og-icons";
import type { IconSlot } from "./og-icons";
import { css } from "./og-theme";
import type { OgTheme } from "./og-theme";
import { compact } from "./satori-style";

/** A control size rung, as Fuse names them. */
type ControlSize = "xs" | "sm" | "md" | "lg";

/** A corner a specimen rounds to: a radius rung, Button's own radius, or a pill. */
type Corner = "xs" | "sm" | "md" | "lg" | "xl" | "popover" | "button" | "full";

/** Everything a specimen reads: the theme, its scale and the density's control metrics. */
export type SpecimenContext = {
  /** The theme the specimen paints in. */
  readonly theme: OgTheme;
  /** CSS pixels → image pixels. */
  readonly px: (cssPx: number) => number;
  /** A role as a CSS color, optionally at an opacity like Tailwind's `/80`. */
  readonly c: (role: OgColorRole, alpha?: number) => string;
  /** A control metric (`control-h-md`, `control-px-button-sm`, …) in image pixels. */
  readonly metric: (name: DensityMetricName) => number;
  /** A corner in image pixels: a radius rung, `--radius-button`, or a pill. */
  readonly radius: (corner: Corner) => number;
};

function cssMetric(name: DensityMetricName, density: Density): number {
  const metric = LANDING_FACTS.metrics.find((candidate) => candidate.name === name);
  if (metric === undefined) {
    throw new Error(`No control metric named ${name} in the generated landing facts.`);
  }
  return metric.px[density];
}

/** A corner in CSS px, from the theme's rungs and `--radius-button`. */
function cornerPx(theme: OgTheme, corner: Exclude<Corner, "full">): number {
  return corner === "button" ? theme.dimensions["radius-button"] : theme.rungs[`radius-${corner}`];
}

/**
 * The context for one specimen drawing.
 *
 * @param theme - The theme to paint.
 * @param scale - Image pixels per CSS pixel.
 * @returns The context.
 */
export function specimenContext(theme: OgTheme, scale: number): SpecimenContext {
  const px = (cssPx: number): number => Math.round(cssPx * scale * 100) / 100;
  return {
    theme,
    px,
    c: (role, alpha) => css(theme.colors[role], alpha),
    metric: (name) => px(cssMetric(name, theme.density)),
    radius: (corner) => (corner === "full" ? 9999 : px(cornerPx(theme, corner))),
  };
}

/**
 * A hairline border, `border` in Tailwind, scaled.
 *
 * @param ctx - The specimen context.
 * @param color - The border color.
 * @returns A `border` value.
 */
export function hairline(ctx: SpecimenContext, color: string): string {
  return `${String(ctx.px(1))}px solid ${color}`;
}

/** Tailwind's elevation rungs as the recipes spell them, scaled. */
export function shadow(ctx: SpecimenContext, rung: "xs" | "sm" | "md" | "lg"): string {
  const p = ctx.px;
  switch (rung) {
    case "xs":
      return `0 ${String(p(1))}px ${String(p(2))}px 0 rgba(0, 0, 0, 0.05)`;
    case "sm":
      return `0 ${String(p(1))}px ${String(p(3))}px 0 rgba(0, 0, 0, 0.1), 0 ${String(p(1))}px ${String(p(2))}px ${String(p(-1))}px rgba(0, 0, 0, 0.1)`;
    case "md":
      return `0 ${String(p(4))}px ${String(p(6))}px ${String(p(-1))}px rgba(0, 0, 0, 0.1), 0 ${String(p(2))}px ${String(p(4))}px ${String(p(-2))}px rgba(0, 0, 0, 0.1)`;
    case "lg":
      return `0 ${String(p(10))}px ${String(p(15))}px ${String(p(-3))}px rgba(0, 0, 0, 0.1), 0 ${String(p(4))}px ${String(p(6))}px ${String(p(-4))}px rgba(0, 0, 0, 0.1)`;
  }
}

/** The shared focus ring's metrics (`styles/utils.ts`): `ring-2` around a `ring-offset-2` gap. */
const FOCUS_RING = { width: 2, offset: 2 } as const;

/**
 * The shared focus ring on a box (`styles/utils.ts`: `ring-2 ring-ring ring-offset-2
 * ring-offset-background`), as Tailwind composes it: an offset layer in `--background`, the ring
 * layer in `--ring`, then the box's own elevation.
 *
 * @param ctx - The specimen context.
 * @param elevation - The box's own shadow, which the ring layers sit over.
 * @returns A `box-shadow` value.
 */
export function focusRingShadow(ctx: SpecimenContext, elevation: string = shadow(ctx, "xs")): string {
  const offset = ctx.px(FOCUS_RING.offset);
  const ring = ctx.px(FOCUS_RING.offset + FOCUS_RING.width);
  return `0 0 0 ${String(offset)}px ${ctx.c("background")}, 0 0 0 ${String(ring)}px ${ctx.c("ring")}, ${elevation}`;
}

/**
 * The same focus ring on a run of text, drawn as a border around the offset gap and pulled back by
 * negative margins so the text does not move. Satori paints a spread `box-shadow` on a text box
 * unevenly, so text takes this form of the ring.
 *
 * @param ctx - The specimen context.
 * @returns Style members for the focused element.
 */
export function focusRingOutline(ctx: SpecimenContext): CSSProperties {
  return {
    padding: ctx.px(FOCUS_RING.offset),
    margin: -ctx.px(FOCUS_RING.offset + FOCUS_RING.width),
    border: `${String(ctx.px(FOCUS_RING.width))}px solid ${ctx.c("ring")}`,
  };
}

/**
 * The invalid face's ring (`styles/state-face.ts`: `ring-3 ring-error/20`) over the box's
 * elevation. The invalid border, `--error`, is the caller's.
 *
 * @param ctx - The specimen context.
 * @returns A `box-shadow` value.
 */
function invalidRingShadow(ctx: SpecimenContext): string {
  return `0 0 0 ${String(ctx.px(3))}px ${ctx.c("error", 0.2)}, ${shadow(ctx, "xs")}`;
}

/** Tailwind's type scale in CSS px: `[font-size, line-height]`. */
export const TEXT = {
  xs: [12, 16],
  sm: [14, 20],
  base: [16, 24],
  lg: [18, 28],
  xl: [20, 28],
  "2xl": [24, 32],
} as const;

/** A text style from Tailwind's scale, scaled. */
export function text(
  ctx: SpecimenContext,
  size: keyof typeof TEXT,
  weight: 400 | 500 | 600 | 700 = 400
): CSSProperties {
  const [fontSize, lineHeight] = TEXT[size];
  return { fontSize: ctx.px(fontSize), lineHeight: `${String(ctx.px(lineHeight))}px`, fontWeight: weight };
}

/** The density's control type pair, `--control-text` / `--control-leading`. */
export function controlText(ctx: SpecimenContext, weight: 400 | 500 | 600 = 400): CSSProperties {
  return {
    fontSize: ctx.metric("control-text"),
    lineHeight: `${String(ctx.metric("control-leading"))}px`,
    fontWeight: weight,
  };
}

/** Button's variants (`button-variants.ts`). */
type ButtonVariant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "success" | "link";

/** What a Button drawing takes. */
export type ButtonDrawing = {
  readonly ctx: SpecimenContext;
  readonly variant?: ButtonVariant;
  readonly size?: ControlSize;
  /** A square icon button at the size, `icon`/`icon-sm` in the recipe. */
  readonly square?: boolean;
  readonly start?: IconSlot;
  readonly end?: IconSlot;
  readonly children?: ReactNode;
  readonly style?: CSSProperties;
};

/** The text and icon color of a Button variant. */
function buttonInk(ctx: SpecimenContext, variant: ButtonVariant): string {
  switch (variant) {
    case "default":
      return ctx.c("primary-foreground");
    case "secondary":
      return ctx.c("secondary-foreground");
    case "destructive":
      return ctx.c("error");
    case "success":
      return ctx.c("success");
    case "link":
      return ctx.c("primary");
    case "outline":
    case "ghost":
      return ctx.c("foreground");
  }
}

function buttonPaint(ctx: SpecimenContext, variant: ButtonVariant): CSSProperties {
  switch (variant) {
    case "default":
      return {
        backgroundColor: ctx.c("primary"),
        color: ctx.c("primary-foreground"),
        border: hairline(ctx, "transparent"),
      };
    case "outline": {
      const width = ctx.theme.dimensions["button-outline-width"];
      return {
        backgroundColor: ctx.c("background"),
        color: ctx.c("foreground"),
        border: `${String(ctx.px(width))}px solid ${ctx.c("button-outline")}`,
        boxShadow: width === 1 ? shadow(ctx, "xs") : undefined,
      };
    }
    case "secondary":
      return {
        backgroundColor: ctx.c("secondary"),
        color: ctx.c("secondary-foreground"),
        border: hairline(ctx, "transparent"),
      };
    case "ghost":
      return { color: ctx.c("foreground"), border: hairline(ctx, "transparent") };
    case "destructive":
      return {
        backgroundColor: ctx.c("error", 0.1),
        color: ctx.c("error"),
        border: hairline(ctx, ctx.c("error", 0.2)),
      };
    case "success":
      return {
        backgroundColor: ctx.c("success", 0.1),
        color: ctx.c("success"),
        border: hairline(ctx, ctx.c("success", 0.2)),
      };
    case "link":
      return { color: ctx.c("primary"), border: hairline(ctx, "transparent") };
  }
}

/**
 * Button: `font-medium`, `rounded-(--radius-button)`, the size's control height and Button's own
 * inline padding (`--control-px-button-*`), icon edges at `--control-px-button-icon-*`.
 */
export function Button(drawing: ButtonDrawing): ReactElement {
  const { ctx, variant = "default", size = "md", square = false, start, end, children, style } = drawing;
  const height = ctx.metric(`control-h-${size}`);
  const paint = buttonPaint(ctx, variant);
  const color = buttonInk(ctx, variant);
  const icon = ctx.px(size === "xs" ? 12 : 16);
  const inset = ctx.metric(`control-px-button-${size}`);
  const iconInset = ctx.metric(`control-px-button-icon-${size}`);
  const typeStyle =
    size === "xs" ? text(ctx, "xs", 500) : size === "sm" ? text(ctx, "sm", 500) : controlText(ctx, 500);
  return (
    <div
      style={compact({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxSizing: "border-box",
        height,
        width: square ? height : undefined,
        paddingLeft: square ? 0 : start === undefined ? inset : iconInset,
        paddingRight: square ? 0 : end === undefined ? inset : iconInset,
        gap: ctx.metric(`control-gap-${size}`),
        borderRadius: ctx.radius("button"),
        whiteSpace: "nowrap",
        ...typeStyle,
        ...paint,
        ...style,
      })}>
      {start?.(icon, color)}
      {children}
      {end?.(icon, color)}
    </div>
  );
}

/** A field box's face: at rest, focused, or invalid. */
export type FieldFace = "rest" | "focused" | "invalid";

/**
 * The field box chrome (`styles/field-box.ts`): `rounded-md`, a hairline `--input` border on
 * `--card`, `shadow-xs` and the density's control type. Focused, the shared focus ring paints
 * over it; invalid, the border turns `--error` under a 3px ring of `--error` at 20%.
 *
 * @param ctx - The specimen context.
 * @param face - The face to paint.
 * @returns Style members for the box.
 */
export function fieldChrome(ctx: SpecimenContext, face: FieldFace = "rest"): CSSProperties {
  return {
    boxSizing: "border-box",
    borderRadius: ctx.radius("md"),
    border: hairline(ctx, face === "invalid" ? ctx.c("error") : ctx.c("input")),
    backgroundColor: ctx.c("card"),
    boxShadow:
      face === "invalid"
        ? invalidRingShadow(ctx)
        : face === "focused"
          ? focusRingShadow(ctx)
          : shadow(ctx, "xs"),
    color: ctx.c("foreground"),
    ...controlText(ctx),
  };
}

/** What a field box drawing takes. */
export type FieldBoxDrawing = {
  readonly ctx: SpecimenContext;
  readonly width: number;
  readonly children?: ReactNode;
  readonly start?: IconSlot;
  readonly end?: IconSlot;
  /** Paints the shared focus ring over the box; the hairline stays `--input`. */
  readonly focused?: boolean;
  /** Paints the invalid face: an `--error` border and a 3px ring of `--error` at 20%. */
  readonly invalid?: boolean;
  /** `content` grows with its text, as Textarea does; `control` pins the md height. */
  readonly box?: "control" | "content";
  readonly style?: CSSProperties;
};

/**
 * The field box (`styles/field-box.ts`): the field chrome at the md control height and inset.
 */
export function FieldBox(drawing: FieldBoxDrawing): ReactElement {
  const {
    ctx,
    width,
    children,
    start,
    end,
    focused = false,
    invalid = false,
    box = "control",
    style,
  } = drawing;
  const icon = ctx.px(16);
  return (
    <div
      style={compact({
        display: "flex",
        alignItems: box === "control" ? "center" : "flex-start",
        width,
        height: box === "control" ? ctx.metric("control-h-md") : undefined,
        minHeight: box === "content" ? ctx.px(64) : undefined,
        paddingLeft: ctx.metric("control-px-md"),
        paddingRight: ctx.metric("control-px-md"),
        paddingTop: box === "content" ? ctx.px(8) : 0,
        paddingBottom: box === "content" ? ctx.px(8) : 0,
        gap: ctx.metric("control-gap-md"),
        ...fieldChrome(ctx, invalid ? "invalid" : focused ? "focused" : "rest"),
        ...style,
      })}>
      {start?.(icon, ctx.c("muted-foreground"))}
      <div style={{ display: "flex", flexGrow: 1, minWidth: 0 }}>{children}</div>
      {end?.(icon, ctx.c("muted-foreground"))}
    </div>
  );
}

/** A Checkbox's state: unchecked, checked, or indeterminate. */
export type CheckboxState = "off" | "on" | "mixed";

/** What a Checkbox drawing takes. */
export type CheckboxDrawing = {
  readonly ctx: SpecimenContext;
  readonly state: CheckboxState;
};

/**
 * The 16px Checkbox box (`checkbox.tsx`): `border-input bg-card shadow-xs`, filled with
 * `--primary` and a 14px `Check` (or `Minus`, indeterminate) in `--primary-foreground` when on.
 * Its corner is `checkboxCornerClass` (`styles/corner-radius.ts`):
 * `min(--radius-md, max(4px, --radius - 1000 * --radius-step))`, the theme radius in internal
 * themes and `min(md, 4px)` in external ones.
 */
export function Checkbox({ ctx, state }: CheckboxDrawing): ReactElement {
  const on = state !== "off";
  const { radius, "radius-step": step } = ctx.theme.dimensions;
  const icon = state === "on" ? glyph(Check) : state === "mixed" ? glyph(Minus) : undefined;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxSizing: "border-box",
        width: ctx.px(16),
        height: ctx.px(16),
        borderRadius: Math.min(ctx.radius("md"), ctx.px(Math.max(4, radius - 1000 * step))),
        border: hairline(ctx, on ? ctx.c("primary") : ctx.c("input")),
        backgroundColor: on ? ctx.c("primary") : ctx.c("card"),
        boxShadow: shadow(ctx, "xs"),
      }}>
      {icon?.(ctx.px(14), ctx.c("primary-foreground"))}
    </div>
  );
}

/** A run of text in one of the field roles. */
type TextDrawing = {
  readonly ctx: SpecimenContext;
  readonly children: ReactNode;
};

/** Placeholder text inside a field box. */
export function Placeholder({ ctx, children }: TextDrawing): ReactElement {
  return <span style={{ color: ctx.c("muted-foreground") }}>{children}</span>;
}

/** `Field.Label`: `text-sm font-medium`. */
export function Label({ ctx, children }: TextDrawing): ReactElement {
  return <span style={{ ...text(ctx, "sm", 500), color: ctx.c("foreground") }}>{children}</span>;
}

/** `Field.Description`: `text-sm text-muted-foreground`. */
export function Description({ ctx, children }: TextDrawing): ReactElement {
  return <span style={{ ...text(ctx, "sm"), color: ctx.c("muted-foreground") }}>{children}</span>;
}

/** What a popup surface drawing takes. */
export type PopupDrawing = {
  readonly ctx: SpecimenContext;
  readonly width: number;
  readonly children: ReactNode;
  /** The corner rung; the shared surface is `md`, Select's list overrides it to `lg`. */
  readonly corner?: "md" | "lg";
  readonly padding?: number;
  readonly style?: CSSProperties;
};

/**
 * The anchored popup surface (`overlay/overlay-classes.ts`): `--popover` fill, `shadow-md` and
 * a `ring-1` of `--foreground` at 10% in place of a border, rounded `md`.
 */
export function Popup(drawing: PopupDrawing): ReactElement {
  const { ctx, width, children, corner = "md", padding = ctx.px(4), style } = drawing;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        width,
        padding,
        borderRadius: ctx.radius(corner),
        backgroundColor: ctx.c("popover"),
        color: ctx.c("popover-foreground"),
        boxShadow: `0 0 0 ${String(ctx.px(1))}px ${ctx.c("foreground", 0.1)}, ${shadow(ctx, "md")}`,
        ...style,
      }}>
      {children}
    </div>
  );
}

/** What a menu row drawing takes. */
export type MenuRowDrawing = {
  readonly ctx: SpecimenContext;
  readonly children: ReactNode;
  readonly highlighted?: boolean;
  readonly start?: IconSlot;
  /** The trailing indicator, such as Select's check, in the row's `pr-8` gutter. */
  readonly end?: IconSlot;
};

/**
 * A menu row (`menuItemClass`): `text-sm`, `py-1.5 pl-2`, `gap-2`, `rounded-sm`, filled with
 * `--accent` while highlighted.
 */
export function MenuRow(drawing: MenuRowDrawing): ReactElement {
  const { ctx, children, highlighted = false, start, end } = drawing;
  const color = highlighted ? ctx.c("accent-foreground") : ctx.c("popover-foreground");
  return (
    <div
      style={compact({
        position: "relative",
        display: "flex",
        alignItems: "center",
        paddingTop: ctx.px(6),
        paddingBottom: ctx.px(6),
        paddingLeft: ctx.px(8),
        paddingRight: ctx.px(32),
        gap: ctx.px(8),
        borderRadius: ctx.radius("sm"),
        backgroundColor: highlighted ? ctx.c("accent") : undefined,
        color,
        ...text(ctx, "sm"),
      })}>
      {start?.(ctx.px(16), color)}
      <div style={{ display: "flex", flexGrow: 1 }}>{children}</div>
      {end === undefined ? null : (
        <div style={{ position: "absolute", right: ctx.px(8), display: "flex" }}>
          {end(ctx.px(16), color)}
        </div>
      )}
    </div>
  );
}

/** Badge's variants (`badge-variants.ts`), the ones specimens use. */
type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "muted";

/** What a badge drawing takes. */
export type BadgeDrawing = {
  readonly ctx: SpecimenContext;
  readonly variant?: BadgeVariant;
  readonly children: ReactNode;
};

/** A badge variant's fill, text color and border color. */
type BadgePaint = {
  readonly fill: string;
  readonly color: string;
  readonly border: string;
};

function badgePaint(ctx: SpecimenContext, variant: BadgeVariant): BadgePaint {
  switch (variant) {
    case "default":
      return { fill: ctx.c("primary"), color: ctx.c("primary-foreground"), border: "transparent" };
    case "secondary":
      return { fill: ctx.c("secondary"), color: ctx.c("secondary-foreground"), border: "transparent" };
    case "outline":
      return { fill: "transparent", color: ctx.c("foreground"), border: ctx.c("border") };
    case "success":
      return { fill: ctx.c("success"), color: ctx.c("success-foreground"), border: "transparent" };
    case "warning":
      return { fill: ctx.c("warning"), color: ctx.c("warning-foreground"), border: "transparent" };
    case "destructive":
      return { fill: ctx.c("error"), color: ctx.c("error-foreground"), border: "transparent" };
    case "info":
      return { fill: ctx.c("info-soft"), color: ctx.c("info-soft-foreground"), border: ctx.c("info", 0.2) };
    case "muted":
      return { fill: ctx.c("muted"), color: ctx.c("foreground"), border: "transparent" };
  }
}

/** Badge (`badge-variants.ts`): `rounded-lg`, a hairline border, `text-xs font-medium`, `px-2.5 py-0.5`. */
export function Badge({ ctx, variant = "default", children }: BadgeDrawing): ReactElement {
  const paint = badgePaint(ctx, variant);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        padding: `${String(ctx.px(2))}px ${String(ctx.px(10))}px`,
        borderRadius: ctx.radius("lg"),
        border: hairline(ctx, paint.border),
        backgroundColor: paint.fill,
        color: paint.color,
        whiteSpace: "nowrap",
        ...text(ctx, "xs", 500),
      }}>
      {children}
    </div>
  );
}

/** A flex line with a gap. */
type StackDrawing = {
  readonly gap: number;
  readonly children: ReactNode;
  readonly style?: CSSProperties;
};

/** A plain column with a gap, the layout most specimens need. */
export function Column({ gap, children, style }: StackDrawing): ReactElement {
  return <div style={{ display: "flex", flexDirection: "column", gap, ...style }}>{children}</div>;
}

/** A plain row with a gap, items centred. */
export function Row({ gap, children, style }: StackDrawing): ReactElement {
  return <div style={{ display: "flex", alignItems: "center", gap, ...style }}>{children}</div>;
}
