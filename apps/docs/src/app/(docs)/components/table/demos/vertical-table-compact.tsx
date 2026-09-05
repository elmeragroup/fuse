"use client";

import { VerticalTable } from "@elmeragroup/ui/table";

export function VerticalTableCompact() {
  return (
    <VerticalTable.Root variant="non-bordered-compact">
      <VerticalTable.Header>Meter</VerticalTable.Header>
      <VerticalTable.Body
        data={[
          { label: "Meter point", value: "7070575000" },
          { label: "Grid company", value: "Skagerak Nett" },
          { label: "Tariff", value: "H3" },
        ]}
      />
    </VerticalTable.Root>
  );
}
