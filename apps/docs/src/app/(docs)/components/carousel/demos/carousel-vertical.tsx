"use client";

import { Carousel } from "@elmeragroup/fuse/carousel";

const STEPS = ["Choose a plan", "Confirm your address", "Pick a start date", "Sign the agreement"];

export function CarouselVertical() {
  return (
    <Carousel.Root aria-label="How to switch" orientation="vertical" className="max-w-sm w-full">
      {/* A vertical viewport needs a height. */}
      <Carousel.Viewport className="h-40">
        {STEPS.map((step, index) => (
          <Carousel.Slide key={step} className="mb-3 last:mb-0">
            <div className="flex h-full flex-col justify-center gap-1 rounded-lg bg-muted px-6">
              <p className="text-sm text-muted-foreground">Step {index + 1}</p>
              <p className="text-lg font-medium">{step}</p>
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
