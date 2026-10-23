import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { CheckboxItem, CheckboxItemGroup } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";
import { Heading } from "@elmeragroup/fuse/heading";
import { Text } from "@elmeragroup/fuse/text";

import { TypeRow } from "./type-row";

const specimenBoard = tv({
  slots: {
    root: "flex flex-col p-8",
  },
});

const styles = specimenBoard();

// Each heading renders by level alone, so its row shows the theme's heading scale.
const HEADINGS = [
  {
    level: 1,
    tokens: "--font-heading, --heading-1-*",
    text: "Power for the whole home",
  },
  {
    level: 2,
    tokens: "--font-heading, --heading-2-*",
    text: "Your agreement",
  },
  {
    level: 3,
    tokens: "--font-heading, --heading-3-*",
    text: "Usage this month",
  },
  { level: 4, tokens: "--font-heading", text: "Invoices" },
] as const;

// Each named style renders on an h2, so its row shows the theme's style roles at any level.
const STYLES = [
  { typography: "large", name: "Heading large", text: "Welcome home" },
  { typography: "medium", name: "Heading medium", text: "Choose your plan" },
  { typography: "small", name: "Heading small", text: "Your details" },
  { typography: "xsmall", name: "Heading xsmall", text: "Delivery address" },
] as const;

/**
 * The theme's two font stacks at work: headings H1 to H4 in `--font-heading` at the theme's
 * heading scale, where H1 to H3 read `--heading-<level>-size`, `--heading-<level>-leading` and
 * `--heading-<level>-weight` and H4 keeps Heading's default, then the four named heading styles,
 * each reading `--heading-<style>-*`, then body, label and small text in `--font-sans`, and a
 * selection row's title at `--selection-title-weight`. The heading rows report their computed
 * weight too, and the H1 and H2 rows follow the small and xsmall style knobs through their
 * pointers.
 * Each row reports the type the browser computed. The selection sample's second row is
 * disabled, so the `--selection-disabled-background`, `--selection-disabled-hatch` and
 * `--selection-disabled-foreground` knobs have a row to paint in either scheme. The heading rows
 * name their roles as `--heading-<level>-*` or `--heading-<style>-*`, the size, leading and weight
 * trio, so each label fits two lines of the row's 9rem column.
 */
export function SpecimenBoard(): ReactElement {
  return (
    <div className={styles.root()}>
      {HEADINGS.map(({ level, tokens, text }) => (
        <TypeRow key={level} name={`H${String(level)}`} tokens={tokens} target="h1, h2, h3, h4" weight>
          <Heading level={level} data-specimen={`h${String(level)}`}>
            {text}
          </Heading>
        </TypeRow>
      ))}
      {STYLES.map(({ typography, name, text }) => (
        <TypeRow
          key={typography}
          name={name}
          tokens={`--font-heading, --heading-${typography}-*`}
          target="h2"
          weight>
          <Heading typography={typography} data-specimen={typography}>
            {text}
          </Heading>
        </TypeRow>
      ))}
      <TypeRow name="Body" tokens="--font-sans" target="p">
        <Text>Your next invoice is due on the 15th. Pay it from the app or set up direct debit.</Text>
      </TypeRow>
      <TypeRow name="Label" tokens="--label-text" target="[data-slot=field-label]">
        <Field.Root>
          <Field.Label>Meter number</Field.Label>
        </Field.Root>
      </TypeRow>
      <TypeRow name="Small" tokens="--font-sans" target="p">
        <Text size="sm" variant="muted">
          Prices include VAT. Updated hourly.
        </Text>
      </TypeRow>
      <TypeRow
        name="Selection title"
        tokens="--selection-title-weight"
        target="[data-slot=selection-item-title]"
        weight>
        <CheckboxItemGroup label="Price plan" defaultValue={["fixed"]}>
          <CheckboxItem value="fixed">
            <CheckboxItem.Content>
              <CheckboxItem.Title>Fixed price</CheckboxItem.Title>
              <CheckboxItem.Description>Locked for 12 months.</CheckboxItem.Description>
            </CheckboxItem.Content>
          </CheckboxItem>
          <CheckboxItem value="spot" isDisabled>
            <CheckboxItem.Content>
              <CheckboxItem.Title>Spot price</CheckboxItem.Title>
              <CheckboxItem.Description>Not offered at your address.</CheckboxItem.Description>
            </CheckboxItem.Content>
          </CheckboxItem>
        </CheckboxItemGroup>
      </TypeRow>
    </div>
  );
}
