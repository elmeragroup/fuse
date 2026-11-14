"use client";

import { Frame } from "@elmeragroup/fuse/frame";
import { VerticalTable } from "@elmeragroup/fuse/table";

export function FramePanelTable() {
  return (
    <Frame.Root className="max-w-md w-full">
      <Frame.Header>
        <Frame.Title>Meter 735999123</Frame.Title>
        <Frame.Description>Main meter at Storgata 12</Frame.Description>
      </Frame.Header>
      <Frame.Panel>
        <VerticalTable.Body tableProps={{ "aria-label": "Meter 735999123 status" }}>
          <VerticalTable.Row>
            <VerticalTable.Key render={<th scope="row" />}>Status</VerticalTable.Key>
            <VerticalTable.Value>Online</VerticalTable.Value>
          </VerticalTable.Row>
          <VerticalTable.Row>
            <VerticalTable.Key render={<th scope="row" />}>Meter type</VerticalTable.Key>
            <VerticalTable.Value>Smart meter, three-phase</VerticalTable.Value>
          </VerticalTable.Row>
          <VerticalTable.Row>
            <VerticalTable.Key render={<th scope="row" />}>Last reading</VerticalTable.Key>
            <VerticalTable.Value>48 210 kWh</VerticalTable.Value>
          </VerticalTable.Row>
        </VerticalTable.Body>
      </Frame.Panel>
    </Frame.Root>
  );
}
