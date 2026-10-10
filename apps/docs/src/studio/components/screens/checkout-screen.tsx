"use client";

import { Fragment, useState } from "react";
import type { FocusEvent, FormEvent, KeyboardEvent, ReactElement } from "react";

import { CalendarDate } from "@internationalized/date";
import { tv } from "tailwind-variants";

import { Alert } from "@elmeragroup/fuse/alert";
import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { DescriptionList } from "@elmeragroup/fuse/description-list";
import { Field } from "@elmeragroup/fuse/field";
import { Form } from "@elmeragroup/fuse/form";
import { Heading } from "@elmeragroup/fuse/heading";
import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";
import { DateField } from "@elmeragroup/fuse/react-aria/date-field";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";
import { SelectionItem } from "@elmeragroup/fuse/selection-item";
import { Separator } from "@elmeragroup/fuse/separator";
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

const earliestStart = new CalendarDate(2026, 11, 1);

const FORM_ID = "checkout-order";

const startFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

/** A confirmed order, as the success message reads it back. */
type Order = { readonly customer: string; readonly email: string; readonly summary: string };

/**
 * Whether every segment of the DateField that `event` came from is filled. React Aria keeps its
 * last complete value while a segment is empty, and reports no change when a segment is filled
 * back to that value, so the segments themselves tell.
 */
function segmentsFilled(event: KeyboardEvent | FocusEvent): boolean {
  const target = event.target;
  // DOM audit: React Aria marks an empty segment, and no prop or callback reports it.
  const group = target instanceof Element ? target.closest('[role="group"]') : null;
  return (group?.querySelector('[role="spinbutton"][data-placeholder]') ?? null) === null;
}

/** Formats whole kroner as the summary shows them. */
function kroner(amount: number): string {
  return amount === 0 ? "Included" : `NOK ${String(amount)}`;
}

/**
 * A sign-up checkout in the external look: contact fields with a live email error, the phone and
 * start date, optional extras, and an order summary that follows the picks. "Confirm order"
 * submits the Form, which checks every field and the start date first; a valid order is
 * confirmed in place.
 */
export function CheckoutScreen(): ReactElement {
  const [email, setEmail] = useState("nora.haugen@example");
  const [extras, setExtras] = useState<ReadonlySet<string>>(new Set(["app"]));
  const [start, setStart] = useState<CalendarDate | null>(earliestStart);
  const [startFilled, setStartFilled] = useState(true);
  const emailInvalid = !EMAIL.test(email);
  // The interim React Aria DateField does not register with the Form, so the screen gates on it.
  const startError =
    start === null || !startFilled
      ? "Enter a complete start date."
      : start.compare(earliestStart) < 0
        ? "Choose a start date from 1 November 2026 on."
        : undefined;
  const trackFilled = (event: KeyboardEvent | FocusEvent) => {
    setStartFilled(segmentsFilled(event));
  };
  const picked = EXTRAS.filter((extra) => extras.has(extra.id));
  const total = BASE_PRICE + picked.reduce((sum, extra) => sum + extra.price, 0);
  const [order, setOrder] = useState<Order | undefined>(undefined);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (start === null || startError !== undefined) {
      setOrder(undefined);
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
      summary: `${items}: NOK ${String(total)} a month from ${startFormat.format(start.toDate("UTC"))}.`,
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
        <Form id={FORM_ID} className={styles.form()} onSubmit={submit}>
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
            errorMessage="Enter an email address like name@example.com."
            autoComplete="email"
          />
          <PhoneNumberField label="Mobile" name="mobile" defaultValue="+4741234567" />
          <UiProviders locale="en-US" navigate={() => undefined}>
            <DateField<CalendarDate>
              label="Start date"
              name="start"
              description="The first of a month, from November on."
              value={start}
              minValue={earliestStart}
              isInvalid={startError !== undefined}
              errorMessage={startError}
              onChange={setStart}
              onKeyUp={trackFilled}
              onBlur={trackFilled}
            />
          </UiProviders>
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
                <DescriptionList.Term>Spot price</DescriptionList.Term>
                <DescriptionList.Details className={styles.value()}>
                  {kroner(BASE_PRICE)}
                </DescriptionList.Details>
                {picked.map((extra) => (
                  <Fragment key={extra.id}>
                    <DescriptionList.Term>{extra.title}</DescriptionList.Term>
                    <DescriptionList.Details className={styles.value()}>
                      {kroner(extra.price)}
                    </DescriptionList.Details>
                  </Fragment>
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
