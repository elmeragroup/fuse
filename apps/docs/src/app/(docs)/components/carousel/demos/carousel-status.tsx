"use client";

import { Carousel } from "@elmeragroup/fuse/carousel";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const READINGS = MONTHS.map((month, index) => ({ month, kwh: 900 + ((index * 137) % 600) }));

export function CarouselStatus() {
  return (
    <Carousel.Root aria-label="Meter readings" className="max-w-sm w-full">
      <Carousel.Viewport>
        {READINGS.map((reading) => (
          <Carousel.Slide key={reading.month}>
            <div className="flex h-36 flex-col items-center justify-center gap-1 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">{reading.month}</p>
              <p className="text-2xl font-medium tabular-nums">{reading.kwh} kWh</p>
            </div>
          </Carousel.Slide>
        ))}
      </Carousel.Viewport>
      <Carousel.Controls>
        <Carousel.Previous />
        <Carousel.Status />
        <Carousel.Next />
      </Carousel.Controls>
    </Carousel.Root>
  );
}
