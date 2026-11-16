"use client";

import { VerticalTable } from "@elmeragroup/fuse/table";

export function VerticalTableDemo() {
  return (
    <VerticalTable.Root>
      <VerticalTable.Header>Customer</VerticalTable.Header>
      <VerticalTable.Body
        data={[
          { label: "Name", value: "Kari Nordmann" },
          { label: "Customer number", value: "10492831" },
          { label: "Meter point", value: "7070575000" },
        ]}
      />
    </VerticalTable.Root>
  );
}
