"use client";

import { VerticalTable } from "@elmeragroup/ui/table";

export function VerticalTableData() {
  return (
    <VerticalTable.Root>
      <VerticalTable.Header>Customer</VerticalTable.Header>
      <VerticalTable.Body
        data={[
          { label: "Name", value: "Kari Nordmann" },
          { label: "Customer number", value: "10492831", isLoading: true },
          { label: "Meter point", value: "7070575000" },
        ]}>
        <VerticalTable.Row>
          <VerticalTable.Key>Grid company</VerticalTable.Key>
          <VerticalTable.Value>Skagerak Nett</VerticalTable.Value>
        </VerticalTable.Row>
      </VerticalTable.Body>
    </VerticalTable.Root>
  );
}
