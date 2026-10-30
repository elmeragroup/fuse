"use client";

import { Badge } from "@elmeragroup/fuse/badge";
import { Frame } from "@elmeragroup/fuse/frame";
import { Meter } from "@elmeragroup/fuse/meter";
import { VerticalTable } from "@elmeragroup/fuse/table";

export function FrameKeyValueTable() {
  return (
    <Frame.Root className="max-w-lg">
      <Frame.Header>
        <Frame.Title>Meter 735999123</Frame.Title>
        <Frame.Description>
          Main meter at Storgata 12{" "}
          <Badge variant="outline" size="sm">
            NO1
          </Badge>
        </Frame.Description>
      </Frame.Header>
      <Frame.Panel>
        <VerticalTable.Body tableProps={{ "aria-label": "Meter 735999123 status" }}>
          <VerticalTable.Row>
            <VerticalTable.Key render={<th scope="row" />}>Status</VerticalTable.Key>
            <VerticalTable.Value>
              <span className="flex items-center gap-2">
                <span aria-hidden className="size-2 rounded-full bg-success" />
                Online
              </span>
            </VerticalTable.Value>
          </VerticalTable.Row>
          <VerticalTable.Row>
            <VerticalTable.Key render={<th scope="row" />}>Meter type</VerticalTable.Key>
            <VerticalTable.Value>Smart meter, three-phase</VerticalTable.Value>
          </VerticalTable.Row>
          <VerticalTable.Row>
            <VerticalTable.Key render={<th scope="row" />}>Last reading</VerticalTable.Key>
            <VerticalTable.Value>48 210 kWh</VerticalTable.Value>
          </VerticalTable.Row>
          <VerticalTable.Row>
            <VerticalTable.Key id="meter-fuse-load" render={<th scope="row" />}>
              Fuse load
            </VerticalTable.Key>
            <VerticalTable.Value>
              <Meter aria-labelledby="meter-fuse-load" value={42} />
            </VerticalTable.Value>
          </VerticalTable.Row>
          <VerticalTable.Row>
            <VerticalTable.Key render={<th scope="row" />}>Products</VerticalTable.Key>
            <VerticalTable.Value text="default">
              <span className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" size="sm">
                  Spot price
                </Badge>
                <Badge variant="secondary" size="sm">
                  Grid rent
                </Badge>
              </span>
            </VerticalTable.Value>
          </VerticalTable.Row>
        </VerticalTable.Body>
      </Frame.Panel>
    </Frame.Root>
  );
}
