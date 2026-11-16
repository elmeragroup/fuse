"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { ListDetail } from "@elmeragroup/fuse/list-detail";

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
        <table>
          <caption>Meter readings</caption>
          <thead>
            <tr>
              <th>Meter point</th>
              <th>Address</th>
              <th>Reading</th>
            </tr>
          </thead>
          <tbody>
            {READINGS.map((row) => (
              <tr key={row.meter}>
                <td>
                  <Button
                    variant="link"
                    onClick={() => {
                      setSelected(row.meter);
                    }}>
                    {row.meter}
                  </Button>
                </td>
                <td>{row.address}</td>
                <td>{row.reading}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
