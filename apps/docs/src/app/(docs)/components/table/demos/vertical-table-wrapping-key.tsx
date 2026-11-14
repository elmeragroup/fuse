"use client";

import { VerticalTable } from "@elmeragroup/fuse/table";

export function VerticalTableWrappingKey() {
  return (
    <VerticalTable.Root>
      <VerticalTable.Header>Customer</VerticalTable.Header>
      <VerticalTable.Body>
        <VerticalTable.Row>
          <VerticalTable.Key render={<th scope="row" />}>Name</VerticalTable.Key>
          <VerticalTable.Value>Kari Nordmann</VerticalTable.Value>
        </VerticalTable.Row>
        <VerticalTable.Row>
          <VerticalTable.Key render={<th scope="row" />} text="default">
            Delivery address registered for the meter point
          </VerticalTable.Key>
          <VerticalTable.Value>Storgata 114, 3921 Porsgrunn</VerticalTable.Value>
        </VerticalTable.Row>
      </VerticalTable.Body>
    </VerticalTable.Root>
  );
}
