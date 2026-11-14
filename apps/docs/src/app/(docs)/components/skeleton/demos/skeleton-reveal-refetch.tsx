"use client";

import { SkeletonReveal } from "@elmeragroup/fuse/skeleton";

type Customer = {
  readonly initials: string;
  readonly name: string;
  readonly plan: string;
  readonly address: string;
};

// On screen while it refetches: the skeleton is drawn from this data.
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

export function SkeletonRevealRefetch() {
  return (
    <div className="max-w-sm w-full">
      <SkeletonReveal data={CUSTOMER} loading label="Loading customer">
        {(shown) => <CustomerCard customer={shown} />}
      </SkeletonReveal>
    </div>
  );
}
