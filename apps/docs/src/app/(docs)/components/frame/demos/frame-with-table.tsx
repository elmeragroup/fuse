"use client";

import { Frame } from "@elmeragroup/fuse/frame";
import { Table } from "@elmeragroup/fuse/table";

export function FrameWithTable() {
  return (
    <Frame.Root>
      <Frame.Header>
        <Frame.Title>Invoices</Frame.Title>
        <Frame.Description>Last 30 days</Frame.Description>
      </Frame.Header>
      <Table.Root>
        <Table.Caption>Invoices for the last 30 days</Table.Caption>
        <Table.Header>
          <Table.Row>
            <Table.Head>Invoice</Table.Head>
            <Table.Head>Status</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>#1042</Table.Cell>
            <Table.Cell>Issued</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>#1043</Table.Cell>
            <Table.Cell>Paid</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>
      <Frame.Panel>Reminders go out seven days after the due date.</Frame.Panel>
    </Frame.Root>
  );
}
