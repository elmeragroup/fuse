"use client";

import { useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";
import { Input } from "@elmeragroup/fuse/input";
import { NumberField } from "@elmeragroup/fuse/number-field";
import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";
import { Radio, RadioGroup, RadioItem, RadioItemGroup } from "@elmeragroup/fuse/radio-group";
import { Select } from "@elmeragroup/fuse/select";
import { Sheet } from "@elmeragroup/fuse/sheet";
import { TextField } from "@elmeragroup/fuse/text-field";
import { Textarea } from "@elmeragroup/fuse/textarea";

import { useDashboard } from "./dashboard-context";
import { CAMPAIGNS, osloDate, PRODUCTS, productPrice, STARTUP_TYPES } from "./dashboard-orders";
import type { Campaign, Product, StartupType } from "./dashboard-orders";
import { nextOrderId } from "./dashboard-state";
import { ANNUAL_KWH_RANGE, parseDraft } from "./order-draft";
import type { DraftField, DraftFields } from "./order-draft";

const newOrderSheet = tv({
  slots: {
    // The form spans the body and the footer, so Save draft submits it from below the scroll.
    form: "flex min-h-0 flex-1 flex-col",
    // A size container, so the phone and email pair up only where the Sheet is wide enough.
    body: "@container flex flex-col gap-6 pb-6",
    section: "flex flex-col gap-4",
    pair: "@md:grid-cols-2 grid grid-cols-1 gap-4",
    footer: "flex-row justify-end border-t border-border",
  },
});

const styles = newOrderSheet();

/** The campaign Select's items: none, then the season's campaigns. */
const CAMPAIGN_ITEMS = {
  none: "No campaign",
  Høstkampanje: "Høstkampanje",
  "3 måneder halv pris": "3 måneder halv pris",
} as const satisfies Record<Campaign | "none", string>;

const EMPTY_FIELDS: DraftFields = {
  customer: "",
  ssn: "",
  phone: "",
  email: "",
  address: "",
  meterPointId: "",
  product: "Spotpris",
  campaign: "none",
  startup: "Change of supplier",
  startDate: "",
  annualKwh: Number.NaN,
  powerOfAttorney: false,
  note: "",
};

/** Narrows a radio or select's string back to the option it was built from. */
function pick<T extends string>(options: readonly T[], value: string | null): T | undefined {
  return options.find((option) => option === value);
}

/**
 * The form. It mounts with the Sheet's popup, so every opening starts empty. Errors appear on
 * submit, through each control's Field, and stay until the next submit.
 */
function NewOrderForm({ onSaved }: { onSaved: () => void }): ReactElement {
  const { dispatch, now, notify } = useDashboard();
  const [fields, setFields] = useState<DraftFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<ReadonlyMap<DraftField, string>>(new Map());
  const set = <K extends keyof DraftFields>(key: K, value: DraftFields[K]) => {
    setFields((current) => ({ ...current, [key]: value }));
  };
  const error = (field: DraftField) => errors.get(field);
  const today = osloDate(now());

  return (
    <form
      noValidate
      aria-label="New order"
      className={styles.form()}
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = parseDraft(fields, today);
        if (parsed._tag === "Invalid") {
          setErrors(parsed.errors);
          return;
        }
        dispatch({ _tag: "CreateDraft", draft: parsed.draft, at: now() });
        onSaved();
        notify({
          type: "success",
          title: "Draft saved",
          description: `${parsed.draft.product} for ${parsed.draft.customer}`,
        });
      }}>
      <Sheet.Body className={styles.body()}>
        <Field.Set className={styles.section()}>
          <Field.Legend>Customer</Field.Legend>
          <TextField
            label="Name"
            autoComplete="off"
            value={fields.customer}
            onChange={(value) => {
              set("customer", value);
            }}
            isInvalid={error("customer") !== undefined}
            errorMessage={error("customer")}
          />
          <TextField
            label="SSN"
            description="11 digits. Shown masked once saved."
            filter="numeric"
            autoComplete="off"
            value={fields.ssn}
            onChange={(value) => {
              set("ssn", value);
            }}
            isInvalid={error("ssn") !== undefined}
            errorMessage={error("ssn")}
          />
          <div className={styles.pair()}>
            <PhoneNumberField
              label="Phone"
              value={fields.phone}
              onChange={(value) => {
                set("phone", value);
              }}
              isInvalid={error("phone") !== undefined}
              errorMessage={error("phone")}
            />
            <TextField
              label="Email"
              autoComplete="off"
              value={fields.email}
              onChange={(value) => {
                set("email", value);
              }}
              isInvalid={error("email") !== undefined}
              errorMessage={error("email")}
            />
          </div>
        </Field.Set>
        <Field.Set className={styles.section()}>
          <Field.Legend>Facility</Field.Legend>
          <TextField
            label="Facility address"
            autoComplete="off"
            value={fields.address}
            onChange={(value) => {
              set("address", value);
            }}
            isInvalid={error("address") !== undefined}
            errorMessage={error("address")}
          />
          <TextField
            label="Metering point ID"
            description="18 digits from 7070. Elhub looks up the price area and grid owner."
            filter="numeric"
            autoComplete="off"
            value={fields.meterPointId}
            onChange={(value) => {
              set("meterPointId", value);
            }}
            isInvalid={error("meterPointId") !== undefined}
            errorMessage={error("meterPointId")}
          />
          <NumberField
            label="Estimated annual use"
            denomination="kWh"
            minValue={ANNUAL_KWH_RANGE.min}
            maxValue={ANNUAL_KWH_RANGE.max}
            step={100}
            value={fields.annualKwh}
            onChange={(value) => {
              set("annualKwh", value);
            }}
            isInvalid={error("annualKwh") !== undefined}
            errorMessage={error("annualKwh")}
          />
        </Field.Set>
        <Field.Set className={styles.section()}>
          <Field.Legend>Agreement</Field.Legend>
          <RadioItemGroup
            label="Product"
            value={fields.product}
            onChange={(value) => {
              const product = pick<Product>(PRODUCTS, value);
              if (product !== undefined) {
                set("product", product);
              }
            }}>
            {PRODUCTS.map((product) => (
              <RadioItem key={product} value={product}>
                <RadioItem.Content>
                  <RadioItem.Title>{product}</RadioItem.Title>
                  <RadioItem.Description>{productPrice(product)}</RadioItem.Description>
                </RadioItem.Content>
              </RadioItem>
            ))}
          </RadioItemGroup>
          <Field.Root>
            <Field.Label>Campaign</Field.Label>
            <Select.Root<Campaign | "none">
              items={CAMPAIGN_ITEMS}
              value={fields.campaign}
              onValueChange={(value) => {
                set("campaign", value ?? "none");
              }}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {(["none", ...CAMPAIGNS] as const).map((value) => (
                  <Select.Item key={value} value={value}>
                    {CAMPAIGN_ITEMS[value]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Field.Root>
          <RadioGroup
            label="Startup"
            orientation="horizontal"
            value={fields.startup}
            onChange={(value) => {
              const startup = pick<StartupType>(STARTUP_TYPES, value);
              if (startup !== undefined) {
                set("startup", startup);
              }
            }}>
            {STARTUP_TYPES.map((startup) => (
              <Radio key={startup} value={startup}>
                {startup}
              </Radio>
            ))}
          </RadioGroup>
          <Field.Root invalid={error("startDate") !== undefined}>
            <Field.Label>Start date</Field.Label>
            <Input
              type="date"
              min={today}
              value={fields.startDate}
              onChange={(event) => {
                set("startDate", event.target.value);
              }}
            />
            <Field.Error>{error("startDate")}</Field.Error>
          </Field.Root>
          <Field.Root invalid={error("powerOfAttorney") !== undefined}>
            <Field.Item>
              <Field.Label>
                <Checkbox
                  checked={fields.powerOfAttorney}
                  onCheckedChange={(checked) => {
                    set("powerOfAttorney", checked);
                  }}
                />
                The customer gives power of attorney to change supplier
              </Field.Label>
            </Field.Item>
            <Field.Error>{error("powerOfAttorney")}</Field.Error>
          </Field.Root>
          <Field.Root>
            <Field.Label>Note for back office</Field.Label>
            <Textarea
              rows={3}
              value={fields.note}
              onChange={(event) => {
                set("note", event.target.value);
              }}
            />
          </Field.Root>
        </Field.Set>
      </Sheet.Body>
      <Sheet.Footer className={styles.footer()}>
        <Sheet.Close render={<Button variant="outline" />}>Cancel</Sheet.Close>
        <Button type="submit">Save draft</Button>
      </Sheet.Footer>
    </form>
  );
}

export type NewOrderSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Starts a private power order the way a seller does in the sales tool's `power-private` form:
 * the customer and their contact details, the facility, then the agreement. It saves as a draft
 * in Drafts, and Elhub fills in the price area and grid owner once the order is sent.
 */
export function NewOrderSheet({ open, onOpenChange }: NewOrderSheetProps): ReactElement {
  const { state } = useDashboard();
  return (
    <Sheet.Root open={open} onOpenChange={onOpenChange}>
      <Sheet.Content size="lg">
        <Sheet.Header>
          <Sheet.Title>New order</Sheet.Title>
          <Sheet.Description>{`Saved as draft ${String(nextOrderId(state.orders))} until you send it.`}</Sheet.Description>
        </Sheet.Header>
        <NewOrderForm
          onSaved={() => {
            onOpenChange(false);
          }}
        />
      </Sheet.Content>
    </Sheet.Root>
  );
}
