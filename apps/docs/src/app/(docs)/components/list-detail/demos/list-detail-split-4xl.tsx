"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { X } from "@elmeragroup/fuse/icons";
import { ListDetail } from "@elmeragroup/fuse/list-detail";

const CUSTOMERS = [
  { id: "4012", name: "Henrik Aasen", product: "Spot price" },
  { id: "4013", name: "Ingrid Lund", product: "Fixed price, 12 months" },
  { id: "4014", name: "Siri Haugen", product: "Spot price with solar" },
] as const;

type CustomerId = (typeof CUSTOMERS)[number]["id"];

export function ListDetailSplit4xl() {
  const [selected, setSelected] = useState<CustomerId | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const customer = CUSTOMERS.find((candidate) => candidate.id === selected);

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border">
      <div className="w-4xl flex h-80">
        <ListDetail.Root
          open={open && customer !== undefined}
          onOpenChange={setOpen}
          split="4xl"
          className="flex-1">
          <ListDetail.List
            render={<ul />}
            aria-label="Customers"
            className="m-0 flex list-none flex-col gap-1 p-2">
            {CUSTOMERS.map((candidate) => (
              <li key={candidate.id}>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  aria-current={candidate.id === selected ? "true" : undefined}
                  onClick={() => {
                    setSelected(candidate.id);
                    setOpen(true);
                  }}>
                  {candidate.name}
                </Button>
              </li>
            ))}
          </ListDetail.List>
          <ListDetail.Detail aria-label="Customer details" showCloseButton={false}>
            {customer === undefined ? (
              <p className="text-sm m-auto p-6 text-muted-foreground">Select a customer.</p>
            ) : (
              <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center gap-2">
                  <ListDetail.Title>{customer.name}</ListDetail.Title>
                  <ListDetail.Close
                    render={
                      <Button variant="ghost" size="icon-sm" aria-label="Close details" className="ml-auto" />
                    }>
                    <X aria-hidden />
                  </ListDetail.Close>
                </div>
                <p className="text-sm m-0">{customer.product}</p>
              </div>
            )}
          </ListDetail.Detail>
        </ListDetail.Root>
      </div>
    </div>
  );
}
