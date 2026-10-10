"use client";

import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Alert } from "@elmeragroup/fuse/alert";
import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Dialog } from "@elmeragroup/fuse/dialog";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { Field } from "@elmeragroup/fuse/field";
import { Heading } from "@elmeragroup/fuse/heading";
import { DotsThree } from "@elmeragroup/fuse/icons";
import { Meter } from "@elmeragroup/fuse/meter";
import { Radio, RadioGroup } from "@elmeragroup/fuse/radio-group";
import { Select } from "@elmeragroup/fuse/select";
import { Switch } from "@elmeragroup/fuse/switch";
import { Tabs } from "@elmeragroup/fuse/tabs";
import { Text } from "@elmeragroup/fuse/text";
import { TextField } from "@elmeragroup/fuse/text-field";

const componentsBoard = tv({
  slots: {
    root: "flex flex-col gap-6 p-8",
    head: "flex items-start justify-between gap-4",
    titles: "flex min-w-0 flex-col gap-1",
    form: "flex flex-col gap-4",
    pair: "grid grid-cols-2 gap-4",
    buttons: "flex flex-wrap gap-2",
    badges: "flex flex-wrap gap-2",
    actions: "flex flex-wrap items-center gap-2",
    panel: "pt-4",
  },
});

const styles = componentsBoard();

const LANGUAGES = {
  en: "English",
  nb: "Norsk",
  sv: "Svenska",
  fi: "Suomi",
} as const;

const BUTTON_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "success",
  "link",
] as const;

const BUTTON_LABELS = {
  default: "Save",
  secondary: "Preview",
  outline: "Export",
  ghost: "Reset",
  destructive: "Delete",
  success: "Approve",
  link: "Learn more",
} as const satisfies Record<(typeof BUTTON_VARIANTS)[number], string>;

/** The account form inside the Profile tab: every common field in one Card. */
function ProfileCard(): ReactElement {
  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>Contact details</Card.Title>
        <Card.Description>Used for receipts and service messages.</Card.Description>
        <Card.Action>
          <Badge variant="outline">Draft</Badge>
        </Card.Action>
      </Card.Header>
      <Card.Content>
        <form
          className={styles.form()}
          onSubmit={(event) => {
            event.preventDefault();
          }}>
          <div className={styles.pair()}>
            <TextField label="Full name" defaultValue="Alex Berg" />
            <TextField label="Email" type="email" defaultValue="alex@example.com" />
          </div>
          <Field.Root>
            <Field.Label>Language</Field.Label>
            <Select.Root items={LANGUAGES} defaultValue="en">
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              {/* Item alignment would misplace the popup inside the artboard's transformed scope. */}
              <Select.Content alignItemWithTrigger={false}>
                {Object.entries(LANGUAGES).map(([value, label]) => (
                  <Select.Item key={value} value={value}>
                    {label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Field.Root>
          <RadioGroup label="Contact me by" orientation="horizontal" defaultValue="email">
            <Radio value="email">Email</Radio>
            <Radio value="phone">Phone</Radio>
            <Radio value="post">Post</Radio>
          </RadioGroup>
          <Field.Root orientation="horizontal">
            <Checkbox defaultChecked />
            <Field.Label>Send me a monthly summary</Field.Label>
          </Field.Root>
          <Field.Root orientation="horizontal">
            <Switch />
            <Field.Label>Paperless invoices</Field.Label>
          </Field.Root>
          <div className={styles.buttons()}>
            {BUTTON_VARIANTS.map((variant) => (
              <Button key={variant} variant={variant} type={variant === "default" ? "submit" : "button"}>
                {BUTTON_LABELS[variant]}
              </Button>
            ))}
          </div>
        </form>
      </Card.Content>
    </Card.Root>
  );
}

/** A menu and a dialog, each of which opens inside its artboard. */
function Actions(): ReactElement {
  return (
    <div className={styles.actions()}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger render={<Button variant="outline" />}>
          <DotsThree data-icon="inline-start" aria-hidden />
          More actions
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Group>
            <DropdownMenu.Label>Account</DropdownMenu.Label>
            <DropdownMenu.Item>Rename</DropdownMenu.Item>
            <DropdownMenu.Item>Duplicate</DropdownMenu.Item>
            <DropdownMenu.Item>Download data</DropdownMenu.Item>
          </DropdownMenu.Group>
          <DropdownMenu.Separator />
          <DropdownMenu.Item variant="destructive">Close account</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <Dialog.Root>
        <Dialog.Trigger render={<Button variant="secondary" />}>Share access</Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Share access</Dialog.Title>
            <Dialog.Description>
              Invite someone to view this account. They can leave at any time.
            </Dialog.Description>
          </Dialog.Header>
          <TextField label="Their email" type="email" placeholder="name@example.com" />
          <Dialog.Footer>
            <Dialog.Close render={<Button variant="outline" />}>Cancel</Dialog.Close>
            <Dialog.Close render={<Button />}>Send invite</Dialog.Close>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}

/**
 * The Overview's component composition: an account page built from real Fuse parts. Each of the
 * four component artboards renders it in its own scheme and density.
 */
export function ComponentsBoard(): ReactElement {
  return (
    <div className={styles.root()}>
      <div className={styles.head()}>
        <div className={styles.titles()}>
          <Heading level={2} size="xl">
            Account
          </Heading>
          <Text variant="muted" size="sm">
            Manage how we reach you and what you receive.
          </Text>
        </div>
        <Badge variant="success">Active</Badge>
      </div>
      <Tabs.Root defaultValue="profile">
        <Tabs.List>
          <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
          <Tabs.Trigger value="usage">Usage</Tabs.Trigger>
          <Tabs.Trigger value="billing">Billing</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="profile">
          <div className={styles.panel()}>
            <ProfileCard />
          </div>
        </Tabs.Content>
        <Tabs.Content value="usage">
          <div className={styles.panel()}>
            <Meter label="Storage used" value={82} maxValue={120} valueLabel="82 of 120 GB" />
          </div>
        </Tabs.Content>
        <Tabs.Content value="billing">
          <div className={styles.panel()}>
            <Text>The next invoice is issued on the first of the month.</Text>
          </div>
        </Tabs.Content>
      </Tabs.Root>
      <div className={styles.badges()}>
        <Badge>Paid</Badge>
        <Badge variant="secondary">Scheduled</Badge>
        <Badge variant="warning">Due soon</Badge>
        <Badge variant="destructive">Overdue</Badge>
        <Badge variant="info">New</Badge>
      </div>
      <Alert.Root variant="warning">
        <Alert.Title>Verify your email</Alert.Title>
        <Alert.Description>We sent a link to alex@example.com. It expires in 24 hours.</Alert.Description>
      </Alert.Root>
      <Meter label="Monthly budget" value={640} maxValue={1000} valueLabel="640 of 1 000" />
      <Actions />
    </div>
  );
}
