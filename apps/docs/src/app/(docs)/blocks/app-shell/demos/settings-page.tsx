"use client";

/**
 * Settings: one form in three sections, each field wired to its label, description and error by
 * Fuse's Field. Every field lives in one draft; Save parses the whole draft into the settings and
 * commits them in one step, and Discard returns the draft to what was last saved. A field that does
 * not parse shows the reason and takes focus.
 */

import { useState } from "react";
import type { FormEvent, ReactElement, ReactNode } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Field } from "@elmeragroup/fuse/field";
import { Frame } from "@elmeragroup/fuse/frame";
import { Radio, RadioGroup } from "@elmeragroup/fuse/radio-group";
import { Select } from "@elmeragroup/fuse/select";
import { SelectField } from "@elmeragroup/fuse/select-field";
import { Switch } from "@elmeragroup/fuse/switch";
import { TextField } from "@elmeragroup/fuse/text-field";
import { Toast } from "@elmeragroup/fuse/toast";

import { PageHeader } from "./page-header";
import { CONTRACT_LABELS, CONTRACT_TYPES, SIGNED_IN } from "./power-data";
import type { ContractType } from "./power-data";

/** How many days a new customer has to pay an invoice. */
const PAYMENT_TERMS = [14, 21, 30] as const;
type PaymentTerms = (typeof PAYMENT_TERMS)[number];

/** When price alerts go out: never, or above a price in øre per kWh. */
type PriceAlerts = { readonly _tag: "Off" } | { readonly _tag: "Above"; readonly ore: number };

/** The saved settings: what the app runs on until the next save. */
type Settings = {
  readonly name: string;
  readonly email: string;
  readonly defaultContract: ContractType;
  readonly paymentTerms: PaymentTerms;
  readonly alerts: PriceAlerts;
  readonly weeklyReport: boolean;
};

/** What the form holds while the user edits: every field, the text ones as typed. */
type Draft = {
  readonly name: string;
  readonly email: string;
  readonly defaultContract: ContractType;
  readonly paymentTerms: PaymentTerms;
  readonly alertsOn: boolean;
  readonly threshold: string;
  readonly weeklyReport: boolean;
};

/** What is wrong with each field that does not parse. */
type SettingsErrors = {
  name?: string;
  email?: string;
  threshold?: string;
};

type Parsed =
  | { readonly _tag: "ok"; readonly value: Settings }
  | { readonly _tag: "err"; readonly errors: SettingsErrors };

/** The settings the page opens with. Your app loads them from its API. */
const INITIAL_SETTINGS: Settings = {
  name: SIGNED_IN.name,
  email: SIGNED_IN.email,
  defaultContract: "spot",
  paymentTerms: 14,
  alerts: { _tag: "Above", ore: 150 },
  weeklyReport: false,
};

/** The threshold an alert that is off offers when it is turned back on. */
const DEFAULT_THRESHOLD = "150";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/** A draft that shows `settings`, for opening the form and for Discard. */
function draftOf(settings: Settings): Draft {
  return {
    name: settings.name,
    email: settings.email,
    defaultContract: settings.defaultContract,
    paymentTerms: settings.paymentTerms,
    alertsOn: settings.alerts._tag === "Above",
    threshold: settings.alerts._tag === "Above" ? String(settings.alerts.ore) : DEFAULT_THRESHOLD,
    weeklyReport: settings.weeklyReport,
  };
}

/** Parses the whole draft into settings, or names what is wrong with each field. */
function parseSettings(draft: Draft): Parsed {
  const name = draft.name.trim();
  const email = draft.email.trim();
  const threshold = Number(draft.threshold.trim());
  const errors: SettingsErrors = {};
  if (name === "") errors.name = "Enter your name.";
  if (!EMAIL.test(email)) errors.email = "Enter an email address such as name@example.com.";
  if (draft.alertsOn && !(Number.isInteger(threshold) && threshold >= 1 && threshold <= 999)) {
    errors.threshold = "Enter a whole number of øre from 1 to 999.";
  }
  if (Object.keys(errors).length > 0) return { _tag: "err", errors };
  return {
    _tag: "ok",
    value: {
      name,
      email,
      defaultContract: draft.defaultContract,
      paymentTerms: draft.paymentTerms,
      alerts: draft.alertsOn ? { _tag: "Above", ore: threshold } : { _tag: "Off" },
      weeklyReport: draft.weeklyReport,
    },
  };
}

/** Whether the draft shows exactly the saved settings. */
function isUnchanged(draft: Draft, settings: Settings): boolean {
  const saved = draftOf(settings);
  return (
    draft.name === saved.name &&
    draft.email === saved.email &&
    draft.defaultContract === saved.defaultContract &&
    draft.paymentTerms === saved.paymentTerms &&
    draft.alertsOn === saved.alertsOn &&
    draft.threshold === saved.threshold &&
    draft.weeklyReport === saved.weeklyReport
  );
}

/** What a save set, in one sentence for its toast. */
function summary(settings: Settings): string {
  const alerts =
    settings.alerts._tag === "Above"
      ? `price alerts above ${String(settings.alerts.ore)} øre/kWh`
      : "no price alerts";
  const report = settings.weeklyReport ? "a weekly report" : "no weekly report";
  return `${CONTRACT_LABELS[settings.defaultContract]} by default, ${String(settings.paymentTerms)}-day terms, ${alerts} and ${report}.`;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Frame.Root>
      <Frame.Header>
        <Frame.Title>
          <h2>{title}</h2>
        </Frame.Title>
        <Frame.Description>{description}</Frame.Description>
      </Frame.Header>
      <Frame.Panel>
        <div className="flex flex-col gap-5">{children}</div>
      </Frame.Panel>
    </Frame.Root>
  );
}

/** The settings page. */
export function SettingsPage(): ReactElement {
  const [saved, setSaved] = useState<Settings>(INITIAL_SETTINGS);
  const [draft, setDraft] = useState<Draft>(() => draftOf(INITIAL_SETTINGS));
  const [errors, setErrors] = useState<SettingsErrors>({});
  const toasts = Toast.useToastManager();
  const unchanged = isUnchanged(draft, saved);

  /** The one place the settings change. Your app sends them to its API here. */
  function commit(settings: Settings): void {
    setSaved(settings);
    setDraft(draftOf(settings));
    setErrors({});
    toasts.add({ type: "success", title: "Settings saved", description: summary(settings) });
  }

  function save(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsed = parseSettings(draft);
    if (parsed._tag === "ok") {
      commit(parsed.value);
      return;
    }
    setErrors(parsed.errors);
    // Focus moves to the first field to fix, which reads its error as it lands.
    const first = (["name", "email", "threshold"] as const).find(
      (field) => parsed.errors[field] !== undefined
    );
    const control = first === undefined ? null : event.currentTarget.elements.namedItem(first);
    if (control instanceof HTMLElement) control.focus();
  }

  function edit(change: Partial<Draft>): void {
    setDraft((current) => ({ ...current, ...change }));
  }

  return (
    <>
      <PageHeader page="Settings" />
      {/* The form parses its own draft, so the browser's own validation stands aside. */}
      <form
        noValidate
        onSubmit={save}
        className="max-w-3xl md:gap-6 md:px-6 flex w-full flex-col gap-4 px-4 pt-2 pb-8">
        <Section title="Profile" description="How you appear to your team, and where your mail goes.">
          <TextField
            label="Full name"
            name="name"
            value={draft.name}
            onChange={(name) => {
              edit({ name });
            }}
            isRequired
            isInvalid={errors.name !== undefined}
            errorMessage={errors.name}
          />
          <TextField
            label="Email"
            name="email"
            value={draft.email}
            onChange={(email) => {
              edit({ email });
            }}
            description="Reports and price alerts go here."
            isRequired
            isInvalid={errors.email !== undefined}
            errorMessage={errors.email}
          />
        </Section>

        <Section title="Invoicing" description="The defaults for customers who sign up from today.">
          <SelectField
            label="Default contract"
            name="contract"
            items={CONTRACT_LABELS}
            value={draft.defaultContract}
            onValueChange={(value) => {
              const contract = CONTRACT_TYPES.find((candidate) => candidate === value);
              if (contract !== undefined) edit({ defaultContract: contract });
            }}
            description="Customers can change contract at any time.">
            {CONTRACT_TYPES.map((contract) => (
              <Select.Item key={contract} value={contract}>
                {CONTRACT_LABELS[contract]}
              </Select.Item>
            ))}
          </SelectField>
          <RadioGroup
            label="Payment terms"
            description="How long a new customer has to pay each invoice."
            name="terms"
            orientation="horizontal"
            value={String(draft.paymentTerms)}
            onChange={(value) => {
              const terms = PAYMENT_TERMS.find((days) => String(days) === value);
              if (terms !== undefined) edit({ paymentTerms: terms });
            }}>
            {PAYMENT_TERMS.map((days) => (
              <Radio key={days} value={String(days)}>
                {days} days
              </Radio>
            ))}
          </RadioGroup>
        </Section>

        <Section title="Notifications" description="What we tell you about, and when.">
          <Field.Root orientation="horizontal" className="justify-between">
            <Field.Content>
              <Field.Label>Price alerts</Field.Label>
              <Field.Description>Mail me when NO1&apos;s spot price passes the threshold.</Field.Description>
            </Field.Content>
            <Switch
              name="priceAlerts"
              checked={draft.alertsOn}
              onCheckedChange={(alertsOn) => {
                edit({ alertsOn });
              }}
            />
          </Field.Root>
          <TextField
            label="Alert threshold, øre/kWh"
            name="threshold"
            filter="numeric"
            value={draft.threshold}
            onChange={(threshold) => {
              edit({ threshold });
            }}
            isDisabled={!draft.alertsOn}
            isInvalid={errors.threshold !== undefined}
            errorMessage={errors.threshold}
          />
          <Field.Root orientation="horizontal" className="justify-between">
            <Field.Content>
              <Field.Label>Weekly report</Field.Label>
              <Field.Description>
                The portfolio&apos;s consumption and invoicing, every Monday.
              </Field.Description>
            </Field.Content>
            <Switch
              name="weeklyReport"
              checked={draft.weeklyReport}
              onCheckedChange={(weeklyReport) => {
                edit({ weeklyReport });
              }}
            />
          </Field.Root>
        </Section>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <p role="status" className="text-sm mr-auto text-muted-foreground">
            {unchanged ? "All changes saved" : "Unsaved changes"}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={unchanged}
            onClick={() => {
              setDraft(draftOf(saved));
              setErrors({});
            }}>
            Discard changes
          </Button>
          <Button type="submit">Save settings</Button>
        </div>
      </form>
    </>
  );
}
