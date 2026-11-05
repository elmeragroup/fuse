"use client";

import { Carousel } from "@elmeragroup/fuse/carousel";

const ROOMS = [
  { name: "Living room", tone: "bg-primary-soft" },
  { name: "Kitchen", tone: "bg-muted" },
  { name: "Bedroom", tone: "bg-secondary-soft" },
  { name: "Garage", tone: "bg-accent" },
];

export function CarouselThumbnails() {
  return (
    <Carousel.Root aria-label="Rooms with smart meters" className="max-w-md w-full">
      <Carousel.Viewport>
        {ROOMS.map((room) => (
          <Carousel.Slide key={room.name} aria-label={room.name}>
            <div className={`flex h-44 items-end rounded-lg p-6 ${room.tone}`}>
              <p className="text-lg font-medium">{room.name}</p>
            </div>
          </Carousel.Slide>
        ))}
      </Carousel.Viewport>
      <Carousel.Indicators>
        {ROOMS.map((room, index) => (
          <Carousel.Indicator key={room.name} index={index} aria-label={room.name}>
            {/* The current page's Indicator carries `data-current`. */}
            <span
              className={`m-1 block h-10 w-16 rounded-sm opacity-60 in-data-current:opacity-100 ${room.tone}`}
            />
          </Carousel.Indicator>
        ))}
      </Carousel.Indicators>
    </Carousel.Root>
  );
}
