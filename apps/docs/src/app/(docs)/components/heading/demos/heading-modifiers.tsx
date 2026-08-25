"use client";

import { Heading } from "@elmeragroup/ui/heading";

export function HeadingModifiers() {
  return (
    <div className="flex flex-col gap-3">
      <Heading font="default">Order overview</Heading>
      <Heading font="normal">Details</Heading>
      <Heading font="semi-bold">Usage</Heading>
      <Heading uppercase>Period</Heading>
      <Heading align="center">Meters</Heading>
      <Heading noMargin>Notes</Heading>
    </div>
  );
}
