"use client";

import { useState } from "react";
import type { FormEvent, MouseEvent, ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { Checkbox } from "@elmeragroup/fuse/checkbox";
import { Combobox } from "@elmeragroup/fuse/combobox";
import { DescriptionList } from "@elmeragroup/fuse/description-list";
import { Dialog } from "@elmeragroup/fuse/dialog";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { Field } from "@elmeragroup/fuse/field";
import { Form } from "@elmeragroup/fuse/form";
import { Heading } from "@elmeragroup/fuse/heading";
import { DotsThree, MagnifyingGlass, UserPlus } from "@elmeragroup/fuse/icons";
import { Pagination } from "@elmeragroup/fuse/pagination";
import { Select } from "@elmeragroup/fuse/select";
import { Table } from "@elmeragroup/fuse/table";
import { Text } from "@elmeragroup/fuse/text";
import { TextField } from "@elmeragroup/fuse/text-field";

const adminTableScreen = tv({
  slots: {
    root: "flex flex-col gap-4 p-6",
    head: "flex items-center justify-between gap-4",
    toolbar: "flex flex-wrap items-center gap-2",
    search: "w-56",
    filter: "w-40",
    check: "w-8",
    number: "font-mono tabular-nums",
    amount: "text-right tabular-nums",
    action: "w-10 text-right",
    foot: "flex items-center justify-between gap-4",
    pagination: "mx-0 w-auto",
    form: "flex flex-col gap-4",
  },
});

const styles = adminTableScreen();

type Status = "active" | "paused" | "closed";

const STATUSES = { all: "All statuses", active: "Active", paused: "Paused", closed: "Closed" } as const;

type StatusFilter = keyof typeof STATUSES;

const STATUS_BADGES = {
  active: "success",
  paused: "warning",
  closed: "secondary",
} as const satisfies Record<Status, "success" | "warning" | "secondary">;

const REGIONS = ["North", "Central", "West", "South", "East"] as const;

type Region = (typeof REGIONS)[number];

const REGION_ITEMS = REGIONS.map((region) => ({ value: region, label: region }));

const ADD_FORM_ID = "admin-add-customer";

type Customer = {
  readonly id: string;
  readonly name: string;
  readonly region: Region;
  readonly status: Status;
  readonly balance: string;
};

const CUSTOMERS: readonly Customer[] = [
  { id: "40213", name: "Nora Haugen", region: "West", status: "active", balance: "NOK 1 240" },
  { id: "40214", name: "Emil Larsen", region: "Central", status: "paused", balance: "NOK 0" },
  { id: "40219", name: "Sara Lund", region: "North", status: "active", balance: "NOK 312" },
  { id: "40221", name: "Jonas Berg", region: "South", status: "closed", balance: "NOK 0" },
  { id: "40227", name: "Ida Moen", region: "East", status: "active", balance: "NOK 2 085" },
  { id: "40230", name: "Lukas Dahl", region: "West", status: "active", balance: "NOK 96" },
  { id: "40232", name: "Maja Solberg", region: "North", status: "active", balance: "NOK 540" },
  { id: "40235", name: "Henrik Strand", region: "Central", status: "active", balance: "NOK 1 015" },
  { id: "40238", name: "Ingrid Bakke", region: "West", status: "paused", balance: "NOK 0" },
  { id: "40241", name: "Oskar Lie", region: "South", status: "active", balance: "NOK 288" },
  { id: "40244", name: "Thea Ruud", region: "East", status: "active", balance: "NOK 760" },
  { id: "40247", name: "Filip Nygaard", region: "Central", status: "closed", balance: "NOK 0" },
  { id: "40250", name: "Emma Vik", region: "North", status: "active", balance: "NOK 1 430" },
  { id: "40253", name: "Mathias Eide", region: "West", status: "active", balance: "NOK 205" },
  { id: "40256", name: "Sofie Holm", region: "South", status: "paused", balance: "NOK 0" },
  { id: "40259", name: "Kristian Aas", region: "East", status: "active", balance: "NOK 615" },
  { id: "40262", name: "Hanna Lunde", region: "Central", status: "active", balance: "NOK 1 890" },
  { id: "40265", name: "Sander Berge", region: "North", status: "closed", balance: "NOK 0" },
  { id: "40268", name: "Julie Moe", region: "West", status: "active", balance: "NOK 342" },
  { id: "40271", name: "Tobias Hagen", region: "South", status: "active", balance: "NOK 1 120" },
  { id: "40274", name: "Ella Myhre", region: "East", status: "paused", balance: "NOK 0" },
  { id: "40277", name: "Elias Tangen", region: "Central", status: "active", balance: "NOK 470" },
  { id: "40280", name: "Amalie Fjeld", region: "North", status: "active", balance: "NOK 935" },
  { id: "40283", name: "Martin Sæther", region: "West", status: "closed", balance: "NOK 0" },
];

const PAGE_SIZE = 6;

type Filters = {
  readonly query: string;
  readonly status: StatusFilter;
  readonly region: string | null;
};

/** The customers the filters keep: the query matches a name or a customer number. */
function matching(customers: readonly Customer[], { query, status, region }: Filters): readonly Customer[] {
  const needle = query.trim().toLowerCase();
  return customers.filter(
    (customer) =>
      (needle === "" || customer.name.toLowerCase().includes(needle) || customer.id.includes(needle)) &&
      (status === "all" || customer.status === status) &&
      (region === null || customer.region === region)
  );
}

/**
 * An internal customer list in the dense, internal look: a toolbar whose search, status and
 * region filter the table, a table with row selection and a menu per row, and pagination over
 * the matching customers. The selection is kept by customer, so it survives paging and
 * filtering, and every count reads the same list. A row's menu opens the customer's profile,
 * pauses or resumes deliveries and closes or reopens the account; "Add customer" adds one at the
 * top of the list.
 */
export function AdminTableScreen(): ReactElement {
  const [customers, setCustomers] = useState<readonly Customer[]>(CUSTOMERS);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(["40214"]));
  const [filters, setFilters] = useState<Filters>({ query: "", status: "all", region: null });
  const [page, setPage] = useState(1);
  const [profile, setProfile] = useState<Customer | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const rows = matching(customers, filters);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const shownSelected = shown.filter((customer) => selected.has(customer.id)).length;
  const all = shown.length > 0 && shownSelected === shown.length;

  const filter = (change: Partial<Filters>) => {
    setFilters({ ...filters, ...change });
    setPage(1);
  };

  const toggle = (ids: readonly string[], checked: boolean) => {
    const next = new Set(selected);
    for (const id of ids) {
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
    }
    setSelected(next);
  };

  const goTo = (next: number) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setPage(Math.min(pages, Math.max(1, next)));
  };

  const setStatus = (id: string, status: Status) => {
    setCustomers(customers.map((customer) => (customer.id === id ? { ...customer, status } : customer)));
  };

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = data.get("name");
    if (name === null || name instanceof File) {
      return;
    }
    const region = REGIONS.find((entry) => entry === data.get("region")) ?? "Central";
    // Customer numbers step by three, as the list's do.
    const id = String(Math.max(...customers.map((customer) => Number(customer.id))) + 3);
    setCustomers([{ id, name: name.trim(), region, status: "active", balance: "NOK 0" }, ...customers]);
    setFilters({ query: "", status: "all", region: null });
    setPage(1);
    setAdding(false);
  };

  return (
    <div className={styles.root()}>
      <div className={styles.head()}>
        <Heading level={2} size="lg">
          Customers
        </Heading>
        <Button
          size="sm"
          onClick={() => {
            setAdding(true);
          }}>
          <UserPlus data-icon="inline-start" aria-hidden />
          Add customer
        </Button>
        <Dialog.Root open={adding} onOpenChange={setAdding}>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Add customer</Dialog.Title>
              <Dialog.Description>The customer starts active, with nothing owed.</Dialog.Description>
            </Dialog.Header>
            <Form id={ADD_FORM_ID} className={styles.form()} onSubmit={add}>
              <TextField label="Name" name="name" isRequired autoComplete="off" />
              <Field.Root name="region">
                <Field.Label>Region</Field.Label>
                <Select.Root items={REGION_ITEMS} defaultValue="Central">
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content alignItemWithTrigger={false}>
                    {REGIONS.map((region) => (
                      <Select.Item key={region} value={region}>
                        {region}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Field.Root>
            </Form>
            <Dialog.Footer>
              <Dialog.Close render={<Button variant="outline" />}>Cancel</Dialog.Close>
              <Button type="submit" form={ADD_FORM_ID}>
                Add customer
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
      </div>
      <div className={styles.toolbar()}>
        <TextField
          aria-label="Search customers"
          placeholder="Search by name or number"
          icon={<MagnifyingGlass />}
          className={styles.search()}
          value={filters.query}
          onChange={(query) => {
            filter({ query });
          }}
        />
        <Select.Root
          items={STATUSES}
          value={filters.status}
          onValueChange={(status: StatusFilter | null) => {
            filter({ status: status ?? "all" });
          }}>
          <Select.Trigger aria-label="Status" className={styles.filter()}>
            <Select.Value />
          </Select.Trigger>
          {/* Item alignment would misplace the popup inside the artboard's transformed scope. */}
          <Select.Content alignItemWithTrigger={false}>
            {Object.entries(STATUSES).map(([value, label]) => (
              <Select.Item key={value} value={value}>
                {label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
        <Combobox.Root
          items={[...REGIONS]}
          value={filters.region}
          onValueChange={(region: string | null) => {
            filter({ region });
          }}>
          <Combobox.Input
            aria-label="Region"
            placeholder="Any region"
            showClear
            className={styles.filter()}
          />
          <Combobox.Content>
            <Combobox.Empty>No region matches.</Combobox.Empty>
            <Combobox.List>
              <Combobox.Collection>
                {(region: string) => (
                  <Combobox.Item key={region} value={region}>
                    {region}
                  </Combobox.Item>
                )}
              </Combobox.Collection>
            </Combobox.List>
          </Combobox.Content>
        </Combobox.Root>
      </div>
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head className={styles.check()}>
              <Checkbox
                aria-label="Select the customers on this page"
                checked={all}
                indeterminate={shownSelected > 0 && !all}
                disabled={shown.length === 0}
                onCheckedChange={(checked) => {
                  toggle(
                    shown.map((customer) => customer.id),
                    checked
                  );
                }}
              />
            </Table.Head>
            <Table.Head>Customer</Table.Head>
            <Table.Head>Number</Table.Head>
            <Table.Head>Region</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head className={styles.amount()}>Balance</Table.Head>
            <Table.Head className={styles.action()}>
              <span className="sr-only">Actions</span>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {shown.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={7}>
                <Text size="sm" variant="muted">
                  No customers match these filters.
                </Text>
              </Table.Cell>
            </Table.Row>
          ) : null}
          {shown.map((customer) => (
            <Table.Row key={customer.id} data-state={selected.has(customer.id) ? "selected" : undefined}>
              <Table.Cell>
                <Checkbox
                  aria-label={`Select ${customer.name}`}
                  checked={selected.has(customer.id)}
                  onCheckedChange={(checked) => {
                    toggle([customer.id], checked);
                  }}
                />
              </Table.Cell>
              <Table.Cell>{customer.name}</Table.Cell>
              <Table.Cell className={styles.number()}>{customer.id}</Table.Cell>
              <Table.Cell>{customer.region}</Table.Cell>
              <Table.Cell>
                <Badge variant={STATUS_BADGES[customer.status]}>{STATUSES[customer.status]}</Badge>
              </Table.Cell>
              <Table.Cell className={styles.amount()}>{customer.balance}</Table.Cell>
              <Table.Cell className={styles.action()}>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger
                    render={
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${customer.name}`} />
                    }>
                    <DotsThree aria-hidden />
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end">
                    <DropdownMenu.Item
                      onClick={() => {
                        setProfile(customer);
                      }}>
                      Open profile
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      disabled={customer.status === "closed"}
                      onClick={() => {
                        setStatus(customer.id, customer.status === "paused" ? "active" : "paused");
                      }}>
                      {customer.status === "paused" ? "Resume deliveries" : "Pause deliveries"}
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator />
                    {customer.status === "closed" ? (
                      <DropdownMenu.Item
                        onClick={() => {
                          setStatus(customer.id, "active");
                        }}>
                        Reopen account
                      </DropdownMenu.Item>
                    ) : (
                      <DropdownMenu.Item
                        variant="destructive"
                        onClick={() => {
                          setStatus(customer.id, "closed");
                        }}>
                        Close account
                      </DropdownMenu.Item>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      <div className={styles.foot()}>
        <Text size="sm" variant="muted">
          {`${String(selected.size)} selected · ${
            rows.length === customers.length
              ? `${String(customers.length)} customers`
              : `${String(rows.length)} of ${String(customers.length)} customers`
          }`}
        </Text>
        <Pagination.Root className={styles.pagination()}>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous href="#previous" onClick={goTo(current - 1)} />
            </Pagination.Item>
            {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
              <Pagination.Item key={number}>
                <Pagination.Link
                  href={`#page-${String(number)}`}
                  isActive={number === current}
                  onClick={goTo(number)}>
                  {number}
                </Pagination.Link>
              </Pagination.Item>
            ))}
            <Pagination.Item>
              <Pagination.Next href="#next" onClick={goTo(current + 1)} />
            </Pagination.Item>
          </Pagination.Content>
        </Pagination.Root>
      </div>
      <Dialog.Root
        open={profile !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setProfile(undefined);
          }
        }}>
        {profile === undefined ? null : (
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{profile.name}</Dialog.Title>
              <Dialog.Description>{`Customer ${profile.id}`}</Dialog.Description>
            </Dialog.Header>
            <DescriptionList.Root>
              <DescriptionList.Content>
                <DescriptionList.Term>Region</DescriptionList.Term>
                <DescriptionList.Details>{profile.region}</DescriptionList.Details>
                <DescriptionList.Term>Status</DescriptionList.Term>
                <DescriptionList.Details>{STATUSES[profile.status]}</DescriptionList.Details>
                <DescriptionList.Term>Balance</DescriptionList.Term>
                <DescriptionList.Details className={styles.number()}>
                  {profile.balance}
                </DescriptionList.Details>
              </DescriptionList.Content>
            </DescriptionList.Root>
            <Dialog.Footer>
              <Dialog.Close render={<Button variant="outline" />}>Close</Dialog.Close>
            </Dialog.Footer>
          </Dialog.Content>
        )}
      </Dialog.Root>
    </div>
  );
}
