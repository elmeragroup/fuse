"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { ListDetail } from "@elmeragroup/fuse/list-detail";
import { Table } from "@elmeragroup/fuse/table";

const READINGS = [
  { meter: "707057500012345678", address: "Storgata 1, Oslo", reading: "12 480 kWh" },
  { meter: "707057500087654321", address: "Kongens gate 9, Trondheim", reading: "8 112 kWh" },
] as const;

type Meter = (typeof READINGS)[number]["meter"];

export function ListDetailNever() {
  const [selected, setSelected] = useState<Meter | undefined>(undefined);
  const reading = READINGS.find((candidate) => candidate.meter === selected);

  return (
    <ListDetail.Root
      open={reading !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          setSelected(undefined);
        }
      }}
      split="never"
      className="w-full">
      <ListDetail.List>
        <Table.Root>
          <Table.Caption>Meter readings</Table.Caption>
          <Table.Header>
            <Table.Row>
              <Table.Head>Meter point</Table.Head>
              <Table.Head>Address</Table.Head>
              <Table.Head>Reading</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {READINGS.map((row) => (
              <Table.Row key={row.meter}>
                <Table.Cell>
                  <Button
                    variant="link"
                    onClick={() => {
                      setSelected(row.meter);
                    }}>
                    {row.meter}
                  </Button>
                </Table.Cell>
                <Table.Cell>{row.address}</Table.Cell>
                <Table.Cell>{row.reading}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </ListDetail.List>
      <ListDetail.Detail>
        {reading === undefined ? null : (
          <div className="flex flex-col gap-2 p-6">
            <ListDetail.Title>{reading.address}</ListDetail.Title>
            <p className="text-sm m-0">Last reading {reading.reading}.</p>
          </div>
        )}
      </ListDetail.Detail>
    </ListDetail.Root>
  );
}
