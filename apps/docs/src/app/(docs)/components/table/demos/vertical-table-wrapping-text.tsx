"use client";

import { VerticalTable } from "@elmeragroup/fuse/table";

export function VerticalTableWrappingText() {
  return (
    <VerticalTable.Root>
      <VerticalTable.Header>Customer</VerticalTable.Header>
      <VerticalTable.Body>
        <VerticalTable.Row>
          <VerticalTable.Key render={<th scope="row" />}>Name</VerticalTable.Key>
          <VerticalTable.Value>Kari Nordmann</VerticalTable.Value>
        </VerticalTable.Row>
        <VerticalTable.Row>
          <VerticalTable.Key render={<th scope="row" />}>Delivery address</VerticalTable.Key>
          <VerticalTable.Value text="default">
            Storgata 114, 3rd floor, entrance from the courtyard, 3921 Porsgrunn
          </VerticalTable.Value>
        </VerticalTable.Row>
      </VerticalTable.Body>
    </VerticalTable.Root>
  );
}
