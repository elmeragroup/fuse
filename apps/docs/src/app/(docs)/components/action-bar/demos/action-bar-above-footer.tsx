"use client";

import { useState } from "react";

import { ActionBar } from "@elmeragroup/fuse/action-bar";
import { PaperPlaneTilt } from "@elmeragroup/fuse/icons";

const INVOICES = ["INV-1001", "INV-1002", "INV-1003", "INV-1004"];

export function ActionBarAboveFooter() {
  const [selected, setSelected] = useState<readonly string[]>(["INV-1002"]);

  return (
    <div className="max-w-xl flex w-full flex-col gap-4">
      {/* The bar floats at the bottom of this list's box, so it stays above the footer. */}
      <div className="relative min-h-56">
        <ul className="text-sm flex flex-col gap-2">
          {INVOICES.map((invoice) => (
            <li key={invoice}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(invoice)}
                  onChange={(event) => {
                    setSelected(
                      event.target.checked ? [...selected, invoice] : selected.filter((id) => id !== invoice)
                    );
                  }}
                />
                {invoice}
              </label>
            </li>
          ))}
        </ul>
        <ActionBar.Root count={selected.length} aria-label="Invoice actions">
          <ActionBar.Count />
          <ActionBar.Clear
            onClick={() => {
              setSelected([]);
            }}
          />
          <ActionBar.Separator />
          <ActionBar.Button>
            <PaperPlaneTilt data-icon="inline-start" />
            <ActionBar.ButtonLabel>Send reminders</ActionBar.ButtonLabel>
          </ActionBar.Button>
        </ActionBar.Root>
      </div>
      <footer className="text-sm border-t pt-3 text-muted-foreground">Page 1 of 5</footer>
    </div>
  );
}
