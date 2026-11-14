"use client";

import { VerticalTable } from "@elmeragroup/fuse/table";

export function VerticalTableBoldRow() {
  return (
    <VerticalTable.Root>
      <VerticalTable.Header>Customer</VerticalTable.Header>
      <VerticalTable.Body>
        <VerticalTable.Row fontWeight="bold">
          <VerticalTable.Key render={<th scope="row" />}>Name</VerticalTable.Key>
          <VerticalTable.Value>Kari Nordmann</VerticalTable.Value>
        </VerticalTable.Row>
        <VerticalTable.Row>
          <VerticalTable.Key render={<th scope="row" />}>Customer number</VerticalTable.Key>
          <VerticalTable.Value>10492831</VerticalTable.Value>
        </VerticalTable.Row>
        <VerticalTable.Row>
          <VerticalTable.Key render={<th scope="row" />}>Meter point</VerticalTable.Key>
          <VerticalTable.Value>7070575000</VerticalTable.Value>
        </VerticalTable.Row>
      </VerticalTable.Body>
    </VerticalTable.Root>
  );
}
