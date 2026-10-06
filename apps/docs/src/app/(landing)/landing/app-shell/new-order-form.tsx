"use client";

import { useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import { parseDate } from "@internationalized/date";
import type { CalendarDate } from "@internationalized/date";
import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Field } from "@elmeragroup/fuse/field";
import { NumberField } from "@elmeragroup/fuse/number-field";
import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";
import { Radio, RadioGroup, RadioItem, RadioItemGroup } from "@elmeragroup/fuse/radio-group";
import { DatePicker } from "@elmeragroup/fuse/react-aria/date-picker";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";
import { Select } from "@elmeragroup/fuse/select";
import { Sheet } from "@elmeragroup/fuse/sheet";
import { TextField } from "@elmeragroup/fuse/text-field";
import { TextareaField } from "@elmeragroup/fuse/textarea-field";

import { useSideOverlay } from "../window-side";
import { useDashboard } from "./dashboard-context";
import { CAMPAIGNS, osloDate, PRODUCTS, productPrice, STARTUP_TYPES } from "./dashboard-orders";
import type { Campaign, Product, StartupType } from "./dashboard-orders";
import { ANNUAL_KWH_RANGE, parseDraft, remainingErrors } from "./order-draft";
import type { DraftField, DraftFields } from "./order-draft";

const newOrderForm = tv({
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

const styles = newOrderForm();

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

/** The picker's value for a `yyyy-mm-dd` field, which is empty until every segment is in. */
function calendarDate(iso: string): CalendarDate | null {
  return iso === "" ? null : parseDate(iso);
}

/**
 * `fields` as the Start date picker shows them. React Aria keeps the date it last committed while
 * a segment is empty, so a picker with an empty segment holds no date here. `data-placeholder` is
 * React Aria's own mark of an empty segment.
 */
function withShownStartDate(fields: DraftFields, picker: HTMLElement | null): DraftFields {
  const hasEmptySegment = picker !== null && picker.querySelector("[data-placeholder]") !== null;
  return hasEmptySegment ? { ...fields, startDate: "" } : fields;
}

/** Props for `NewOrderForm`. */
export type NewOrderFormProps = {
  /** Called once a valid draft is saved, so the Sheet can close. */
  onSaved: () => void;
};

/**
 * New order's form: its Sheet's body and footer. It mounts with the Sheet's popup, so every
 * opening starts empty. Errors appear on submit, through each control's Field, and each one
 * clears as soon as its field is valid.
 */
export function NewOrderForm({ onSaved }: NewOrderFormProps): ReactElement {
  const { dispatch, now, notify } = useDashboard();
  const [fields, setFields] = useState<DraftFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<ReadonlyMap<DraftField, string>>(new Map());
  const [campaignOpen, setCampaignOpen] = useSideOverlay(false);
  // The fields as last stored, ahead of the render that shows them. React Aria can commit a
  // constrained date in the same blur that rechecks it, after this render's `fields` were read.
  const latestFields = useRef(fields);
  const startDatePicker = useRef<HTMLDivElement>(null);
  // A new value on every render would make React Aria drop a segment edit still in progress.
  const startDate = useMemo(() => calendarDate(fields.startDate), [fields.startDate]);
  const today = osloDate(now());
  /** Stores `next`, and drops each shown error that `checked` no longer fails. */
  const update = (next: DraftFields, checked: DraftFields) => {
    latestFields.current = next;
    setFields(next);
    if (errors.size > 0) {
      setErrors(remainingErrors(errors, checked, today));
    }
  };
  const set = <K extends keyof DraftFields>(key: K, value: DraftFields[K]) => {
    const next = { ...fields, [key]: value };
    update(next, withShownStartDate(next, startDatePicker.current));
  };
  const error = (field: DraftField) => errors.get(field);

  return (
    <form
      noValidate
      aria-label="New order"
      className={styles.form()}
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = parseDraft(withShownStartDate(fields, startDatePicker.current), today);
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
              open={campaignOpen}
              onOpenChange={setCampaignOpen}
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
          {/* Norwegian segments (dd.mm.yyyy) and calendar months, for Norwegian customers. The
              demo's today bounds the calendar, so earlier days take no pick and it opens on that
              month. Native validation stays silent in the noValidate form, so the parse's message
              is the only one, shown on submit like every other field's. */}
          <div ref={startDatePicker}>
            <UiProviders locale="nb-NO" navigate={() => undefined}>
              <DatePicker<CalendarDate>
                label="Start date"
                value={startDate}
                onChange={(value) => {
                  // A change means every segment is in, or every one is empty, so the value is
                  // what the field shows. The segments on screen still predate this keystroke.
                  const next = { ...fields, startDate: value === null ? "" : value.toString() };
                  update(next, next);
                }}
                onBlur={() => {
                  // Retyping the committed date is no change to React Aria, so recheck on leaving.
                  // Only the errors: the fields may already hold a date committed in this blur.
                  const checked = withShownStartDate(latestFields.current, startDatePicker.current);
                  setErrors((shown) => (shown.size > 0 ? remainingErrors(shown, checked, today) : shown));
                }}
                minValue={parseDate(today)}
                placeholderValue={parseDate(today)}
                isInvalid={error("startDate") !== undefined}
                errorMessage={error("startDate")}
              />
            </UiProviders>
          </div>
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
          <TextareaField
            label="Note for back office"
            rows={3}
            value={fields.note}
            onChange={(value) => {
              set("note", value);
            }}
          />
        </Field.Set>
      </Sheet.Body>
      <Sheet.Footer className={styles.footer()}>
        <Sheet.Close render={<Button variant="outline" />}>Cancel</Sheet.Close>
        <Button type="submit">Save draft</Button>
      </Sheet.Footer>
    </form>
  );
}
