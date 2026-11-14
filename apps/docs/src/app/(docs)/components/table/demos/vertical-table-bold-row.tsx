"use client";

import { VerticalTable } from "@elmeragroup/fuse/table";

export function VerticalTableBoldRow() {
  return (
    <VerticalTable.Root>
      <VerticalTable.Header>Customer</VerticalTable.Header>
      <VerticalTable.Body
        data={[
          { label: "Name", value: "Kari Nordmann", fontWeight: "bold" },
          { label: "Customer number", value: "10492831" },
          { label: "Meter point", value: "7070575000" },
        ]}
      />
    </VerticalTable.Root>
  );
}
