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

const HEADINGS = [
  { level: 1, size: "4xl", text: "Power for the whole home" },
  { level: 2, size: "3xl", text: "Your agreement" },
  { level: 3, size: "2xl", text: "Usage this month" },
  { level: 4, size: "xl", text: "Invoices" },
] as const;

/**
 * The theme's two font stacks at work: headings H1 to H4 in `--font-heading`, then body, label
 * and small text in `--font-sans`, and a selection row's title at `--selection-title-weight`.
 * Each row reports the type the browser computed.
 */
export function SpecimenBoard(): ReactElement {
  return (
    <div className={styles.root()}>
      {HEADINGS.map(({ level, size, text }) => (
        <TypeRow key={level} name={`H${String(level)}`} tokens="--font-heading" target="h1, h2, h3, h4">
          <Heading level={level} size={size} data-specimen={`h${String(level)}`}>
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
        </CheckboxItemGroup>
      </TypeRow>
    </div>
  );
}
