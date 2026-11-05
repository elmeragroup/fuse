"use client";

import { Carousel } from "@elmeragroup/fuse/carousel";

const NEWS = [
  { title: "New app release", body: "Follow your usage hour by hour." },
  { title: "Winter tips", body: "Five ways to keep the heating bill down." },
  { title: "Solar season", body: "Panels pay back faster with spot price buyback." },
];

export function CarouselAutoplay() {
  return (
    <Carousel.Root aria-label="News" className="max-w-md w-full">
      {/* First in the source, so the rotation control comes before the slides in the tab order;
          `order-last` still shows the row below them. */}
      <Carousel.Controls className="order-last">
        <Carousel.Autoplay delay={5000} />
        <Carousel.Previous />
        <Carousel.Indicators />
        <Carousel.Next />
      </Carousel.Controls>
      <Carousel.Viewport>
        {NEWS.map((item) => (
          <Carousel.Slide key={item.title} className="me-4 last:me-0">
            <div className="flex h-44 flex-col justify-end gap-1 rounded-lg bg-primary-soft p-6 text-primary-soft-foreground">
              <p className="text-lg font-medium">{item.title}</p>
              <p className="text-sm">{item.body}</p>
            </div>
          </Carousel.Slide>
        ))}
      </Carousel.Viewport>
    </Carousel.Root>
  );
}
