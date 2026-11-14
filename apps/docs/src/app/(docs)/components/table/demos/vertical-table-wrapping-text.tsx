"use client";

import { VerticalTable } from "@elmeragroup/fuse/table";

export function VerticalTableWrappingText() {
  return (
    <VerticalTable.Root>
      <VerticalTable.Header>Customer</VerticalTable.Header>
      <VerticalTable.Body
        data={[
          { label: "Name", value: "Kari Nordmann" },
          { label: "Customer number", value: "10492831" },
          {
            label: "Delivery address",
            value: "Storgata 114, 3rd floor, entrance from the courtyard, 3921 Porsgrunn",
            text: "default",
          },
        ]}
      />
    </VerticalTable.Root>
  );
}
