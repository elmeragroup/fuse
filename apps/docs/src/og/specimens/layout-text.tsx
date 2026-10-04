/**
 * Specimens for layout and type: Avatar, Card, Frame, Empty, Skeleton, Separator, ScrollArea,
 * Sidebar, Heading, Text, Span, Code, Emoji, and the DOM-less helpers Show and UiProviders.
 */

import { isValidElement } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

import type { TokenType } from "sugar-high/core";
import { parse } from "sugar-high/core";
import { tokenize } from "sugar-high/lang/javascript";

import {
  LoudlyCryingFace,
  NeutralFace,
  PartyingFace,
  SlightlyFrowningFace,
  SlightlySmilingFace,
} from "@elmeragroup/fuse/emoji";
import type { EmojiProps } from "@elmeragroup/fuse/emoji";
import { CalendarBlank, ChartBar, Gear, House, Receipt, Users } from "@elmeragroup/fuse/icons";

import { glyph } from "../og-icons";
import type { OgColorRole } from "../og-theme";
import {
  Badge,
  Button,
  Column,
  compact,
  FieldBox,
  Row,
  shadow,
  TEXT,
  text as textStyle,
} from "../specimen-kit";
import type { SpecimenContext } from "../specimen-kit";
import type { Specimen } from "./specimen";

/** Tailwind's `leading-*` ratios the type recipes pick. */
const LEADING = { none: 1, snug: 1.375, relaxed: 1.625 } as const;

/** A type-scale step at a named leading, as the Text, Span and Heading recipes compose them. */
function type(
  ctx: SpecimenContext,
  size: keyof typeof TEXT,
  leading: keyof typeof LEADING,
  weight: 400 | 500 | 600 | 700 = 400
): CSSProperties {
  const [fontSize] = TEXT[size];
  return { ...textStyle(ctx, size, weight), lineHeight: `${String(ctx.px(fontSize * LEADING[leading]))}px` };
}

/** What an avatar drawing takes. */
type AvatarDrawing = {
  readonly ctx: SpecimenContext;
  readonly initials: string;
  /** In a group, each avatar after the first overlaps by `-space-x-2` and wears `ring-2 ring-background`. */
  readonly grouped?: "first" | "rest";
};

/** `Avatar.Root` with its fallback: `size-8 rounded-full bg-muted text-muted-foreground text-sm font-medium`. */
function Avatar({ ctx, initials, grouped }: AvatarDrawing): ReactElement {
  return (
    <div
      style={compact({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: ctx.px(32),
        height: ctx.px(32),
        borderRadius: 9999,
        backgroundColor: ctx.c("muted"),
        color: ctx.c("muted-foreground"),
        ...textStyle(ctx, "sm", 500),
        boxShadow: grouped === undefined ? undefined : `0 0 0 ${String(ctx.px(2))}px ${ctx.c("background")}`,
        marginLeft: grouped === "rest" ? ctx.px(-8) : undefined,
      })}>
      {initials}
    </div>
  );
}

/** Avatar (`avatar/avatar.tsx`): `Avatar.Group` stacking three initials fallbacks. */
export const avatar: Specimen = {
  caption: "Avatar.Group, initials fallback",
  scale: 3,
  draw: (ctx) => (
    <div style={{ display: "flex" }}>
      <Avatar ctx={ctx} initials="JL" grouped="first" />
      <Avatar ctx={ctx} initials="IT" grouped="rest" />
      <Avatar ctx={ctx} initials="SH" grouped="rest" />
    </div>
  ),
};

/**
 * Card (`card/card-variants.ts`), vertical: `rounded-lg border bg-card shadow-xs`, a `p-6`
 * header with a `text-2xl font-semibold leading-none` title over a `text-sm` muted
 * description (`gap-1.5`), and `p-6 pt-0` content.
 */
export const card: Specimen = {
  caption: 'direction="vertical"',
  scale: 1.75,
  draw: (ctx) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: ctx.px(256),
        borderRadius: ctx.radius("lg"),
        border: `${String(ctx.px(1))}px solid ${ctx.c("border")}`,
        backgroundColor: ctx.c("card"),
        color: ctx.c("card-foreground"),
        boxShadow: shadow(ctx, "xs"),
      }}>
      <div style={{ display: "flex", flexDirection: "column", gap: ctx.px(6), padding: ctx.px(24) }}>
        <div style={type(ctx, "2xl", "none", 600)}>Invoice 1042</div>
        <div style={{ ...textStyle(ctx, "sm"), color: ctx.c("muted-foreground") }}>Due 15 November 2026</div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: `0 ${String(ctx.px(24))}px ${String(ctx.px(24))}px`,
          ...textStyle(ctx, "base"),
        }}>
        <span style={{ color: ctx.c("muted-foreground") }}>Amount</span>
        <span style={{ fontWeight: 600 }}>1 284,50 kr</span>
      </div>
    </div>
  ),
};

/** One label and value line in a panel, `text-sm`. */
function PanelLine({
  ctx,
  label,
  value,
}: {
  readonly ctx: SpecimenContext;
  readonly label: string;
  readonly value: string;
}): ReactElement {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", ...textStyle(ctx, "sm") }}>
      <span style={{ color: ctx.c("muted-foreground") }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

/**
 * Frame (`frame/frame.tsx`): the `rounded-xl bg-muted/72 p-1` root around a `px-5 py-4`
 * header (`text-sm font-semibold` title, muted description) and a `rounded-xl border
 * bg-background p-5` panel with its `shadow-xs/5` and 6% black underline.
 */
export const frame: Specimen = {
  caption: "Header over one panel",
  scale: 1.75,
  draw: (ctx) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: ctx.px(260),
        padding: ctx.px(4),
        borderRadius: ctx.radius("xl"),
        backgroundColor: ctx.c("muted", 0.72),
        color: ctx.c("foreground"),
      }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: `${String(ctx.px(16))}px ${String(ctx.px(20))}px`,
        }}>
        <div style={textStyle(ctx, "sm", 600)}>Meter readings</div>
        <div style={{ ...textStyle(ctx, "sm"), color: ctx.c("muted-foreground") }}>Last two months</div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: ctx.px(8),
          padding: ctx.px(20),
          borderRadius: ctx.radius("xl"),
          border: `${String(ctx.px(1))}px solid ${ctx.c("border")}`,
          backgroundColor: ctx.c("background"),
          boxShadow: `0 ${String(ctx.px(1))}px 0 rgba(0, 0, 0, 0.06), 0 ${String(ctx.px(1))}px ${String(ctx.px(2))}px 0 rgba(0, 0, 0, 0.05)`,
        }}>
        <PanelLine ctx={ctx} label="September" value="412 kWh" />
        <PanelLine ctx={ctx} label="August" value="368 kWh" />
      </div>
    </div>
  ),
};

/**
 * Empty (`empty/empty-variants.ts`), default frame: centred `gap-6`; an `icon` media box
 * (`size-10 rounded-lg bg-muted`, 24px glyph, `mb-2`), a `text-lg font-medium tracking-tight`
 * title and `text-sm/relaxed` muted description (`gap-2`), then the content's action.
 */
export const empty: Specimen = {
  caption: 'Media variant="icon", with an action',
  scale: 1.75,
  draw: (ctx) => (
    <Column gap={ctx.px(24)} style={{ alignItems: "center", color: ctx.c("foreground") }}>
      <Column gap={ctx.px(8)} style={{ alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: ctx.px(40),
            height: ctx.px(40),
            marginBottom: ctx.px(8),
            borderRadius: ctx.radius("lg"),
            backgroundColor: ctx.c("muted"),
          }}>
          {glyph(Receipt)(ctx.px(24), ctx.c("foreground"))}
        </div>
        <div style={{ ...textStyle(ctx, "lg", 500), letterSpacing: ctx.px(-0.45) }}>No invoices yet</div>
        <div style={{ ...type(ctx, "sm", "relaxed"), color: ctx.c("muted-foreground") }}>
          Invoices appear here once issued.
        </div>
      </Column>
      <Button ctx={ctx}>Set up direct debit</Button>
    </Column>
  ),
};

/** One `Skeleton` block: `rounded-md bg-muted`, sized by the caller. */
function Bone({
  ctx,
  style,
}: {
  readonly ctx: SpecimenContext;
  readonly style: CSSProperties;
}): ReactElement {
  return (
    <div
      style={{ display: "flex", borderRadius: ctx.radius("md"), backgroundColor: ctx.c("muted"), ...style }}
    />
  );
}

/**
 * Skeleton (`skeleton/skeleton.tsx`): `rounded-md bg-muted` blocks laid out as the basic demo,
 * a `size-10 rounded-full` disc beside three `h-4` lines. The pulse cannot show in a still.
 */
export const skeleton: Specimen = {
  caption: "Avatar and three text lines",
  scale: 2,
  draw: (ctx) => (
    <Row gap={ctx.px(16)} style={{ width: ctx.px(220) }}>
      <Bone ctx={ctx} style={{ width: ctx.px(40), height: ctx.px(40), flexShrink: 0, borderRadius: 9999 }} />
      <Column gap={ctx.px(8)} style={{ flexGrow: 1 }}>
        <Bone ctx={ctx} style={{ height: ctx.px(16), width: "100%" }} />
        <Bone ctx={ctx} style={{ height: ctx.px(16), width: "80%" }} />
        <Bone ctx={ctx} style={{ height: ctx.px(16), width: "60%" }} />
      </Column>
    </Row>
  ),
};

/** A vertical `Separator`: `w-px bg-border`, stretched to its row. */
function VerticalRule({ ctx }: { readonly ctx: SpecimenContext }): ReactElement {
  return (
    <div
      style={{ display: "flex", width: ctx.px(1), height: ctx.px(20), backgroundColor: ctx.c("border") }}
    />
  );
}

/**
 * Separator (`separator/separator.tsx`): a horizontal `h-px w-full bg-border` rule under a
 * heading, and vertical `w-px` rules between inline links.
 */
export const separator: Specimen = {
  caption: "Horizontal and vertical",
  scale: 2,
  draw: (ctx) => (
    <Column gap={ctx.px(16)} style={{ width: ctx.px(220), color: ctx.c("foreground") }}>
      <Column gap={ctx.px(4)}>
        <div style={textStyle(ctx, "sm", 500)}>Contract</div>
        <div style={{ ...textStyle(ctx, "sm"), color: ctx.c("muted-foreground") }}>
          Billing and delivery details
        </div>
      </Column>
      <div style={{ display: "flex", height: ctx.px(1), width: "100%", backgroundColor: ctx.c("border") }} />
      <Row gap={ctx.px(16)} style={textStyle(ctx, "sm")}>
        <span>Invoices</span>
        <VerticalRule ctx={ctx} />
        <span>Meters</span>
        <VerticalRule ctx={ctx} />
        <span>Plan</span>
      </Row>
    </Column>
  ),
};

const READINGS = ["4 210 kWh", "4 172 kWh", "4 131 kWh", "4 098 kWh", "4 060 kWh", "4 023 kWh"] as const;

/**
 * ScrollArea (`scroll-area/scroll-area.tsx`): a clipped viewport and the vertical bar,
 * `w-2.5 p-px` with a `rounded-full bg-border` thumb, shown as `type="hover"` does while hovered.
 */
export const scrollArea: Specimen = {
  caption: "Hovered, with the scrollbar shown",
  scale: 2,
  draw: (ctx) => (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: ctx.px(200),
        height: ctx.px(150),
        overflow: "hidden",
        borderRadius: ctx.radius("md"),
        border: `${String(ctx.px(1))}px solid ${ctx.c("border")}`,
        backgroundColor: ctx.c("background"),
        color: ctx.c("foreground"),
      }}>
      <Column
        gap={ctx.px(8)}
        style={{
          padding: ctx.px(16),
          paddingRight: ctx.px(24),
          width: "100%",
          alignSelf: "flex-start",
          flexShrink: 0,
        }}>
        <div style={textStyle(ctx, "sm", 500)}>Meter readings</div>
        {READINGS.map((reading) => (
          <Column key={reading} gap={ctx.px(8)} style={{ flexShrink: 0 }}>
            <div style={textStyle(ctx, "sm")}>{reading}</div>
            <div style={{ display: "flex", height: ctx.px(1), backgroundColor: ctx.c("border") }} />
          </Column>
        ))}
      </Column>
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          width: ctx.px(10),
          padding: ctx.px(1),
        }}>
        <div
          style={{ display: "flex", height: "45%", borderRadius: 9999, backgroundColor: ctx.c("border") }}
        />
      </div>
    </div>
  ),
};

const NAV = [
  { label: "Overview", icon: House, active: true },
  { label: "Invoices", icon: Receipt, active: false },
  { label: "Customers", icon: Users, active: false },
  { label: "Reports", icon: ChartBar, active: false },
  { label: "Settings", icon: Gear, active: false },
] as const;

/**
 * Sidebar (`sidebar/sidebar.tsx`, `sidebar-variants.ts`), expanded: the 16rem `bg-sidebar`
 * rail with its `border-r`, a `p-2` group of `h-8 rounded-md p-2 gap-2 text-sm` menu buttons
 * with 16px icons, the active one `font-medium` on `--sidebar-accent`, beside the inset.
 */
export const sidebar: Specimen = {
  caption: "Expanded, with the active item",
  scale: 1.75,
  draw: (ctx) => (
    <div
      style={{
        display: "flex",
        overflow: "hidden",
        borderRadius: ctx.radius("lg"),
        border: `${String(ctx.px(1))}px solid ${ctx.c("border")}`,
      }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: ctx.px(256),
          padding: ctx.px(8),
          backgroundColor: ctx.c("sidebar"),
          borderRight: `${String(ctx.px(1))}px solid ${ctx.c("sidebar-border")}`,
          color: ctx.c("sidebar-foreground"),
        }}>
        {NAV.map(({ label, icon, active }) => (
          <div
            key={label}
            style={compact({
              display: "flex",
              alignItems: "center",
              height: ctx.px(32),
              padding: ctx.px(8),
              gap: ctx.px(8),
              borderRadius: ctx.radius("md"),
              ...textStyle(ctx, "sm", active ? 500 : 400),
              backgroundColor: active ? ctx.c("sidebar-accent") : undefined,
            })}>
            {glyph(icon)(ctx.px(16), ctx.c("sidebar-foreground"))}
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", width: ctx.px(12), backgroundColor: ctx.c("background") }} />
    </div>
  ),
};

/**
 * Heading (`heading/heading-variants.ts`): `font-medium text-foreground leading-snug`, with
 * `level` picking the default size, `2xl` for 1, `lg` for 2 and `base` from 3.
 */
export const heading: Specimen = {
  caption: "level={1}, {2} and {3}",
  scale: 2,
  draw: (ctx) => (
    <Column gap={ctx.px(6)} style={{ color: ctx.c("foreground") }}>
      <div style={type(ctx, "2xl", "snug", 500)}>Your energy use</div>
      <div style={type(ctx, "lg", "snug", 500)}>Monthly breakdown</div>
      <div style={type(ctx, "base", "snug", 500)}>September 2026</div>
    </Column>
  ),
};

/**
 * Text (`text/text-variants.ts`): the default `text-base leading-relaxed font-normal` paragraph
 * inheriting its color, over a `size="sm"` `variant="muted"` one in `--muted-foreground`.
 */
export const text: Specimen = {
  caption: 'default, and size="sm" muted',
  scale: 2,
  draw: (ctx) => (
    <Column gap={ctx.px(8)} style={{ width: ctx.px(232), color: ctx.c("foreground") }}>
      <div style={type(ctx, "base", "relaxed")}>Your invoice for September is ready to view.</div>
      <div style={{ ...type(ctx, "sm", "relaxed"), color: ctx.c("muted-foreground") }}>
        Pay by direct debit to skip the reminder fee.
      </div>
    </Column>
  ),
};

/**
 * Span (`span/span-variants.ts`): Text's recipe inline at `leading-snug`; a sentence with a
 * `weight="medium"` amount and a `variant="success"` status run inside it.
 */
export const span: Specimen = {
  caption: 'weight="medium", variant="success"',
  scale: 2,
  draw: (ctx) => (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        width: ctx.px(220),
        columnGap: ctx.px(4.5),
        color: ctx.c("foreground"),
        ...type(ctx, "base", "snug"),
      }}>
      <span>Invoice 1042 for</span>
      <span style={{ fontWeight: 500 }}>1 284,50 kr</span>
      <span>is</span>
      <span style={{ color: ctx.c("success") }}>paid</span>
      <span>in full.</span>
    </div>
  ),
};

const CODE_SAMPLE = `const total = 1284.5;
// Due in two weeks
pay({ invoice: "1042", total });`;

/**
 * The role a sugar-high token paints in: its `--sh-*` syntax color. Line breaks and spaces carry
 * no ink and no syntax token, so they take the foreground.
 */
function syntaxRole(token: TokenType): OgColorRole {
  switch (token) {
    case "identifier":
      return "sh-identifier";
    case "keyword":
      return "sh-keyword";
    case "string":
      return "sh-string";
    case "class":
      return "sh-class";
    case "property":
      return "sh-property";
    case "entity":
      return "sh-entity";
    case "jsxliterals":
      return "sh-jsxliterals";
    case "sign":
      return "sh-sign";
    case "comment":
      return "sh-comment";
    case "break":
    case "space":
      return "foreground";
  }
}

/**
 * Code (`code/code.tsx`): a bare `pre` at `text-xs leading-relaxed`, tokenised by the same
 * sugar-high JavaScript preset and painted in the theme's `--sh-*` colors. Roboto stands in
 * for `font-mono`, which the image renderer does not have.
 */
export const code: Specimen = {
  caption: "JavaScript, highlighted",
  scale: 2.5,
  draw: (ctx) => {
    const lines = parse(CODE_SAMPLE, { tokenize: (source) => tokenize(source, undefined) }).lines;
    return (
      <Column gap={0} style={{ ...type(ctx, "xs", "relaxed"), whiteSpace: "pre" }}>
        {lines.map((line) => (
          <div key={line.index} style={{ display: "flex" }}>
            {line.tokens.map((token, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- tokens are positional within a fixed line
              <span key={index} style={{ color: ctx.c(syntaxRole(token.type)) }}>
                {token.value}
              </span>
            ))}
          </div>
        ))}
      </Column>
    );
  },
};

/** Lifts a Twemoji face's intrinsic SVG children out of its `EmojiSvg` wrapper. */
function face(Face: (props: EmojiProps) => ReactElement, size: number): ReactElement {
  const wrapper = Face({});
  const children: ReactNode = isValidElement<{ children?: ReactNode }>(wrapper)
    ? wrapper.props.children
    : null;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width={size} height={size}>
      {children}
    </svg>
  );
}

const FACES = [
  { name: "loudly-crying", Face: LoudlyCryingFace },
  { name: "slightly-frowning", Face: SlightlyFrowningFace },
  { name: "neutral", Face: NeutralFace },
  { name: "slightly-smiling", Face: SlightlySmilingFace },
  { name: "partying", Face: PartyingFace },
] as const;

/** Emoji (`emoji/emoji.tsx`): the five Twemoji faces, drawn from the library's own SVG paths. */
export const emoji: Specimen = {
  caption: "All five faces",
  scale: 2,
  draw: (ctx) => (
    <Row gap={ctx.px(10)}>
      {FACES.map(({ name, Face }) => (
        <div key={name} style={{ display: "flex" }}>
          {face(Face, ctx.px(36))}
        </div>
      ))}
    </Row>
  ),
};

/** One side of the Show specimen: the condition, and what renders under it. */
function Branch({
  ctx,
  when,
  children,
}: {
  readonly ctx: SpecimenContext;
  readonly when: boolean;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <Column gap={ctx.px(8)} style={{ width: ctx.px(112) }}>
      <Badge ctx={ctx} variant={when ? "secondary" : "outline"}>
        {`when={${String(when)}}`}
      </Badge>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: ctx.px(56),
          padding: ctx.px(10),
          borderRadius: ctx.radius("md"),
          border: `${String(ctx.px(1))}px ${when ? "solid" : "dashed"} ${ctx.c("border")}`,
          color: when ? ctx.c("foreground") : ctx.c("muted-foreground"),
          ...type(ctx, "sm", "snug"),
        }}>
        {children}
      </div>
    </Column>
  );
}

/**
 * Show (`show/show.tsx`) renders no DOM of its own, so the specimen is conceptual: the same
 * children rendered under `when={true}` and absent under `when={false}`.
 */
export const show: Specimen = {
  caption: "when={true} and when={false}",
  scale: 2,
  draw: (ctx) => (
    <Row gap={ctx.px(16)} style={{ alignItems: "flex-start" }}>
      <Branch ctx={ctx} when>
        Meter details
      </Branch>
      <Branch ctx={ctx} when={false}>
        Not rendered
      </Branch>
    </Row>
  ),
};

const LOCALES = ["nb-NO", "sv-SE"] as const;
const SAMPLE_DATE = new Date(Date.UTC(2026, 9, 4, 12));

/**
 * UiProviders (`react-aria/ui-providers/ui-providers.tsx`) renders no DOM of its own, so the
 * specimen is conceptual: one date in a field box, formatted under each `locale` it forwards.
 */
export const uiProviders: Specimen = {
  caption: 'locale="nb-NO" and "sv-SE"',
  scale: 2,
  draw: (ctx) => (
    <Column gap={ctx.px(10)}>
      {LOCALES.map((locale) => (
        <Row key={locale} gap={ctx.px(10)}>
          <div style={{ display: "flex", width: ctx.px(52) }}>
            <Badge ctx={ctx} variant="secondary">
              {locale}
            </Badge>
          </div>
          <FieldBox ctx={ctx} width={ctx.px(150)} end={glyph(CalendarBlank)}>
            {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone: "UTC" }).format(SAMPLE_DATE)}
          </FieldBox>
        </Row>
      ))}
    </Column>
  ),
};
