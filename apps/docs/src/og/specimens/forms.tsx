/**
 * Specimens for the form controls: the selection controls (Checkbox, CheckboxCard, RadioGroup,
 * SelectionItem), the labeled field family (Field, TextField, Textarea, TextareaField), the
 * grouped boxes (InputGroup, SearchField, NumberField, PhoneNumberField, Combobox) and Meter.
 */

import type { CSSProperties, ReactElement, ReactNode } from "react";

import {
  CaretDown,
  Check,
  CheckCircle,
  Gauge,
  MagnifyingGlass,
  Minus,
  Plus,
  X,
} from "@elmeragroup/fuse/icons";

import { glyph } from "../og-icons";
import { compact } from "../satori-style";
import {
  Badge,
  Checkbox,
  Column,
  Description,
  FieldBox,
  fieldChrome,
  hairline,
  MenuRow,
  Placeholder,
  Popup,
  Row,
  shadow,
  text,
} from "../specimen-kit";
import type { SpecimenContext } from "../specimen-kit";
import type { Specimen } from "./specimen";

/** What a heading or message line takes. */
type LineDrawing = {
  readonly ctx: SpecimenContext;
  readonly children: ReactNode;
  readonly color?: string;
};

/** `Field.Label`: `text-sm font-medium leading-snug`, inheriting the root's color. */
function FieldLabel({ ctx, children, color }: LineDrawing): ReactElement {
  return (
    <span
      style={{
        ...text(ctx, "sm", 500),
        lineHeight: `${String(ctx.px(14 * 1.375))}px`,
        color: color ?? ctx.c("foreground"),
      }}>
      {children}
    </span>
  );
}

/** `Field.Error`: `text-sm font-normal text-error`. */
function FieldError({ ctx, children }: LineDrawing): ReactElement {
  return <span style={{ ...text(ctx, "sm"), color: ctx.c("error") }}>{children}</span>;
}

/** What a selection control drawing takes. */
type ControlDrawing = {
  readonly ctx: SpecimenContext;
  readonly checked: boolean;
};

/**
 * The 16px radio (`radio-group.tsx`): a `rounded-full` `border-input` ring; checked, it fills
 * `--primary` and centres an 8px `--primary-foreground` dot.
 */
function RadioDot({ ctx, checked }: ControlDrawing): ReactElement {
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
        borderRadius: 9999,
        border: hairline(ctx, checked ? ctx.c("primary") : ctx.c("input")),
        backgroundColor: checked ? ctx.c("primary") : "transparent",
      }}>
      {checked ? (
        <div
          style={{
            width: ctx.px(8),
            height: ctx.px(8),
            borderRadius: 9999,
            backgroundColor: ctx.c("primary-foreground"),
          }}
        />
      ) : null}
    </div>
  );
}

/** What a group box drawing takes. */
type GroupBoxDrawing = {
  readonly ctx: SpecimenContext;
  readonly width: number;
  readonly children: ReactNode;
  /** Paints InputGroup's focus face: the shared focus ring and a `--ring` hairline. */
  readonly focused?: boolean;
  readonly style?: CSSProperties;
};

/**
 * A grouped field box (`input-group.tsx`, RAC `fieldGroupVariants`, `numberFieldGroupClass`):
 * the field-box chrome at the md control height, `--card` fill included, with its parts laid in a
 * row and no inset of its own, since each part pads itself.
 */
function GroupBox(drawing: GroupBoxDrawing): ReactElement {
  const { ctx, width, children, focused = false, style } = drawing;
  return (
    <div
      style={compact({
        display: "flex",
        alignItems: "center",
        width,
        height: ctx.metric("control-h-md"),
        overflow: "hidden",
        ...fieldChrome(ctx, focused ? "focused" : "rest"),
        // InputGroup's focus face also turns the hairline to `--ring` (`input-group.tsx`).
        border: hairline(ctx, focused ? ctx.c("ring") : ctx.c("input")),
        backgroundColor: ctx.c("card"),
        ...style,
      })}>
      {children}
    </div>
  );
}

/** What a group's text part takes: the md inset type, trimmed on a side an addon sits on. */
type GroupInputDrawing = {
  readonly ctx: SpecimenContext;
  readonly children: ReactNode;
  readonly paddingLeft?: number;
  readonly paddingRight?: number;
};

/** The input inside a group: `flex-1`, the md control inset and type, no chrome of its own. */
function GroupInput({ ctx, children, paddingLeft, paddingRight }: GroupInputDrawing): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexGrow: 1,
        minWidth: 0,
        overflow: "hidden",
        whiteSpace: "nowrap",
        paddingLeft: paddingLeft ?? ctx.metric("control-px-md"),
        paddingRight: paddingRight ?? ctx.metric("control-px-md"),
      }}>
      {children}
    </div>
  );
}

/** A thin text cursor after typed text, to show the box has focus. */
function Caret({ ctx }: { readonly ctx: SpecimenContext }): ReactElement {
  return (
    <div
      style={{
        width: ctx.px(1),
        height: ctx.px(16),
        marginLeft: ctx.px(1),
        alignSelf: "center",
        backgroundColor: ctx.c("foreground"),
      }}
    />
  );
}

/** The Nordic flags the phone specimen draws: the packaged 21 × 15 assets' cross geometry. */
const NORDIC_FLAGS = {
  NO: { field: "#F14247", cross: "#FFFFFF", inner: "#0A3A85" },
  SE: { field: "#157CBB", cross: "#FFD34D", inner: undefined },
} as const;

/** What a flag drawing takes. */
type FlagDrawing = {
  readonly ctx: SpecimenContext;
  readonly country: keyof typeof NORDIC_FLAGS;
};

/**
 * A packaged flag (`flags/<code>.svg`, shown at `w-5 h-[15px]` by `flag.tsx`), redrawn from the
 * asset's own polygons with each gradient's first stop as a flat fill.
 */
function Flag({ ctx, country }: FlagDrawing): ReactElement {
  const flag = NORDIC_FLAGS[country];
  return (
    <svg width={ctx.px(20)} height={ctx.px((20 * 15) / 21)} viewBox="0 0 21 15">
      <rect x="0" y="0" width="21" height="15" fill={flag.field} />
      <polygon points="0 9 6 9 6 15 9 15 9 9 21 9 21 6 9 6 9 0 6 0 6 6 0 6" fill={flag.cross} />
      {flag.inner === undefined ? null : (
        <polygon points="0 8 7 8 7 15 8 15 8 8 21 8 21 7 8 7 8 0 7 0 7 7 0 7" fill={flag.inner} />
      )}
    </svg>
  );
}

/** Checkbox (`checkbox.tsx`): checked, labeled through a horizontal `Field.Root` (`gap-3`). */
export const checkbox: Specimen = {
  caption: "checked",
  scale: 3,
  draw: (ctx) => (
    <Row gap={ctx.px(12)}>
      <Checkbox ctx={ctx} state="on" />
      <FieldLabel ctx={ctx}>Email invoices</FieldLabel>
    </Row>
  ),
};

/**
 * CheckboxCard (`checkbox-card.tsx` over `card-variants.ts`): the default `bg-card` card,
 * checked, its 24px fill `CheckCircle` in `--success`, a tag badge over the `text-lg` title.
 */
export const checkboxCard: Specimen = {
  caption: "checked, with a tag",
  scale: 2,
  draw: (ctx) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: ctx.px(12),
        boxSizing: "border-box",
        width: ctx.px(230),
        padding: `${String(ctx.px(12))}px ${String(ctx.px(16))}px`,
        borderRadius: ctx.radius("lg"),
        border: hairline(ctx, ctx.c("border")),
        backgroundColor: ctx.c("card"),
        boxShadow: shadow(ctx, "xs"),
      }}>
      {glyph(CheckCircle, "fill")(ctx.px(24), ctx.c("success"))}
      <Column gap={0} style={{ flexGrow: 1 }}>
        <Row gap={ctx.px(8)}>
          <Badge ctx={ctx}>Popular</Badge>
        </Row>
        <span style={{ ...text(ctx, "lg", 500), color: ctx.c("foreground") }}>Fixed price</span>
        <span style={{ ...text(ctx, "sm"), color: ctx.c("foreground") }}>Lock your rate for a year.</span>
      </Column>
    </div>
  ),
};

/** RadioGroup (`radio-group.tsx`): the label legend over a vertical `gap-2` stack, one picked. */
export const radioGroup: Specimen = {
  caption: "vertical, one selected",
  scale: 2.5,
  draw: (ctx) => (
    <Column gap={ctx.px(12)}>
      <FieldLabel ctx={ctx}>Price plan</FieldLabel>
      <Column gap={ctx.px(8)}>
        {[
          { label: "Spot price", checked: false },
          { label: "Fixed price", checked: true },
          { label: "Variable price", checked: false },
        ].map((option) => (
          <Row key={option.label} gap={ctx.px(8)}>
            <RadioDot ctx={ctx} checked={option.checked} />
            <span style={{ ...text(ctx, "sm"), color: ctx.c("foreground") }}>{option.label}</span>
          </Row>
        ))}
      </Column>
    </Column>
  ),
};

/** What a selection row drawing takes. */
type SelectionRowDrawing = {
  readonly ctx: SpecimenContext;
  readonly title: string;
  readonly description: string;
  readonly checked: boolean;
  readonly first: boolean;
  readonly last: boolean;
};

/**
 * One connected selection shell (`selection-item.tsx`): the outline Item border, `px-4`,
 * `py-3.5`, `gap-x-2.5`, `bg-background`; a checked shell takes `border-primary bg-muted`.
 */
function SelectionRow(drawing: SelectionRowDrawing): ReactElement {
  const { ctx, title, description, checked, first, last } = drawing;
  const corner = ctx.radius("lg");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: ctx.px(10),
        boxSizing: "border-box",
        width: ctx.px(220),
        padding: `${String(ctx.px(14))}px ${String(ctx.px(16))}px`,
        marginTop: first ? 0 : -ctx.px(1),
        border: hairline(ctx, checked ? ctx.c("primary") : ctx.c("border")),
        borderTopLeftRadius: first ? corner : 0,
        borderTopRightRadius: first ? corner : 0,
        borderBottomLeftRadius: last ? corner : 0,
        borderBottomRightRadius: last ? corner : 0,
        backgroundColor: checked ? ctx.c("muted") : ctx.c("background"),
      }}>
      <div style={{ display: "flex", marginTop: ctx.px(2) }}>
        <RadioDot ctx={ctx} checked={checked} />
      </div>
      <Column gap={ctx.px(4)}>
        <span style={{ ...text(ctx, "sm"), color: ctx.c("foreground") }}>{title}</span>
        <Description ctx={ctx}>{description}</Description>
      </Column>
    </div>
  );
}

/** SelectionItem (`selection-item.tsx`): a connected stack of two radio rows, the second picked. */
export const selectionItem: Specimen = {
  caption: "Connected stack, one checked",
  scale: 2,
  draw: (ctx) => (
    <Column gap={0}>
      <SelectionRow
        ctx={ctx}
        title="Paper invoice"
        description="Sent by post each month."
        checked={false}
        first
        last={false}
      />
      <SelectionRow
        ctx={ctx}
        title="Email invoice"
        description="Sent to your inbox."
        checked
        first={false}
        last
      />
    </Column>
  ),
};

/**
 * Field (`field.tsx`, `field-variants.ts`): an invalid vertical root (`gap-3`, which turns the
 * label `text-error`) with its Input in the invalid face and `Field.Error` under it.
 */
export const field: Specimen = {
  caption: "invalid, with an error",
  scale: 2,
  draw: (ctx) => (
    <Column gap={ctx.px(12)} style={{ width: ctx.px(220) }}>
      <FieldLabel ctx={ctx} color={ctx.c("error")}>
        Email
      </FieldLabel>
      <FieldBox ctx={ctx} width={ctx.px(220)} invalid>
        ada
      </FieldBox>
      <FieldError ctx={ctx}>Enter a work email.</FieldError>
    </Column>
  ),
};

/** TextField (`text-field-variants.ts` over `field-frame.tsx`): label, Input and description, `gap-1`. */
export const textField: Specimen = {
  caption: "With a label and description",
  scale: 2,
  draw: (ctx) => (
    <Column gap={ctx.px(4)} style={{ width: ctx.px(220) }}>
      <FieldLabel ctx={ctx}>Email</FieldLabel>
      <FieldBox ctx={ctx} width={ctx.px(220)}>
        <Placeholder ctx={ctx}>name@example.com</Placeholder>
      </FieldBox>
      <Description ctx={ctx}>We send invoices here.</Description>
    </Column>
  ),
};

/** Textarea (`textarea.tsx`): the field box's `content` model, `min-h-16 py-2`, holding a note. */
export const textarea: Specimen = {
  caption: "With a typed note",
  scale: 2,
  draw: (ctx) => (
    <FieldBox ctx={ctx} width={ctx.px(220)} box="content" style={{ minHeight: ctx.px(84) }}>
      The meter is in the basement. Ring the bell at the side door.
    </FieldBox>
  ),
};

const ACCESS_NOTE = "The meter is in the basement.";
const ACCESS_NOTE_MAX = 200;

/**
 * TextareaField (`textarea-field.tsx`): the label row (`justify-between gap-2`) with the
 * `text-xs` muted counter, `value.length/maxLength` as the component derives it, the Textarea and
 * the description.
 */
export const textareaField: Specimen = {
  caption: "With a character counter",
  scale: 2,
  draw: (ctx) => (
    <Column gap={ctx.px(4)} style={{ width: ctx.px(220) }}>
      <Row gap={ctx.px(8)} style={{ justifyContent: "space-between" }}>
        <FieldLabel ctx={ctx}>Access notes</FieldLabel>
        <span style={{ ...text(ctx, "xs"), color: ctx.c("muted-foreground") }}>
          {`${String(ACCESS_NOTE.length)}/${String(ACCESS_NOTE_MAX)}`}
        </span>
      </Row>
      <FieldBox ctx={ctx} width={ctx.px(220)} box="content">
        {ACCESS_NOTE}
      </FieldBox>
      <Description ctx={ctx}>Shown to the technician.</Description>
    </Column>
  ),
};

/**
 * InputGroup (`input-group.tsx`, `input-group-variants.ts`): an inline-start addon (`pl-2`) with a
 * muted 16px icon, the input re-padded `pl-1.5 pr-1.5`, and an inline-end `InputGroup.Text`.
 */
export const inputGroup: Specimen = {
  caption: "Icon and text addons",
  scale: 2.2,
  draw: (ctx) => (
    <GroupBox ctx={ctx} width={ctx.px(200)}>
      <div style={{ display: "flex", paddingLeft: ctx.px(8), flexShrink: 0 }}>
        {glyph(Gauge)(ctx.px(16), ctx.c("muted-foreground"))}
      </div>
      <GroupInput ctx={ctx} paddingLeft={ctx.px(6)} paddingRight={ctx.px(6)}>
        4 250
      </GroupInput>
      <span style={{ ...text(ctx, "sm", 500), paddingRight: ctx.px(8), color: ctx.c("muted-foreground") }}>
        kWh
      </span>
    </GroupBox>
  ),
};

/**
 * SearchField (`react-aria/search-field`, `styles/search-field.ts`): the RAC field group with
 * the `ml-2` `MagnifyingGlass`, a typed query and the `w-6 mr-1` clear button showing.
 */
export const searchField: Specimen = {
  caption: "With a query and clear button",
  scale: 2.2,
  draw: (ctx) => (
    <GroupBox ctx={ctx} width={ctx.px(200)}>
      <div style={{ display: "flex", marginLeft: ctx.px(8), flexShrink: 0 }}>
        {glyph(MagnifyingGlass)(ctx.px(16), ctx.c("foreground"))}
      </div>
      <GroupInput ctx={ctx}>Storgata 12</GroupInput>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          width: ctx.px(24),
          height: ctx.px(24),
          marginRight: ctx.px(4),
          borderRadius: ctx.radius("md"),
        }}>
        {glyph(X)(ctx.px(16), ctx.c("foreground"))}
      </div>
    </GroupBox>
  ),
};

/** One NumberField stepper: a full-height `--control-h-xs` column, `border-s`, `bg-background`. */
function Stepper({ ctx, icon }: { readonly ctx: SpecimenContext; readonly icon: typeof Plus }): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxSizing: "border-box",
        width: ctx.metric("control-h-xs"),
        height: "100%",
        borderLeft: hairline(ctx, ctx.c("border")),
        backgroundColor: ctx.c("background"),
      }}>
      {glyph(icon)(ctx.px(16), ctx.c("foreground"))}
    </div>
  );
}

/**
 * NumberField (`number-field.tsx`): the group chrome with a tabular value, the muted `text-sm`
 * denomination (`px-2`) and the decrement and increment steppers, under its label.
 */
export const numberField: Specimen = {
  caption: "With a unit and steppers",
  scale: 2.2,
  draw: (ctx) => (
    <Column gap={ctx.px(4)}>
      <FieldLabel ctx={ctx}>Monthly usage</FieldLabel>
      <GroupBox ctx={ctx} width={ctx.px(190)}>
        <GroupInput ctx={ctx}>1 250</GroupInput>
        <span
          style={{
            ...text(ctx, "sm"),
            paddingLeft: ctx.px(8),
            paddingRight: ctx.px(8),
            color: ctx.c("muted-foreground"),
          }}>
          kWh
        </span>
        <Stepper ctx={ctx} icon={Minus} />
        <Stepper ctx={ctx} icon={Plus} />
      </GroupBox>
    </Column>
  ),
};

/** What a phone country row takes. */
type CountryRowDrawing = {
  readonly ctx: SpecimenContext;
  readonly country: keyof typeof NORDIC_FLAGS;
  readonly dialCode: string;
  readonly name: string;
  readonly selected?: boolean;
};

/** A country row in the phone picker: flag, tabular dial code and name, `text-sm leading-tight`. */
function CountryRow({ ctx, country, dialCode, name, selected = false }: CountryRowDrawing): ReactElement {
  const leading = { lineHeight: `${String(ctx.px(14 * 1.25))}px` };
  const content = (
    <Row gap={ctx.px(8)}>
      <Flag ctx={ctx} country={country} />
      <span style={leading}>{dialCode}</span>
      <span style={leading}>{name}</span>
    </Row>
  );
  return selected ? (
    <MenuRow ctx={ctx} highlighted end={glyph(Check)}>
      {content}
    </MenuRow>
  ) : (
    <MenuRow ctx={ctx}>{content}</MenuRow>
  );
}

/**
 * PhoneNumberField (`phone-number-field.tsx`): the InputGroup with the flag and `text-xs`
 * dial-code trigger, and the open country Combobox under it, its `h-sm` search group tinted
 * `bg-input/30` above the list.
 */
export const phoneNumberField: Specimen = {
  caption: "Country picker open",
  scale: 2,
  draw: (ctx) => (
    <Column gap={ctx.px(6)}>
      <GroupBox ctx={ctx} width={ctx.px(220)}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            gap: ctx.px(4),
            marginLeft: ctx.px(8),
            paddingLeft: ctx.px(4),
            paddingRight: ctx.px(4),
            minHeight: ctx.px(24),
            borderRadius: ctx.radius("lg"),
          }}>
          <Flag ctx={ctx} country="NO" />
          <span style={{ ...text(ctx, "xs", 500), minWidth: ctx.px(24) }}>+47</span>
        </div>
        <GroupInput ctx={ctx} paddingLeft={ctx.px(6)}>
          412 34 567
        </GroupInput>
      </GroupBox>
      <Popup ctx={ctx} width={ctx.px(220)} padding={0} style={{ paddingTop: ctx.px(6) }}>
        <div style={{ display: "flex", paddingLeft: ctx.px(4), paddingRight: ctx.px(4) }}>
          <GroupBox
            ctx={ctx}
            width={ctx.px(212)}
            style={{
              height: ctx.metric("control-h-sm"),
              borderColor: ctx.c("input", 0.3),
              backgroundColor: ctx.c("input", 0.3),
              boxShadow: "none",
            }}>
            <div style={{ display: "flex", paddingLeft: ctx.px(8), flexShrink: 0 }}>
              {glyph(MagnifyingGlass)(ctx.px(16), ctx.c("muted-foreground"))}
            </div>
            <GroupInput ctx={ctx} paddingLeft={ctx.px(6)}>
              {null}
            </GroupInput>
          </GroupBox>
        </div>
        <Column gap={0} style={{ padding: ctx.px(4) }}>
          <CountryRow ctx={ctx} country="NO" dialCode="+47" name="Norway" selected />
          <CountryRow ctx={ctx} country="SE" dialCode="+46" name="Sweden" />
        </Column>
      </Popup>
    </Column>
  ),
};

/**
 * Combobox (`combobox.tsx`): the focused InputGroup with a typed query and the ghost `icon-sm`
 * caret, over the open list (`p-1`, menu rows) filtered to it, the first match highlighted.
 */
export const combobox: Specimen = {
  caption: "Open, filtered by a typed query",
  scale: 2,
  draw: (ctx) => (
    <Column gap={ctx.px(6)}>
      <GroupBox ctx={ctx} width={ctx.px(220)} focused>
        <GroupInput ctx={ctx} paddingRight={ctx.px(6)}>
          <span>Ber</span>
          <Caret ctx={ctx} />
        </GroupInput>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            width: ctx.px(32),
            height: ctx.px(32),
            marginRight: ctx.px(4),
          }}>
          {glyph(CaretDown)(ctx.px(16), ctx.c("muted-foreground"))}
        </div>
      </GroupBox>
      <Popup ctx={ctx} width={ctx.px(220)}>
        <MenuRow ctx={ctx} highlighted>
          Bergen
        </MenuRow>
        <MenuRow ctx={ctx}>Berkåk</MenuRow>
        <MenuRow ctx={ctx}>Berlevåg</MenuRow>
      </Popup>
    </Column>
  ),
};

/**
 * Meter (`meter-variants.ts`): the default mode at a low level, so the `success` tone paints the
 * `h-1.5` fill and the `text-sm` value beside the `font-medium` label.
 */
export const meter: Specimen = {
  caption: "default mode, low level",
  scale: 2.4,
  draw: (ctx) => (
    <Column gap={ctx.px(4)} style={{ width: ctx.px(180) }}>
      <Row gap={ctx.px(8)} style={{ justifyContent: "space-between" }}>
        <span style={{ ...text(ctx, "sm", 500), color: ctx.c("foreground") }}>Monthly budget</span>
        <span style={{ ...text(ctx, "sm"), color: ctx.c("success") }}>62%</span>
      </Row>
      <div
        style={{
          display: "flex",
          width: "100%",
          height: ctx.px(6),
          borderRadius: 9999,
          backgroundColor: ctx.c("muted"),
        }}>
        <div
          style={{ width: "62%", height: "100%", borderRadius: 9999, backgroundColor: ctx.c("success") }}
        />
      </div>
    </Column>
  ),
};
