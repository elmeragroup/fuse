"use client";

import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Accordion } from "@elmeragroup/fuse/accordion";
import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { Dialog } from "@elmeragroup/fuse/dialog";
import { Field } from "@elmeragroup/fuse/field";
import { Heading } from "@elmeragroup/fuse/heading";
import { Gear, MagnifyingGlass, Plus } from "@elmeragroup/fuse/icons";
import { GridList, GridListItem } from "@elmeragroup/fuse/react-aria/grid-list";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";
import { Select } from "@elmeragroup/fuse/select";
import { Switch } from "@elmeragroup/fuse/switch";
import { Table } from "@elmeragroup/fuse/table";
import { TextField } from "@elmeragroup/fuse/text-field";

const twinBoard = tv({
  slots: {
    root: "flex flex-col gap-6 p-8",
    group: "flex flex-col gap-2",
    toolbar: "flex flex-wrap items-center gap-2",
    actions: "flex flex-wrap items-center gap-2",
  },
});

const styles = twinBoard();

const LANGUAGES = { en: "English", nb: "Norsk", sv: "Svenska" } as const;

const ORDERS = [
  { id: "#1042", status: "Active", amount: "NOK 1 240" },
  { id: "#1043", status: "Pending", amount: "NOK 890" },
  { id: "#1044", status: "Paid", amount: "NOK 2 110" },
] as const;

/** The navigator has no route; the list only selects. */
const navigate = (): undefined => undefined;

/**
 * The Density page's composition: a settings Card, a list of rows, a Table, a toolbar of Buttons
 * in every size, an Accordion and a Dialog trigger. Both twins render it. Each `data-twin-id`
 * anchors the parts inside it, so the nth part of an anchor in one twin is the nth part of the
 * same anchor in the other, even when only one twin has an Accordion item closed or a popup open.
 */
export function TwinBoard(): ReactElement {
  return (
    <div className={styles.root()}>
      <Card.Root data-twin-id="settings">
        <Card.Header>
          <Card.Title>Notifications</Card.Title>
          <Card.Description>Choose how we reach you.</Card.Description>
        </Card.Header>
        <Card.Content>
          <div className={styles.group()}>
            <TextField label="Display name" defaultValue="Alex Berg" />
            <Field.Root>
              <Field.Label>Language</Field.Label>
              <Select.Root items={LANGUAGES} defaultValue="en">
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                {/* Item alignment would misplace the popup inside the artboard's transformed scope. */}
                <Select.Content alignItemWithTrigger={false} data-twin-id="language-options">
                  {Object.entries(LANGUAGES).map(([value, label]) => (
                    <Select.Item key={value} value={value}>
                      {label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Field.Root>
            <Field.Root orientation="horizontal">
              <Switch defaultChecked />
              <Field.Label>Weekly summary by email</Field.Label>
            </Field.Root>
          </div>
        </Card.Content>
        <Card.Footer>
          <Button>Save</Button>
        </Card.Footer>
      </Card.Root>
      <div className={styles.group()} data-twin-id="meters">
        <Heading level={3} size="sm">
          Meters
        </Heading>
        <UiProviders locale="en-US" navigate={navigate}>
          <GridList aria-label="Meters" selectionMode="single" defaultSelectedKeys={["oslo"]}>
            <GridListItem id="oslo">Oslo meter 735999123</GridListItem>
            <GridListItem id="bergen">Bergen meter 735999456</GridListItem>
            <GridListItem id="trondheim">Trondheim meter 735999789</GridListItem>
          </GridList>
        </UiProviders>
      </div>
      {/* Layout only: the anchor holds the table and its scroll container, both parts. */}
      <div data-twin-id="orders">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Order</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Amount</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {ORDERS.map((order) => (
              <Table.Row key={order.id}>
                <Table.Cell>{order.id}</Table.Cell>
                <Table.Cell>{order.status}</Table.Cell>
                <Table.Cell>{order.amount}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </div>
      <div className={styles.toolbar()} data-twin-id="toolbar">
        <Button size="xs" variant="outline">
          Extra small
        </Button>
        <Button size="sm" variant="outline">
          Small
        </Button>
        <Button variant="outline">Medium</Button>
        <Button size="lg" variant="outline">
          <Plus data-icon="inline-start" />
          Large
        </Button>
        <Button size="icon-xs" variant="ghost" aria-label="Search, extra small">
          <MagnifyingGlass />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Search, small">
          <MagnifyingGlass />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Search, medium">
          <MagnifyingGlass />
        </Button>
        <Button size="icon-lg" variant="ghost" aria-label="Search, large">
          <MagnifyingGlass />
        </Button>
      </div>
      <Accordion.Root defaultValue={["delivery"]}>
        <Accordion.Item value="delivery" data-twin-id="delivery">
          <Accordion.Header>
            <Accordion.Trigger>Delivery</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Invoices arrive by email on the first of the month.</Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="privacy" data-twin-id="privacy">
          <Accordion.Header>
            <Accordion.Trigger>Privacy</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>We never share your contact details.</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
      <div className={styles.actions()} data-twin-id="actions">
        <Dialog.Root>
          <Dialog.Trigger render={<Button variant="secondary" />}>
            <Gear data-icon="inline-start" />
            Advanced settings
          </Dialog.Trigger>
          <Dialog.Content data-twin-id="advanced-dialog">
            <Dialog.Header>
              <Dialog.Title>Advanced settings</Dialog.Title>
              <Dialog.Description>These apply to every meter on the account.</Dialog.Description>
            </Dialog.Header>
            <TextField label="Reference" placeholder="Optional" />
            <Dialog.Footer>
              <Dialog.Close render={<Button variant="outline" />}>Cancel</Dialog.Close>
              <Dialog.Close render={<Button />}>Apply</Dialog.Close>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
      </div>
    </div>
  );
}
