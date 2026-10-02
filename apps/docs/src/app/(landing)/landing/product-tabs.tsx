"use client";

import { useState } from "react";
import type { MouseEvent, ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Accordion } from "@elmeragroup/fuse/accordion";
import { Alert } from "@elmeragroup/fuse/alert";
import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { CheckboxGroup } from "@elmeragroup/fuse/checkbox";
import { CheckboxCard } from "@elmeragroup/fuse/checkbox-card";
import { DescriptionList } from "@elmeragroup/fuse/description-list";
import { Field } from "@elmeragroup/fuse/field";
import { Download } from "@elmeragroup/fuse/icons";
import { Meter } from "@elmeragroup/fuse/meter";
import { NumberField } from "@elmeragroup/fuse/number-field";
import { Pagination } from "@elmeragroup/fuse/pagination";
import { Select } from "@elmeragroup/fuse/select";
import { Table } from "@elmeragroup/fuse/table";
import { TimelineList } from "@elmeragroup/fuse/timeline-list";
import { Toast } from "@elmeragroup/fuse/toast";

import { Labelled, stack } from "./product-parts";

const productTabs = tv({
  slots: {
    // The text box is 14px tall; the hit area adds 6px above and below to clear the 24px floor
    // without growing the row.
    invoiceLink:
      "font-medium hit-area-1.5 tabular-nums underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring",
    amount: "text-right tabular-nums",
    actions: "flex flex-wrap gap-3",
  },
});

const styles = productTabs();

const nok = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const INVOICES = [
  {
    id: "4821",
    period: "September",
    usage: 1041,
    amount: 1284.6,
    status: "due",
    issued: { date: "2026-10-01T06:00:00.000Z", label: "1 October" },
    due: "20 October",
  },
  {
    id: "4790",
    period: "August",
    usage: 868,
    amount: 1012.3,
    status: "paid",
    issued: { date: "2026-09-01T06:00:00.000Z", label: "1 September" },
    due: "20 September",
  },
  {
    id: "4756",
    period: "July",
    usage: 712,
    amount: 874.9,
    status: "paid",
    issued: { date: "2026-08-01T06:00:00.000Z", label: "1 August" },
    due: "20 August",
  },
  {
    id: "4722",
    period: "June",
    usage: 754,
    amount: 921.4,
    status: "paid",
    issued: { date: "2026-07-01T06:00:00.000Z", label: "1 July" },
    due: "20 July",
  },
  {
    id: "4688",
    period: "May",
    usage: 902,
    amount: 1088.2,
    status: "paid",
    issued: { date: "2026-06-01T06:00:00.000Z", label: "1 June" },
    due: "20 June",
  },
  {
    id: "4651",
    period: "April",
    usage: 1180,
    amount: 1402.7,
    status: "paid",
    issued: { date: "2026-05-01T06:00:00.000Z", label: "1 May" },
    due: "20 May",
  },
  {
    id: "4617",
    period: "March",
    usage: 1420,
    amount: 1655.1,
    status: "paid",
    issued: { date: "2026-04-01T06:00:00.000Z", label: "1 April" },
    due: "20 April",
  },
  {
    id: "4583",
    period: "February",
    usage: 1610,
    amount: 1890.4,
    status: "paid",
    issued: { date: "2026-03-01T06:00:00.000Z", label: "1 March" },
    due: "20 March",
  },
] as const;

const PAGE_SIZE = 4;
const PAGES = Array.from({ length: Math.ceil(INVOICES.length / PAGE_SIZE) }, (_, index) => index + 1);

type Invoice = (typeof INVOICES)[number];

const STATUS = {
  due: { label: "Due", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
} as const satisfies Record<Invoice["status"], { label: string; variant: "warning" | "success" }>;

/** Invoices: a selectable table, and the picked invoice's details and history beside it. */
export function InvoicesTab(): ReactElement {
  const toastManager = Toast.useToastManager();
  const [selected, setSelected] = useState<Invoice["id"]>("4821");
  const [page, setPage] = useState(1);
  const invoice = INVOICES.find((entry) => entry.id === selected) ?? INVOICES[0];
  const rows = INVOICES.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function goTo(next: number) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      setPage(Math.min(PAGES.length, Math.max(1, next)));
    };
  }

  return (
    <>
      <Labelled
        parts={[
          { name: "Table", slug: "table" },
          { name: "Badge", slug: "badge" },
          { name: "Pagination", slug: "pagination" },
        ]}>
        <Card.Root>
          <Card.Header>
            <Card.Title>Invoices</Card.Title>
            <Card.Description>Storgata 1, Bergen. Pick one to see its details.</Card.Description>
          </Card.Header>
          <Card.Content>
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Invoice</Table.Head>
                  <Table.Head>Period</Table.Head>
                  <Table.Head className={styles.amount()}>NOK</Table.Head>
                  <Table.Head>Status</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((entry) => (
                  <Table.Row key={entry.id} data-state={entry.id === selected ? "selected" : undefined}>
                    <Table.Cell>
                      <button
                        type="button"
                        aria-pressed={entry.id === selected}
                        className={styles.invoiceLink()}
                        onClick={() => setSelected(entry.id)}>
                        {entry.id}
                      </button>
                    </Table.Cell>
                    <Table.Cell>{entry.period}</Table.Cell>
                    <Table.Cell className={styles.amount()}>{nok.format(entry.amount)}</Table.Cell>
                    <Table.Cell>
                      <Badge variant={STATUS[entry.status].variant} size="sm">
                        {STATUS[entry.status].label}
                      </Badge>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card.Content>
          <Card.Footer>
            <Pagination.Root>
              <Pagination.Content>
                <Pagination.Item>
                  <Pagination.Previous href="#invoices-previous" onClick={goTo(page - 1)} />
                </Pagination.Item>
                {PAGES.map((number) => (
                  <Pagination.Item key={number}>
                    <Pagination.Link
                      href={`#invoices-${String(number)}`}
                      isActive={number === page}
                      onClick={goTo(number)}>
                      {number}
                    </Pagination.Link>
                  </Pagination.Item>
                ))}
                <Pagination.Item>
                  <Pagination.Next href="#invoices-next" onClick={goTo(page + 1)} />
                </Pagination.Item>
              </Pagination.Content>
            </Pagination.Root>
          </Card.Footer>
        </Card.Root>
      </Labelled>
      <Labelled
        parts={[
          { name: "DescriptionList", slug: "description-list" },
          { name: "TimelineList", slug: "timeline-list" },
          { name: "Button", slug: "button" },
        ]}>
        <Card.Root>
          <Card.Header>
            <Card.Title>{`Invoice ${invoice.id}`}</Card.Title>
            <Card.Description>{`${invoice.period} · ${String(invoice.usage)} kWh`}</Card.Description>
          </Card.Header>
          <Card.Content className={stack}>
            <DescriptionList.Root>
              <DescriptionList.Content>
                <DescriptionList.Term>Amount</DescriptionList.Term>
                <DescriptionList.Details>{`NOK ${nok.format(invoice.amount)}`}</DescriptionList.Details>
                <DescriptionList.Term>Due</DescriptionList.Term>
                <DescriptionList.Details>{invoice.due}</DescriptionList.Details>
                <DescriptionList.Term>Payment</DescriptionList.Term>
                <DescriptionList.Details>AvtaleGiro</DescriptionList.Details>
              </DescriptionList.Content>
            </DescriptionList.Root>
            <TimelineList.Root>
              <TimelineList.Item>
                <TimelineList.Title>Invoice issued</TimelineList.Title>
                <TimelineList.Time date={invoice.issued.date}>{invoice.issued.label}</TimelineList.Time>
              </TimelineList.Item>
              <TimelineList.Item>
                <TimelineList.Title>
                  {invoice.status === "paid" ? "Paid by AvtaleGiro" : "Payment scheduled"}
                </TimelineList.Title>
                <TimelineList.Description>{`On ${invoice.due}.`}</TimelineList.Description>
              </TimelineList.Item>
            </TimelineList.Root>
            <Button
              variant="outline"
              onClick={() => {
                toastManager.add({
                  type: "success",
                  title: `Invoice ${invoice.id} downloaded`,
                  description: `faktura-${invoice.id}.pdf`,
                });
              }}>
              <Download data-icon="inline-start" />
              Download PDF
            </Button>
          </Card.Content>
        </Card.Root>
      </Labelled>
    </>
  );
}

type AddOn = { value: string; title: string; description: string; tags?: string[] };

const ADD_ONS: readonly AddOn[] = [
  {
    value: "cap",
    title: "Price cap",
    description: "Never above 150 øre/kWh. NOK 39 a month.",
    tags: ["Popular"],
  },
  { value: "solar", title: "Solar buy-back", description: "Sell what your panels make at spot price." },
  { value: "insurance", title: "Electrical insurance", description: "Covers the wiring in your home." },
];

/** Agreements: the contract's terms, and add-ons the customer can change and save. */
export function AgreementsTab(): ReactElement {
  const toastManager = Toast.useToastManager();
  const [addOns, setAddOns] = useState<string[]>(["cap"]);

  return (
    <>
      <Labelled
        parts={[
          { name: "DescriptionList", slug: "description-list" },
          { name: "Accordion", slug: "accordion" },
        ]}>
        <Card.Root>
          <Card.Header>
            <Card.Title>Spot price</Card.Title>
            <Card.Description>Storgata 1, Bergen. Since March 2024.</Card.Description>
          </Card.Header>
          <Card.Content className={stack}>
            <DescriptionList.Root>
              <DescriptionList.Content>
                <DescriptionList.Term>Markup</DescriptionList.Term>
                <DescriptionList.Details>4.9 øre/kWh</DescriptionList.Details>
                <DescriptionList.Term>Monthly fee</DescriptionList.Term>
                <DescriptionList.Details>NOK 49</DescriptionList.Details>
                <DescriptionList.Term>Binding</DescriptionList.Term>
                <DescriptionList.Details>None</DescriptionList.Details>
              </DescriptionList.Content>
            </DescriptionList.Root>
            <Accordion.Root defaultValue={["price"]}>
              <Accordion.Item value="price">
                <Accordion.Header>
                  <Accordion.Trigger>How the price is set</Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content>
                  You pay the hourly spot price in your price area, plus the markup and the monthly fee.
                </Accordion.Content>
              </Accordion.Item>
              <Accordion.Item value="notice">
                <Accordion.Header>
                  <Accordion.Trigger>Changes and notice</Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content>
                  We give you 30 days notice before the markup or the fee changes.
                </Accordion.Content>
              </Accordion.Item>
              <Accordion.Item value="cancel">
                <Accordion.Header>
                  <Accordion.Trigger>Cancelling</Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content>
                  Cancel any time. The agreement ends 14 days after you tell us.
                </Accordion.Content>
              </Accordion.Item>
            </Accordion.Root>
          </Card.Content>
        </Card.Root>
      </Labelled>
      <Labelled
        parts={[
          { name: "CheckboxCard", slug: "checkbox-card" },
          { name: "Button", slug: "button" },
          { name: "Toast", slug: "toast" },
        ]}>
        <Card.Root>
          <Card.Header>
            <Card.Title>Add-ons</Card.Title>
            <Card.Description>Changes apply from the next invoice.</Card.Description>
          </Card.Header>
          <Card.Content className={stack}>
            <CheckboxGroup name="add-ons" label="Add-ons" value={addOns} onChange={setAddOns}>
              {ADD_ONS.map((addOn) => (
                <CheckboxCard
                  key={addOn.value}
                  value={addOn.value}
                  title={addOn.title}
                  description={addOn.description}
                  tags={addOn.tags}
                />
              ))}
            </CheckboxGroup>
            <Button
              onClick={() => {
                toastManager.add({
                  type: "success",
                  title: "Add-ons saved",
                  description: `${String(addOns.length)} active from 1 November.`,
                });
              }}>
              Save add-ons
            </Button>
          </Card.Content>
        </Card.Root>
      </Labelled>
    </>
  );
}

const METER_KEYS = ["home", "cabin"] as const;

type MeterKey = (typeof METER_KEYS)[number];

const METERS = {
  home: { label: "Storgata 1 · 7070575000", remote: true, peak: 7.2, grid: "BKK Nett", area: "NO5, West" },
  cabin: {
    label: "Hytta, Geilo · 7070575031",
    remote: false,
    peak: 3.1,
    grid: "Hallingdal Kraftnett",
    area: "NO1, East",
  },
} as const satisfies Record<
  MeterKey,
  { label: string; remote: boolean; peak: number; grid: string; area: string }
>;

const METER_ITEMS = Object.fromEntries(METER_KEYS.map((key) => [key, METERS[key].label]));

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Meters: a manual reading for meters without remote reading, and the picked meter's details. */
export function MetersTab(): ReactElement {
  const toastManager = Toast.useToastManager();
  const [meter, setMeter] = useState<MeterKey>("cabin");
  const [pending, setPending] = useState(false);
  const picked = METERS[meter];

  return (
    <>
      <Labelled
        parts={[
          { name: "Alert", slug: "alert" },
          { name: "Select", slug: "select" },
          { name: "NumberField", slug: "number-field" },
          { name: "Button", slug: "button" },
        ]}>
        <Card.Root>
          <Card.Header>
            <Card.Title>Meter reading</Card.Title>
            <Card.Description>Only needed for meters without remote reading.</Card.Description>
          </Card.Header>
          <Card.Content>
            <form
              className={stack}
              onSubmit={(event) => {
                event.preventDefault();
                setPending(true);
                void toastManager
                  .promise(wait(1100), {
                    loading: "Sending reading…",
                    success: { title: "Reading saved", description: "Your next invoice uses it." },
                    error: "Could not save the reading.",
                  })
                  .finally(() => setPending(false));
              }}>
              {picked.remote ? (
                <Alert.Root>
                  <Alert.Title>Read remotely</Alert.Title>
                  <Alert.Description>
                    This meter sends a reading every hour. You don't need to enter one.
                  </Alert.Description>
                </Alert.Root>
              ) : (
                <Alert.Root variant="warning">
                  <Alert.Title>Reading due</Alert.Title>
                  <Alert.Description>Enter the number on the display by 31 October.</Alert.Description>
                </Alert.Root>
              )}
              <Field.Root>
                <Field.Label>Meter</Field.Label>
                <Select.Root
                  items={METER_ITEMS}
                  value={meter}
                  onValueChange={(next) => {
                    const key = METER_KEYS.find((candidate) => candidate === next);
                    if (key !== undefined) {
                      setMeter(key);
                    }
                  }}>
                  <Select.Trigger className="w-full">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {METER_KEYS.map((key) => (
                      <Select.Item key={key} value={key}>
                        {METERS[key].label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Field.Root>
              <NumberField
                label="Reading"
                description="The number on the display, without decimals."
                denomination="kWh"
                minValue={0}
                defaultValue={21480}
                isDisabled={picked.remote}
              />
              <div className={styles.actions()}>
                <Button type="submit" isPending={pending} disabled={picked.remote}>
                  {pending ? "Sending…" : "Send reading"}
                </Button>
              </div>
            </form>
          </Card.Content>
        </Card.Root>
      </Labelled>
      <Labelled
        parts={[
          { name: "DescriptionList", slug: "description-list" },
          { name: "Meter", slug: "meter" },
        ]}>
        <Card.Root>
          <Card.Header>
            <Card.Title>{picked.label}</Card.Title>
            <Card.Description>
              {picked.remote ? "Smart meter, read hourly" : "Manual reading"}
            </Card.Description>
          </Card.Header>
          <Card.Content className={stack}>
            <DescriptionList.Root>
              <DescriptionList.Content>
                <DescriptionList.Term>Grid company</DescriptionList.Term>
                <DescriptionList.Details>{picked.grid}</DescriptionList.Details>
                <DescriptionList.Term>Price area</DescriptionList.Term>
                <DescriptionList.Details>{picked.area}</DescriptionList.Details>
              </DescriptionList.Content>
            </DescriptionList.Root>
            <Meter
              label="Peak load this month"
              value={picked.peak}
              maxValue={10}
              valueLabel={`${String(picked.peak)} of 10 kW`}
            />
          </Card.Content>
        </Card.Root>
      </Labelled>
    </>
  );
}
