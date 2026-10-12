"use client";

import { useState } from "react";

import { Command } from "@elmeragroup/fuse/command";

type Customer = { readonly id: string; readonly label: string; readonly city: string };

const CUSTOMERS: readonly Customer[] = [
  { id: "ada", label: "Ada Lovelace", city: "Bergen" },
  { id: "grace", label: "Grace Hopper", city: "Trondheim" },
  { id: "katherine", label: "Katherine Johnson", city: "Bergen" },
  { id: "margaret", label: "Margaret Hamilton", city: "Tromsø" },
];

const CUSTOMER_ACTIONS = ["Open customer", "Register meter reading", "Send invoice copy"];

/**
 * The customer search lives in `Palette`, above `Command.Root`, so going back to the list
 * shows the same search. The palette's own state ends when the palette unmounts.
 */
function Palette({ onRun }: { onRun: (summary: string) => void }) {
  const [query, setQuery] = useState("");
  return (
    <Command.Root defaultPages={["customers"]}>
      <Command.Page id="customers" label="Customers" items={CUSTOMERS} value={query} onValueChange={setQuery}>
        <Command.Input placeholder="Search customers…" />
        <Command.Empty />
        <Command.List>
          {(customer: Customer) => (
            <Command.PageTrigger key={customer.id} value={customer} page={customer.id}>
              {customer.label}
              <span className="text-xs text-muted-foreground">{customer.city}</span>
            </Command.PageTrigger>
          )}
        </Command.List>
        <Command.Footer>
          <Command.NavigateHint />
          <Command.SelectHint />
        </Command.Footer>
      </Command.Page>
      {CUSTOMERS.map((customer) => (
        <Command.Page key={customer.id} id={customer.id} label={customer.label} items={CUSTOMER_ACTIONS}>
          <Command.Input placeholder={`Actions for ${customer.label}…`} />
          <Command.Empty />
          <Command.List>
            {(action: string) => (
              <Command.Item
                key={action}
                value={action}
                onClick={() => {
                  onRun(`${action}: ${customer.label}`);
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
        </Command.Page>
      ))}
    </Command.Root>
  );
}

export function CommandKeptQuery() {
  const [lastRun, setLastRun] = useState("");
  return (
    <div className="max-w-xl flex w-full flex-col gap-3">
      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground">
        <Palette onRun={setLastRun} />
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {lastRun === "" ? "No command run yet." : `Ran: ${lastRun}`}
      </p>
    </div>
  );
}
