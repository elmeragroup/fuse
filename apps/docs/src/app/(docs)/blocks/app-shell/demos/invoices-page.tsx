"use client";

/**
 * Invoices: February's invoices with a status filter, sortable due dates and amounts in kr, and a
 * Sheet with one invoice's lines, VAT and payment. A row press opens the Sheet; the invoice number
 * is a button, so a keyboard reaches what the press does.
 */

import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import {
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from "@tanstack/react-table";

import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { createFuseTableHook } from "@elmeragroup/fuse/data-table";
import { DescriptionList } from "@elmeragroup/fuse/description-list";
import { PaperPlaneTilt } from "@elmeragroup/fuse/icons";
import { Sheet } from "@elmeragroup/fuse/sheet";
import { Table } from "@elmeragroup/fuse/table";
import { Toast } from "@elmeragroup/fuse/toast";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

import { APP_LOCALE } from "./app-config";
import { PageHeader } from "./page-header";
import { CONTRACT_LABELS, INVOICES, PRICE_AREA_NAMES, TIME_ZONE, VAT_RATE } from "./power-data";
import type { Invoice, InvoiceState } from "./power-data";

type StateTag = InvoiceState["_tag"];

/** Each state's badge: its label and its tone. */
const STATE_BADGES = {
  Paid: { label: "Paid", variant: "soft-success" },
  Open: { label: "Open", variant: "soft-info" },
  Overdue: { label: "Overdue", variant: "soft-destructive" },
  Credited: { label: "Credited", variant: "muted" },
} as const satisfies Record<StateTag, { label: string; variant: string }>;

/** The status filter's choices: every invoice, or one state. */
const SHOWS = ["all", "Open", "Overdue", "Paid", "Credited"] as const;
type Show = (typeof SHOWS)[number];

const kroner = new Intl.NumberFormat(APP_LOCALE, {
  style: "currency",
  currency: "NOK",
  currencyDisplay: "narrowSymbol",
});
const longDate = new Intl.DateTimeFormat(APP_LOCALE, { timeZone: TIME_ZONE, dateStyle: "long" });
const percent = new Intl.NumberFormat(APP_LOCALE, { style: "percent" });

const { useAppTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({
    rowSortingFeature,
    rowPaginationFeature,
    sortedRowModel: createSortedRowModel(),
    paginatedRowModel: createPaginatedRowModel(),
    sortFns,
  }),
  getRowId: (invoice: Invoice) => invoice.number,
});

const columns = createAppColumnHelper<Invoice>();

/** The columns, with the opener the invoice number cell renders. */
function invoiceColumns(open: (invoice: Invoice) => void) {
  return columns.columns([
    columns.accessor("number", {
      header: "Invoice",
      cell: ({ row }) => (
        // A link-styled Button keeps Fuse's focus ring and target size; the number reads in mono.
        // It pulls back by its own inline padding, so the number lines up with the column's header.
        <Button
          variant="link"
          size="xs"
          className="-ms-(--control-px-button-xs)"
          onClick={() => {
            open(row.original);
          }}>
          <span className="text-sm font-mono tabular-nums">{row.original.number}</span>
        </Button>
      ),
    }),
    columns.accessor("customer", {
      header: ({ header }) => <header.SortButton>Customer</header.SortButton>,
      cell: ({ cell }) => <cell.TextCell />,
    }),
    columns.accessor((invoice) => invoice.state._tag, {
      id: "state",
      header: "Status",
      cell: ({ row }) => (
        <Badge size="sm" variant={STATE_BADGES[row.original.state._tag].variant}>
          {STATE_BADGES[row.original.state._tag].label}
        </Badge>
      ),
    }),
    columns.accessor("dueOn", {
      header: ({ header }) => <header.SortButton>Due</header.SortButton>,
      sortFn: "datetime",
      cell: ({ cell }) => <cell.DateCell />,
    }),
    columns.accessor("total", {
      // Amounts line up on their last digit, so the header and the figures sit at the end.
      header: ({ header }) => (
        <span className="flex justify-end">
          <header.SortButton>Amount</header.SortButton>
        </span>
      ),
      cell: ({ cell }) => (
        <span className="block text-right">
          <cell.CurrencyCell currency="NOK" currencyDisplay="narrowSymbol" />
        </span>
      ),
    }),
  ]);
}

/** One invoice in the Sheet: its customer and contract, its lines and what happened to it. */
function InvoiceDetail({ invoice }: { invoice: Invoice }): ReactElement {
  const toasts = Toast.useToastManager();
  const subtotal = invoice.total - invoice.vat;
  const { state } = invoice;
  return (
    <>
      <Sheet.Header>
        <div className="flex items-center gap-2">
          <Sheet.Title>{invoice.number}</Sheet.Title>
          <Badge size="sm" variant={STATE_BADGES[state._tag].variant}>
            {STATE_BADGES[state._tag].label}
          </Badge>
        </div>
        <Sheet.Description>
          {invoice.customer}, February 2026. {kroner.format(invoice.total)} due{" "}
          {longDate.format(invoice.dueOn)}.
        </Sheet.Description>
      </Sheet.Header>
      <Sheet.Body>
        <div className="flex flex-col gap-6">
          <DescriptionList.Root>
            <DescriptionList.Content>
              <DescriptionList.Item>
                <DescriptionList.Term>Metering point</DescriptionList.Term>
                <DescriptionList.Details>
                  <span className="font-mono tabular-nums">{invoice.meteringPointId}</span>
                </DescriptionList.Details>
              </DescriptionList.Item>
              <DescriptionList.Item>
                <DescriptionList.Term>Price area</DescriptionList.Term>
                <DescriptionList.Details>
                  {invoice.priceArea}, {PRICE_AREA_NAMES[invoice.priceArea]}
                </DescriptionList.Details>
              </DescriptionList.Item>
              <DescriptionList.Item>
                <DescriptionList.Term>Contract</DescriptionList.Term>
                <DescriptionList.Details>{CONTRACT_LABELS[invoice.contract]}</DescriptionList.Details>
              </DescriptionList.Item>
              <DescriptionList.Item>
                <DescriptionList.Term>Issued</DescriptionList.Term>
                <DescriptionList.Details>{longDate.format(invoice.issuedOn)}</DescriptionList.Details>
              </DescriptionList.Item>
              {state._tag === "Paid" ? (
                <DescriptionList.Item>
                  <DescriptionList.Term>Paid</DescriptionList.Term>
                  <DescriptionList.Details>{longDate.format(state.paidOn)}</DescriptionList.Details>
                </DescriptionList.Item>
              ) : null}
              {state._tag === "Credited" ? (
                <DescriptionList.Item>
                  <DescriptionList.Term>Credit note</DescriptionList.Term>
                  <DescriptionList.Details>
                    <span className="font-mono">{state.creditNote}</span>
                  </DescriptionList.Details>
                </DescriptionList.Item>
              ) : null}
            </DescriptionList.Content>
          </DescriptionList.Root>

          <Table.Root>
            <Table.Caption className="sr-only">Invoice lines</Table.Caption>
            <Table.Header>
              <Table.Row>
                <Table.Head>Line</Table.Head>
                <Table.Head className="text-right">Amount</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {invoice.lines.map((line) => (
                <Table.Row key={line.label}>
                  <Table.Cell>
                    <span className="block">{line.label}</span>
                    {line.detail === "" ? null : (
                      <span className="text-xs block text-muted-foreground tabular-nums">{line.detail}</span>
                    )}
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <span className="tabular-nums">{kroner.format(line.amount)}</span>
                  </Table.Cell>
                </Table.Row>
              ))}
              <Table.Row>
                <Table.Cell>
                  {invoice.vat === 0
                    ? "VAT, not charged in Northern Norway"
                    : `VAT, ${percent.format(VAT_RATE)} of ${kroner.format(subtotal)}`}
                </Table.Cell>
                <Table.Cell className="text-right">
                  <span className="tabular-nums">{kroner.format(invoice.vat)}</span>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
            <Table.Footer>
              <Table.Row>
                <Table.Cell>
                  <span className="font-medium">Total</span>
                </Table.Cell>
                <Table.Cell className="text-right">
                  <span className="font-medium tabular-nums">{kroner.format(invoice.total)}</span>
                </Table.Cell>
              </Table.Row>
            </Table.Footer>
          </Table.Root>
        </div>
      </Sheet.Body>
      {/* One row from sm, the primary action last; stacked full width on a phone. */}
      <Sheet.Footer className="sm:flex-row sm:justify-end">
        <Sheet.Close render={<Button variant="outline" />}>Close</Sheet.Close>
        {state._tag === "Overdue" ? (
          <Button
            onClick={() => {
              toasts.add({
                type: "success",
                title: "Reminder sent",
                description: `${invoice.customer} gets a reminder for ${invoice.number}.`,
              });
            }}>
            <PaperPlaneTilt data-icon="inline-start" />
            Send reminder
          </Button>
        ) : null}
      </Sheet.Footer>
    </>
  );
}

/** The invoices page. */
export function InvoicesPage(): ReactElement {
  const [show, setShow] = useState<Show>("all");
  // The open invoice, kept while the Sheet animates out so its content does not empty first.
  const [opened, setOpened] = useState<Invoice | undefined>(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);
  const counts = useMemo(
    () =>
      new Map(
        SHOWS.map((choice) => [
          choice,
          INVOICES.filter((invoice) => choice === "all" || invoice.state._tag === choice).length,
        ])
      ),
    []
  );
  const data = useMemo(
    () => INVOICES.filter((invoice) => show === "all" || invoice.state._tag === show),
    [show]
  );
  const open = useMemo(
    () => (invoice: Invoice) => {
      setOpened(invoice);
      setSheetOpen(true);
    },
    []
  );
  const tableColumns = useMemo(() => invoiceColumns(open), [open]);
  const table = useAppTable({
    columns: tableColumns,
    data,
    initialState: { pagination: { pageIndex: 0, pageSize: 25 }, sorting: [{ id: "dueOn", desc: false }] },
  });

  return (
    <>
      <PageHeader page="Invoices" />
      <div className="md:px-6 flex min-w-0 flex-col gap-3 px-4 pt-2 pb-8">
        <div className="md:mx-0 md:px-0 -mx-4 overflow-x-auto px-4 py-1">
          <ToggleGroup.Root
            aria-label="Show invoices"
            value={[show]}
            onValueChange={(value: string[]) => {
              const next = SHOWS.find((choice) => choice === value[0]);
              if (next !== undefined) setShow(next);
            }}>
            {SHOWS.map((choice) => (
              <ToggleGroup.Item key={choice} value={choice}>
                {choice === "all" ? "All" : STATE_BADGES[choice].label}
                <span className="text-xs text-muted-foreground tabular-nums">{counts.get(choice)}</span>
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </div>
        <table.AppTable>
          <table.Content aria-label="Invoices">
            {(row) => (
              <table.Row
                row={row}
                onPress={() => {
                  open(row.original);
                }}
              />
            )}
          </table.Content>
          <table.Pagination pageSizes={[10, 25, 50]} />
        </table.AppTable>
      </div>
      <Sheet.Root open={sheetOpen} onOpenChange={setSheetOpen}>
        <Sheet.Content size="lg">
          {opened === undefined ? null : <InvoiceDetail invoice={opened} />}
        </Sheet.Content>
      </Sheet.Root>
    </>
  );
}
