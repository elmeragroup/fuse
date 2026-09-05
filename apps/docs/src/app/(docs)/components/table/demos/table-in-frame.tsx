"use client";

import { Frame } from "@elmeragroup/ui/frame";
import { Table } from "@elmeragroup/ui/table";

export function TableInFrame() {
  return (
    <Frame.Root>
      <Frame.Panel>Three invoices issued for meter 735999123.</Frame.Panel>
      <Table.Root>
        <Table.Caption>Invoices for the last 30 days</Table.Caption>
        <Table.Header>
          <Table.Row>
            <Table.Head>Invoice</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head>Amount</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>#1042</Table.Cell>
            <Table.Cell>Issued</Table.Cell>
            <Table.Cell>NOK 1 240</Table.Cell>
          </Table.Row>
          <Table.Row data-state="selected">
            <Table.Cell>#1043</Table.Cell>
            <Table.Cell>Paid</Table.Cell>
            <Table.Cell>NOK 890</Table.Cell>
          </Table.Row>
        </Table.Body>
        <Table.Footer>
          <Table.Row>
            <Table.Cell colSpan={2}>Total</Table.Cell>
            <Table.Cell>NOK 2 130</Table.Cell>
          </Table.Row>
        </Table.Footer>
      </Table.Root>
      <Frame.Panel>Reminders go out seven days after the due date.</Frame.Panel>
    </Frame.Root>
  );
}
