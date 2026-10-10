"use client";

import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { Accordion } from "@elmeragroup/fuse/accordion";
import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { Frame } from "@elmeragroup/fuse/frame";
import { Heading } from "@elmeragroup/fuse/heading";
import { InputGroup } from "@elmeragroup/fuse/input-group";
import { Item } from "@elmeragroup/fuse/item";
import { Tabs } from "@elmeragroup/fuse/tabs";
import { Text } from "@elmeragroup/fuse/text";

const shellsBoard = tv({
  slots: {
    root: "flex flex-col gap-8 p-8",
    head: "flex flex-col gap-1",
    shell: "flex flex-col gap-3",
    // The row's surface, an inner part of its section. Fuse has no plain surface part, and an
    // Item cannot be the inner part itself: it is a shell, so its own `rounded-inner` would read
    // the corner it publishes for its children rather than its section's.
    row: "rounded-inner bg-muted",
  },
});

const styles = shellsBoard();

const PLANS = [
  { name: "Spot", detail: "Hourly price, no lock-in" },
  { name: "Fixed", detail: "One price for twelve months" },
  { name: "Green", detail: "Certified renewable supply" },
] as const;

const USAGE = ["March · 1 240 kWh", "April · 980 kWh"] as const;

/** One shell on the board, named so the X-ray's readout and Tab order read alike. */
function Shell({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section aria-label={title} className={styles.shell()}>
      <Heading level={3} size="sm">
        {title}
      </Heading>
      {children}
    </section>
  );
}

/**
 * Real Fuse shells that publish `--inner-corner`: a Card with Item rows, Tabs, an InputGroup
 * with an addon Button, a card Accordion, a Frame with panels and a DropdownMenu, whose rows
 * the X-ray picks up once it is open. The menu opens from its trigger, since an open menu
 * would take focus as the page loads.
 */
export function ShellsBoard(): ReactElement {
  return (
    <div className={styles.root()}>
      <div className={styles.head()}>
        <Heading level={2} size="lg">
          Shells in Fuse
        </Heading>
        <Text variant="muted" size="sm">
          Each shell publishes its corner less its inset, and the parts inside round with it. Turn on the
          corner X-ray to see the numbers.
        </Text>
      </div>
      <Shell title="Card with Item rows">
        <Card.Root>
          <Card.Header>
            <Card.Title>Plans</Card.Title>
            <Card.Description>Pick the one that suits your home.</Card.Description>
          </Card.Header>
          <Card.Content>
            <Item.Group>
              {PLANS.map((plan) => (
                <div key={plan.name} className={styles.row()} data-slot="shape-row">
                  <Item.Root>
                    <Item.Content>
                      <Item.Title>{plan.name}</Item.Title>
                      <Item.Description>{plan.detail}</Item.Description>
                    </Item.Content>
                  </Item.Root>
                </div>
              ))}
            </Item.Group>
          </Card.Content>
        </Card.Root>
      </Shell>
      <Shell title="Tabs">
        <Tabs.Root defaultValue="day">
          <Tabs.List>
            <Tabs.Trigger value="day">Day</Tabs.Trigger>
            <Tabs.Trigger value="week">Week</Tabs.Trigger>
            <Tabs.Trigger value="month">Month</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </Shell>
      <Shell title="InputGroup with an addon Button">
        <InputGroup.Root>
          <InputGroup.Input aria-label="Meter number" defaultValue="707057500012345678" />
          <InputGroup.Addon align="inline-end">
            <InputGroup.Button>Copy</InputGroup.Button>
          </InputGroup.Addon>
        </InputGroup.Root>
      </Shell>
      <Shell title="Accordion">
        <Accordion.Root variant="card" defaultValue={["delivery"]}>
          <Accordion.Item value="delivery">
            <Accordion.Header>
              <Accordion.Trigger>Delivery</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content>Your supply starts on the first of next month.</Accordion.Content>
          </Accordion.Item>
          <Accordion.Item value="billing">
            <Accordion.Header>
              <Accordion.Trigger>Billing</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content>Invoices are issued at the start of each month.</Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      </Shell>
      <Shell title="Frame with panels">
        <Frame.Root>
          {USAGE.map((month) => (
            <Frame.Panel key={month}>
              <div className={styles.row()} data-slot="shape-row">
                <Item.Root size="sm">
                  <Item.Title>{month}</Item.Title>
                </Item.Root>
              </div>
            </Frame.Panel>
          ))}
        </Frame.Root>
      </Shell>
      <Shell title="Menu">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger render={<Button variant="outline" />}>Open the menu</DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item>Profile</DropdownMenu.Item>
            <DropdownMenu.Item>Billing</DropdownMenu.Item>
            <DropdownMenu.Item>Log out</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Shell>
    </div>
  );
}
