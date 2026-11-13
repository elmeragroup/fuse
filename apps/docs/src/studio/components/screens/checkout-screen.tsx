"use client";

import { useState } from "react";
import type { FormEvent, ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Alert } from "@elmeragroup/fuse/alert";
import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { DateField } from "@elmeragroup/fuse/date-field";
import { DescriptionList } from "@elmeragroup/fuse/description-list";
import { Field } from "@elmeragroup/fuse/field";
import { Form } from "@elmeragroup/fuse/form";
import { Heading } from "@elmeragroup/fuse/heading";
import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";
import { SelectionItem } from "@elmeragroup/fuse/selection-item";
import { Separator } from "@elmeragroup/fuse/separator";
// The screens' only Temporal user installs the polyfill where the engine lacks Temporal.
import "@elmeragroup/fuse/temporal-polyfill";
import { Text } from "@elmeragroup/fuse/text";
import { TextField } from "@elmeragroup/fuse/text-field";

const checkoutScreen = tv({
  slots: {
    root: "flex flex-col gap-6 p-8",
    titles: "flex flex-col gap-1",
    layout: "grid grid-cols-[minmax(0,1fr)_16rem] items-start gap-6",
    form: "flex flex-col gap-4",
    pair: "grid grid-cols-2 gap-4",
    extras: "flex flex-col gap-2",
    value: "tabular-nums",
    footer: "flex-col items-stretch gap-3",
    total: "flex justify-between gap-4",
  },
});

const styles = checkoutScreen();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

const EXTRAS = [
  { id: "app", title: "Usage alerts", description: "A message when this week runs above normal.", price: 0 },
  { id: "cover", title: "Device cover", description: "Repairs for one smart meter or charger.", price: 49 },
] as const;

const BASE_PRICE = 39;

/** The first start date the screen takes, built in render so the host's Temporal is installed. */
const EARLIEST_START = "2026-11-01";

const FORM_ID = "checkout-order";

/** A confirmed order, as the success message reads it back. */
type Order = { readonly customer: string; readonly email: string; readonly summary: string };

/** Formats whole kroner as the summary shows them. */
function kroner(amount: number): string {
  return amount === 0 ? "Included" : `NOK ${String(amount)}`;
}

/**
 * A sign-up checkout in the branded look: contact fields with a live email error, the phone and
 * start date, optional extras, and an order summary that follows the picks. "Confirm order"
 * submits the Form, which checks every field first; a valid order is confirmed in place.
 */
export function CheckoutScreen(): ReactElement {
  const [email, setEmail] = useState("nora.haugen@example");
  const [extras, setExtras] = useState<ReadonlySet<string>>(new Set(["app"]));
  const earliestStart = Temporal.PlainDate.from(EARLIEST_START);
  const [start, setStart] = useState<Temporal.PlainDate | null>(earliestStart);
  const emailInvalid = !EMAIL.test(email);
  const picked = EXTRAS.filter((extra) => extras.has(extra.id));
  const total = BASE_PRICE + picked.reduce((sum, extra) => sum + extra.price, 0);
  const [order, setOrder] = useState<Order | undefined>(undefined);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The Form calls this only once the DateField's own required, complete and minimum checks pass.
    if (start === null) {
      return;
    }
    const data = new FormData(event.currentTarget);
    const read = (name: string) => {
      const value = data.get(name);
      return value instanceof File || value === null ? "" : value;
    };
    const items = ["Spot price", ...picked.map((extra) => extra.title)].join(", ");
    setOrder({
      customer: `${read("firstName")} ${read("lastName")}`,
      email: read("email"),
      summary: `${items}: NOK ${String(total)} a month from ${start.toLocaleString("en-GB", { dateStyle: "long" })}.`,
    });
  };

  return (
    <div className={styles.root()}>
      <div className={styles.titles()}>
        <Heading level={2} size="xl">
          Complete your order
        </Heading>
        <Text variant="muted" size="sm">
          Spot price, monthly billing. You can cancel within 14 days.
        </Text>
      </div>
      {order === undefined ? null : (
        <Alert.Root variant="success">
          <Alert.Title>Order confirmed</Alert.Title>
          <Alert.Description>
            {`Thank you, ${order.customer}. ${order.summary} The receipt goes to ${order.email}.`}
          </Alert.Description>
        </Alert.Root>
      )}
      <div className={styles.layout()}>
        <Form
          id={FORM_ID}
          className={styles.form()}
          // A refused submit never reaches `onSubmit`, so every attempt drops the last confirmation first.
          onSubmitCapture={() => {
            setOrder(undefined);
          }}
          onSubmit={submit}>
          <div className={styles.pair()}>
            <TextField
              label="First name"
              name="firstName"
              defaultValue="Nora"
              isRequired
              autoComplete="given-name"
            />
            <TextField
              label="Last name"
              name="lastName"
              defaultValue="Haugen"
              isRequired
              autoComplete="family-name"
            />
          </div>
          <TextField
            label="Email"
            name="email"
            isRequired
            type="email"
            value={email}
            onChange={setEmail}
            isInvalid={emailInvalid}
            errorMessage={emailInvalid ? "Enter an email address like name@example.com." : undefined}
            autoComplete="email"
          />
          <PhoneNumberField label="Mobile" name="mobile" defaultValue="+4741234567" />
          <DateField
            label="Start date"
            name="start"
            description="The first of a month, from November on."
            isRequired
            value={start}
            minValue={earliestStart}
            onChange={setStart}
          />
          <Field.Root>
            <Field.Label>Extras</Field.Label>
            <div className={styles.extras()}>
              {EXTRAS.map((extra) => (
                <SelectionItem.Shell
                  key={extra.id}
                  dataSlot="checkbox-item"
                  control={
                    <Checkbox
                      aria-label={extra.title}
                      name="extras"
                      value={extra.id}
                      checked={extras.has(extra.id)}
                      onCheckedChange={(checked) => {
                        const next = new Set(extras);
                        if (checked) {
                          next.add(extra.id);
                        } else {
                          next.delete(extra.id);
                        }
                        setExtras(next);
                      }}
                    />
                  }>
                  <SelectionItem.Content>
                    <SelectionItem.Title>{extra.title}</SelectionItem.Title>
                    <SelectionItem.Description>{extra.description}</SelectionItem.Description>
                  </SelectionItem.Content>
                  <SelectionItem.Actions>{kroner(extra.price)}</SelectionItem.Actions>
                </SelectionItem.Shell>
              ))}
            </div>
          </Field.Root>
        </Form>
        <Card.Root>
          <Card.Header>
            <Card.Title>Summary</Card.Title>
            <Card.Description>Per month, VAT included.</Card.Description>
          </Card.Header>
          <Card.Content>
            <DescriptionList.Root>
              <DescriptionList.Content>
                <DescriptionList.Item>
                  <DescriptionList.Term>Spot price</DescriptionList.Term>
                  <DescriptionList.Details className={styles.value()}>
                    {kroner(BASE_PRICE)}
                  </DescriptionList.Details>
                </DescriptionList.Item>
                {picked.map((extra) => (
                  <DescriptionList.Item key={extra.id}>
                    <DescriptionList.Term>{extra.title}</DescriptionList.Term>
                    <DescriptionList.Details className={styles.value()}>
                      {kroner(extra.price)}
                    </DescriptionList.Details>
                  </DescriptionList.Item>
                ))}
              </DescriptionList.Content>
            </DescriptionList.Root>
          </Card.Content>
          <Separator />
          <Card.Footer className={styles.footer()}>
            <Text weight="medium" className={styles.total()}>
              <span>Total</span>
              <span>{`NOK ${String(total)}`}</span>
            </Text>
            <Button type="submit" form={FORM_ID}>
              Confirm order
            </Button>
          </Card.Footer>
        </Card.Root>
      </div>
    </div>
  );
}
