"use client";

import { useState } from "react";

import { Command } from "@elmeragroup/fuse/command";

type Customer = { readonly id: string; readonly label: string };

const CUSTOMERS: readonly Customer[] = [
  { id: "ada", label: "Ada Lovelace" },
  { id: "grace", label: "Grace Hopper" },
  { id: "katherine", label: "Katherine Johnson" },
  { id: "margaret", label: "Margaret Hamilton" },
];

const HOME = [
  { label: "Customers", page: "customers" },
  { label: "Open invoices", page: null },
  { label: "Open meter readings", page: null },
] as const;

const CUSTOMER_ACTIONS = ["Open customer", "Register meter reading", "Send invoice copy"];

/** Customers open a page of customers, and each customer a page of actions. */
export function CommandPages() {
  const [lastRun, setLastRun] = useState("");
  return (
    <div className="max-w-xl flex w-full flex-col gap-3">
      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground">
        <Command.Pages defaultValue={["home"]}>
          <Command.Page id="home" label="Commands">
            <Command.Root items={HOME}>
              <Command.Input />
              <Command.Empty />
              <Command.List>
                {(entry: (typeof HOME)[number]) =>
                  entry.page === null ? (
                    <Command.Item
                      key={entry.label}
                      value={entry}
                      onClick={() => {
                        setLastRun(entry.label);
                      }}>
                      {entry.label}
                    </Command.Item>
                  ) : (
                    <Command.PageTrigger key={entry.label} value={entry} page={entry.page}>
                      {entry.label}
                    </Command.PageTrigger>
                  )
                }
              </Command.List>
              <Command.Footer>
                <Command.NavigateHint />
                <Command.SelectHint />
              </Command.Footer>
            </Command.Root>
          </Command.Page>
          <Command.Page id="customers" label="Customers">
            <Command.Root items={CUSTOMERS}>
              <Command.Input placeholder="Search customers…" />
              <Command.Empty />
              <Command.List>
                {(customer: Customer) => (
                  <Command.PageTrigger key={customer.id} value={customer} page={customer.id}>
                    {customer.label}
                  </Command.PageTrigger>
                )}
              </Command.List>
              <Command.Footer>
                <Command.NavigateHint />
                <Command.SelectHint />
                <Command.BackHint />
              </Command.Footer>
            </Command.Root>
          </Command.Page>
          {CUSTOMERS.map((customer) => (
            <Command.Page key={customer.id} id={customer.id} label={customer.label}>
              <Command.Root items={CUSTOMER_ACTIONS}>
                <Command.Input placeholder={`Actions for ${customer.label}…`} />
                <Command.Empty />
                <Command.List>
                  {(action: string) => (
                    <Command.Item
                      key={action}
                      value={action}
                      onClick={() => {
                        setLastRun(`${action}: ${customer.label}`);
                      }}>
                      {action}
                    </Command.Item>
                  )}
                </Command.List>
                <Command.Footer>
                  <Command.NavigateHint />
                  <Command.SelectHint />
                  <Command.BackHint />
                </Command.Footer>
              </Command.Root>
            </Command.Page>
          ))}
        </Command.Pages>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {lastRun === "" ? "No command run yet." : `Ran: ${lastRun}`}
      </p>
    </div>
  );
}
