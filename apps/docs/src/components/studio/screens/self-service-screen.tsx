"use client";

import { useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { Heading } from "@elmeragroup/fuse/heading";
import { Meter } from "@elmeragroup/fuse/meter";
import { RadioItem, RadioItemGroup } from "@elmeragroup/fuse/radio-group";
import { Table } from "@elmeragroup/fuse/table";
import { Text } from "@elmeragroup/fuse/text";
import { Toast } from "@elmeragroup/fuse/toast";

const selfServiceScreen = tv({
  slots: {
    root: "flex flex-col gap-6 p-8",
    head: "flex items-start justify-between gap-4",
    titles: "flex min-w-0 flex-col gap-1",
    grid: "grid grid-cols-2 gap-6",
    usage: "flex flex-col gap-4",
    amount: "text-right tabular-nums",
    plans: "flex flex-col gap-4",
    actions: "gap-2",
  },
});

const styles = selfServiceScreen();

const INVOICES = [
  { id: "2026-09", period: "September", amount: "NOK 1 240", status: "Due" },
  { id: "2026-08", period: "August", amount: "NOK 1 085", status: "Paid" },
  { id: "2026-07", period: "July", amount: "NOK 960", status: "Paid" },
  { id: "2026-06", period: "June", amount: "NOK 905", status: "Paid" },
  { id: "2026-05", period: "May", amount: "NOK 1 130", status: "Paid" },
  { id: "2026-04", period: "April", amount: "NOK 1 410", status: "Paid" },
] as const;

/** The invoices the card lists until See all. */
const RECENT = 3;

const PLANS = [
  { value: "fixed", title: "Fixed price", description: "One price per kWh, locked for 12 months." },
  { value: "spot", title: "Spot price", description: "Follows the hourly market, with no lock-in." },
  { value: "variable", title: "Variable price", description: "A monthly average with a set markup." },
] as const;

/**
 * The account's cards. "Change plan" puts the picked plan on the account, which moves its Current
 * mark, and says so in a toast; "See all" lists every invoice.
 */
function Account(): ReactElement {
  const toasts = Toast.useToastManager();
  const [current, setCurrent] = useState<string>("spot");
  const [plan, setPlan] = useState<string>("spot");
  const [allInvoices, setAllInvoices] = useState(false);
  const titleOf = (value: string) => PLANS.find((option) => option.value === value)?.title ?? value;

  const changePlan = () => {
    if (plan === current) {
      toasts.add({ title: `${titleOf(plan)} is already your plan.` });
      return;
    }
    setCurrent(plan);
    toasts.add({ type: "success", title: `Your plan changes to ${titleOf(plan)} on 1 November.` });
  };

  return (
    <>
      <div className={styles.head()}>
        <div className={styles.titles()}>
          <Heading level={2} size="xl">
            Your account
          </Heading>
          <Text variant="muted" size="sm">
            Customer number 2048 3311 · Storgata 12, 0155 Oslo
          </Text>
        </div>
        <Badge variant="success">Active</Badge>
      </div>
      <div className={styles.grid()}>
        <Card.Root>
          <Card.Header>
            <Card.Title>Usage this month</Card.Title>
            <Card.Description>Read from your meter every hour.</Card.Description>
          </Card.Header>
          <Card.Content className={styles.usage()}>
            <Meter label="Used so far" value={312} maxValue={450} valueLabel="312 of 450 kWh" />
            <Text size="sm" variant="muted">
              You are on track to use less than last September.
            </Text>
          </Card.Content>
        </Card.Root>
        <Card.Root>
          <Card.Header>
            <Card.Title>Invoices</Card.Title>
            <Card.Action>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAllInvoices(!allInvoices);
                }}>
                {allInvoices ? "Show fewer" : "See all"}
              </Button>
            </Card.Action>
          </Card.Header>
          <Card.Content>
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Period</Table.Head>
                  <Table.Head>Status</Table.Head>
                  <Table.Head className={styles.amount()}>Amount</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {(allInvoices ? INVOICES : INVOICES.slice(0, RECENT)).map((invoice) => (
                  <Table.Row key={invoice.id}>
                    <Table.Cell>{invoice.period}</Table.Cell>
                    <Table.Cell>
                      <Badge variant={invoice.status === "Due" ? "warning" : "secondary"}>
                        {invoice.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className={styles.amount()}>{invoice.amount}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card.Content>
        </Card.Root>
      </div>
      <Card.Root>
        <Card.Header>
          <Card.Title>Your plan</Card.Title>
          <Card.Description>Switch whenever you like. The new price starts on the first.</Card.Description>
        </Card.Header>
        <Card.Content className={styles.plans()}>
          <RadioItemGroup label="Price plan" value={plan} onChange={setPlan}>
            {PLANS.map((option) => (
              <RadioItem key={option.value} value={option.value}>
                <RadioItem.Content>
                  <RadioItem.Title>{option.title}</RadioItem.Title>
                  <RadioItem.Description>{option.description}</RadioItem.Description>
                </RadioItem.Content>
                {option.value === current ? <RadioItem.Actions>Current</RadioItem.Actions> : null}
              </RadioItem>
            ))}
          </RadioItemGroup>
        </Card.Content>
        <Card.Footer className={styles.actions()}>
          <Button onClick={changePlan}>Change plan</Button>
        </Card.Footer>
      </Card.Root>
    </>
  );
}

/**
 * A customer's account overview, in the external look: this month's usage, the latest invoices,
 * and a plan picker with its call to action.
 */
export function SelfServiceScreen(): ReactElement {
  return (
    <div className={styles.root()}>
      <Toast.Provider>
        <Account />
        <Toast.Viewport />
      </Toast.Provider>
    </div>
  );
}
