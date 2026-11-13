"use client";

import { useState } from "react";

import { ActionBar } from "@elmeragroup/fuse/action-bar";
import { Download, Trash } from "@elmeragroup/fuse/icons";

const CUSTOMERS = ["Aurora Bakeri", "Fjellstue AS", "Havbris", "Nordlys Kafé"];

export function ActionBarDemo() {
  const [customers, setCustomers] = useState(CUSTOMERS);
  const [selected, setSelected] = useState<readonly string[]>(["Aurora Bakeri", "Havbris"]);

  return (
    <div className="max-w-xl relative min-h-64 w-full">
      <ul className="text-sm flex flex-col gap-2">
        {customers.map((customer) => (
          <li key={customer}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(customer)}
                onChange={(event) => {
                  setSelected(
                    event.target.checked
                      ? [...selected, customer]
                      : selected.filter((name) => name !== customer)
                  );
                }}
              />
              {customer}
            </label>
          </li>
        ))}
      </ul>
      <ActionBar.Root count={selected.length}>
        <ActionBar.Count />
        <ActionBar.Clear
          onClick={() => {
            setSelected([]);
          }}
        />
        <ActionBar.Separator />
        <ActionBar.Button>
          <Download data-icon="inline-start" />
          <ActionBar.ButtonLabel>Export</ActionBar.ButtonLabel>
        </ActionBar.Button>
        <ActionBar.Button
          onClick={() => {
            setCustomers(customers.filter((customer) => !selected.includes(customer)));
            setSelected([]);
          }}>
          <Trash data-icon="inline-start" />
          <ActionBar.ButtonLabel>Delete</ActionBar.ButtonLabel>
        </ActionBar.Button>
      </ActionBar.Root>
    </div>
  );
}
