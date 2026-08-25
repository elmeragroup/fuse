"use client";

import { Heading } from "@elmeragroup/ui/heading";

export function HeadingBasic() {
  return (
    <div className="flex flex-col gap-3">
      <Heading level={1}>Order overview</Heading>
      <Heading level={2}>Details</Heading>
      <Heading level={3}>Usage</Heading>
      <Heading level={4}>Period</Heading>
      <Heading level={5}>Meters</Heading>
      <Heading level={6}>Notes</Heading>
    </div>
  );
}
