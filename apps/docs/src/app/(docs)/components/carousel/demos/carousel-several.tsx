"use client";

import { Carousel } from "@elmeragroup/fuse/carousel";

const MONTHS = ["January", "February", "March", "April", "May", "June"];

export function CarouselSeveral() {
  return (
    <Carousel.Root aria-label="Monthly invoices" className="max-w-xl w-full">
      <Carousel.Viewport>
        {MONTHS.map((month) => (
          // Each slide is a snap position, so six slides three to a view make four pages.
          <Carousel.Slide
            key={month}
            className="sm:basis-[calc((100%-1.5rem)/3)] me-3 basis-[calc(50%-0.75rem)] last:me-0">
            <div className="flex h-32 flex-col justify-between rounded-lg border border-border p-4">
              <p className="font-medium">{month}</p>
              <p className="text-sm text-muted-foreground">Invoice ready</p>
            </div>
          </Carousel.Slide>
        ))}
      </Carousel.Viewport>
      <Carousel.Controls>
        <Carousel.Previous />
        <Carousel.Indicators />
        <Carousel.Next />
      </Carousel.Controls>
    </Carousel.Root>
  );
}
