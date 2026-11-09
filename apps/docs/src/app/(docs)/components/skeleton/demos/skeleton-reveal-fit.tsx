"use client";

import { useEffect, useState } from "react";

import { Avatar } from "@elmeragroup/fuse/avatar";
import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
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

function CustomerCard({ customer }: { customer: Customer }) {
  return (
    <Card.Root>
      <Card.Header className="flex flex-row items-center gap-3">
        <Avatar.Root>
          <Avatar.Fallback>{customer.initials}</Avatar.Fallback>
        </Avatar.Root>
        <div className="flex flex-col gap-1">
          <Card.Title>{customer.name}</Card.Title>
          <Card.Description>{customer.address}</Card.Description>
        </div>
      </Card.Header>
      <Card.Content className="flex items-center justify-between gap-2">
        <Badge>{customer.plan}</Badge>
        <Button variant="outline">Change plan</Button>
      </Card.Content>
    </Card.Root>
  );
}

const LOAD_MS = 1500;

export function SkeletonRevealFit() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setCustomer(CUSTOMER), LOAD_MS);
    return () => clearTimeout(timer);
  }, [request]);

  return (
    <div className="max-w-sm flex w-full flex-col gap-4">
      <SkeletonReveal data={customer} sample={SAMPLE} label="Loading customer">
        {(shown) => <CustomerCard customer={shown} />}
      </SkeletonReveal>
      <Button
        variant="secondary"
        className="self-start"
        onClick={() => {
          setCustomer(null);
          setRequest((count) => count + 1);
        }}>
        Reload
      </Button>
    </div>
  );
}
