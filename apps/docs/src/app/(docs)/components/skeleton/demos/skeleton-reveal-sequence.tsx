"use client";

import { useEffect, useState } from "react";

import { SkeletonReveal } from "@elmeragroup/fuse/skeleton";

type Customer = {
  readonly initials: string;
  readonly name: string;
  readonly plan: string;
  readonly address: string;
};

// Drawn while the customer loads: the skeleton is this card, rendered with the sample.
const SAMPLE: Customer = {
  initials: "KN",
  name: "Kari Nordmann",
  plan: "Fixed price",
  address: "Storgata 1, 0155 Oslo",
};

const CUSTOMER: Customer = {
  initials: "OH",
  name: "Ola Hansen",
  plan: "Spot price",
  address: "Kongens gate 12, 7011 Trondheim",
};

function CustomerCard({ customer }: { readonly customer: Customer }) {
  return (
    <article className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium flex size-10 items-center justify-center rounded-full bg-muted">
          {customer.initials}
        </span>
        <div className="flex flex-col gap-1">
          <h4 className="font-medium">{customer.name}</h4>
          <p className="text-sm text-muted-foreground">{customer.address}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">{customer.plan}</span>
        <button type="button" className="text-sm rounded-md border px-3 py-1.5">
          Change plan
        </button>
      </div>
    </article>
  );
}

const LOAD_MS = 1500;

export function SkeletonRevealSequence() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setCustomer(CUSTOMER), LOAD_MS);
    return () => clearTimeout(timer);
  }, [request]);

  return (
    <div className="max-w-sm flex w-full flex-col gap-4">
      <SkeletonReveal data={customer} sample={SAMPLE} reveal="sequence" label="Loading customer">
        {(shown) => <CustomerCard customer={shown} />}
      </SkeletonReveal>
      <button
        type="button"
        className="text-sm self-start rounded-md border px-3 py-1.5"
        onClick={() => {
          setCustomer(null);
          setRequest((count) => count + 1);
        }}>
        Reload
      </button>
    </div>
  );
}
