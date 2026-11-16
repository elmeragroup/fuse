"use client";

import { VerticalTable } from "@elmeragroup/fuse/table";

export function VerticalTableRowsAsChildren() {
  return (
    <VerticalTable.Root>
      <VerticalTable.Header>Customer</VerticalTable.Header>
      <VerticalTable.Body>
        <VerticalTable.Row>
          <VerticalTable.Key render={<th scope="row" />}>Name</VerticalTable.Key>
          <VerticalTable.Value>Kari Nordmann</VerticalTable.Value>
        </VerticalTable.Row>
        <VerticalTable.Row>
          <VerticalTable.Key render={<th scope="row" />}>Grid company</VerticalTable.Key>
          <VerticalTable.Value>Skagerak Nett</VerticalTable.Value>
        </VerticalTable.Row>
      </VerticalTable.Body>
    </VerticalTable.Root>
  );
}
