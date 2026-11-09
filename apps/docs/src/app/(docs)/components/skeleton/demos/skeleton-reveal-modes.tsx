"use client";

import { useEffect, useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Item } from "@elmeragroup/fuse/item";
import { SkeletonReveal } from "@elmeragroup/fuse/skeleton";
import type { SkeletonRevealMode } from "@elmeragroup/fuse/skeleton";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

type Invoice = { readonly id: string; readonly period: string; readonly amount: string };

const SAMPLE: readonly Invoice[] = ["1", "2", "3", "4"].map((id) => ({
  id,
  period: "January 2026",
  amount: "1 000 kr",
}));

const INVOICES: readonly Invoice[] = [
  { id: "4711", period: "April 2026", amount: "1 195 kr" },
  { id: "4710", period: "March 2026", amount: "1 482 kr" },
  { id: "4709", period: "February 2026", amount: "1 730 kr" },
  { id: "4708", period: "January 2026", amount: "1 911 kr" },
];

const MODES: readonly SkeletonRevealMode[] = ["smart", "together", "sequence"];

function parseMode(value: string | undefined): SkeletonRevealMode | undefined {
  return MODES.find((mode) => mode === value);
}

const LOAD_MS = 1200;

export function SkeletonRevealModes() {
  const [mode, setMode] = useState<SkeletonRevealMode>("smart");
  const [invoices, setInvoices] = useState<readonly Invoice[] | null>(null);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setInvoices(INVOICES), LOAD_MS);
    return () => clearTimeout(timer);
  }, [request]);

  return (
    <div className="max-w-md flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup.Root
          aria-label="Reveal"
          value={[mode]}
          onValueChange={(values) => {
            const next = parseMode(values[0]);
            if (next !== undefined) setMode(next);
          }}>
          {MODES.map((value) => (
            <ToggleGroup.Item key={value} value={value}>
              {value}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
        <Button
          variant="secondary"
          onClick={() => {
            setInvoices(null);
            setRequest((count) => count + 1);
          }}>
          Reload
        </Button>
      </div>
      <SkeletonReveal data={invoices} sample={SAMPLE} reveal={mode} label="Loading invoices">
        {(shown) => (
          <Item.Group>
            {shown.map((invoice) => (
              <Item.Root key={invoice.id} variant="outline">
                <Item.Content>
                  <Item.Title>Invoice {invoice.id}</Item.Title>
                  <Item.Description>{invoice.period}</Item.Description>
                </Item.Content>
                <Item.Actions>{invoice.amount}</Item.Actions>
              </Item.Root>
            ))}
          </Item.Group>
        )}
      </SkeletonReveal>
    </div>
  );
}
