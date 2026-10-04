/**
 * Specimens for the core controls: Button, Badge, Switch, Input and Select.
 */

import { CaretDown, Check } from "@elmeragroup/fuse/icons";

import { glyph } from "../og-icons";
import {
  Badge,
  Button,
  Column,
  FieldBox,
  hairline,
  MenuRow,
  Placeholder,
  Popup,
  Row,
  shadow,
} from "../specimen-kit";
import type { Specimen } from "./specimen";

/** Button: the default (primary) variant at the default size, beside its outline sibling. */
export const button: Specimen = {
  caption: 'variant="default" and "outline"',
  scale: 2.5,
  draw: (ctx) => (
    <Row gap={ctx.px(12)}>
      <Button ctx={ctx}>Save changes</Button>
      <Button ctx={ctx} variant="outline">
        Cancel
      </Button>
    </Row>
  ),
};

/** Badge: the default, secondary and outline variants side by side. */
export const badge: Specimen = {
  caption: 'variant="default", "secondary", "outline"',
  scale: 2,
  draw: (ctx) => (
    <Row gap={ctx.px(8)}>
      <Badge ctx={ctx}>Active</Badge>
      <Badge ctx={ctx} variant="secondary">
        Fixed price
      </Badge>
      <Badge ctx={ctx} variant="outline">
        Company
      </Badge>
    </Row>
  ),
};

/**
 * Switch (`switch.tsx`): a 32 × 18.4px pill, `--primary` when checked, with a 16px
 * `--background` thumb at the end. Pixel-fixed at both densities, so it draws at 5×.
 */
export const switchSpecimen: Specimen = {
  caption: "checked",
  scale: 5,
  draw: (ctx) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        boxSizing: "border-box",
        width: ctx.px(32),
        height: ctx.px(18.4),
        borderRadius: 9999,
        border: hairline(ctx, "transparent"),
        backgroundColor: ctx.c("primary"),
        boxShadow: shadow(ctx, "xs"),
      }}>
      <div
        style={{
          width: ctx.px(16),
          height: ctx.px(16),
          borderRadius: 9999,
          backgroundColor: ctx.c("background"),
        }}
      />
    </div>
  ),
};

/** Input: the field box empty with its placeholder, and focused with a typed value. */
export const input: Specimen = {
  caption: "Empty, and focused with a value",
  scale: 2.5,
  draw: (ctx) => (
    <Column gap={ctx.px(10)}>
      <FieldBox ctx={ctx} width={ctx.px(200)}>
        <Placeholder ctx={ctx}>name@example.com</Placeholder>
      </FieldBox>
      <FieldBox ctx={ctx} width={ctx.px(200)} focused>
        Ola Nordmann
      </FieldBox>
    </Column>
  ),
};

/** Select: a closed trigger, and under it the open list with the picked item checked. */
export const select: Specimen = {
  caption: "Open, with the selected item",
  scale: 2,
  draw: (ctx) => (
    <Column gap={ctx.px(6)}>
      <FieldBox ctx={ctx} width={ctx.px(220)} end={glyph(CaretDown)}>
        Fixed price
      </FieldBox>
      <Popup ctx={ctx} width={ctx.px(220)} corner="lg">
        <MenuRow ctx={ctx}>Spot price</MenuRow>
        <MenuRow ctx={ctx} highlighted end={glyph(Check)}>
          Fixed price
        </MenuRow>
        <MenuRow ctx={ctx}>Variable price</MenuRow>
      </Popup>
    </Column>
  ),
};
