import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";
import { Heading } from "@elmeragroup/fuse/heading";
import { Select } from "@elmeragroup/fuse/select";
import { TextField } from "@elmeragroup/fuse/text-field";

import { TypeRow } from "./type-row";

const typePairsBoard = tv({
  slots: {
    root: "flex flex-col gap-6 p-8",
    section: "flex flex-col",
  },
});

const styles = typePairsBoard();

const PLANS = { spot: "Spot price", fixed: "Fixed price" } as const;

/**
 * The density's two type pairs in real fields and buttons: `--control-text` over
 * `--control-leading` in a control's value, and `--label-text` over `--label-leading` in its
 * label. The artboard's density sets them, so the dense and comfortable twins differ, and each
 * row reports the pair the browser computed.
 */
export function TypePairsBoard(): ReactElement {
  return (
    <div className={styles.root()}>
      <section className={styles.section()} aria-label="Control type">
        <Heading level={2} size="lg">
          Control type
        </Heading>
        <TypeRow name="Field value" tokens="--control-text / --control-leading" target="[data-slot=input]">
          <TextField aria-label="Meter number" defaultValue="707057500012345678" />
        </TypeRow>
        <TypeRow
          name="Select value"
          tokens="--control-text / --control-leading"
          target="[data-slot=select-value]">
          <Select.Root items={PLANS} defaultValue="spot">
            <Select.Trigger aria-label="Plan">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {Object.entries(PLANS).map(([value, label]) => (
                <Select.Item key={value} value={value}>
                  {label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </TypeRow>
        <TypeRow name="Button" tokens="--control-text / --control-leading" target="[data-slot=button]">
          <Button>Save changes</Button>
        </TypeRow>
      </section>
      <section className={styles.section()} aria-label="Label type">
        <Heading level={2} size="lg">
          Label type
        </Heading>
        <TypeRow name="Field label" tokens="--label-text / --label-leading" target="[data-slot=field-label]">
          <TextField label="Email" defaultValue="alex@example.com" />
        </TypeRow>
        <TypeRow
          name="Checkbox label"
          tokens="--label-text / --label-leading"
          target="[data-slot=field-label]">
          <Field.Root orientation="horizontal">
            <Checkbox defaultChecked />
            <Field.Label>Paperless invoices</Field.Label>
          </Field.Root>
        </TypeRow>
      </section>
    </div>
  );
}
