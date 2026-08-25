"use client";

import { Frame } from "@elmeragroup/ui/frame";

/**
 * Frame is the reshape anchor for `Table.Root` (`data-slot="frame"`). Table is not
 * shipped on this branch, so the demo uses a semantic table in the same sibling
 * position table.md §10 describes — inside `Frame.Root`, next to `Frame.Panel`.
 */
export function FrameWithTable() {
  return (
    <Frame.Root>
      <Frame.Header>
        <Frame.Title>Invoices</Frame.Title>
        <Frame.Description>Last 30 days</Frame.Description>
      </Frame.Header>
      <table>
        <caption>Invoices for the last 30 days</caption>
        <thead>
          <tr>
            <th scope="col">Invoice</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>#1042</td>
            <td>Issued</td>
          </tr>
          <tr>
            <td>#1043</td>
            <td>Paid</td>
          </tr>
        </tbody>
      </table>
      <Frame.Panel>Reminders go out seven days after the due date.</Frame.Panel>
    </Frame.Root>
  );
}
