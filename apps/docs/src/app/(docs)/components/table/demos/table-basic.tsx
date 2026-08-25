"use client";

import { Table } from "@elmeragroup/ui/table";

export function TableBasic() {
  return (
    <Table.Root>
      <Table.Caption>Recent orders</Table.Caption>
      <Table.Header>
        <Table.Row>
          <Table.Head>Order</Table.Head>
          <Table.Head>Status</Table.Head>
          <Table.Head>Amount</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.Cell>#1042</Table.Cell>
          <Table.Cell>Active</Table.Cell>
          <Table.Cell>NOK 1 240</Table.Cell>
        </Table.Row>
        <Table.Row data-state="selected">
          <Table.Cell>#1043</Table.Cell>
          <Table.Cell>Pending</Table.Cell>
          <Table.Cell>NOK 890</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell>#1044</Table.Cell>
          <Table.Cell>Paid</Table.Cell>
          <Table.Cell>NOK 2 110</Table.Cell>
        </Table.Row>
      </Table.Body>
      <Table.Footer>
        <Table.Row>
          <Table.Cell colSpan={2}>Total</Table.Cell>
          <Table.Cell>NOK 4 240</Table.Cell>
        </Table.Row>
      </Table.Footer>
    </Table.Root>
  );
}
