"use client";

import { Carousel } from "@elmeragroup/fuse/carousel";

const OFFERS = [
  { title: "Spot price", body: "Follows the hourly market, with no markup on the price." },
  { title: "Fixed price", body: "One price per kWh for twelve months." },
  { title: "Price cap", body: "Spot price that never goes above the cap." },
  { title: "Solar buyback", body: "Sell what your panels make at the spot price." },
];

export function CarouselHeadingName() {
  return (
    <Carousel.Root aria-labelledby="carousel-offers-heading" className="max-w-md w-full">
      <h3 id="carousel-offers-heading" className="text-lg font-medium m-0">
        Electricity offers
      </h3>
      <Carousel.Viewport>
        {OFFERS.map((offer) => (
          <Carousel.Slide key={offer.title} className="me-4 last:me-0">
            <div className="flex h-44 flex-col justify-end gap-1 rounded-lg bg-muted p-6">
              <p className="text-lg font-medium">{offer.title}</p>
              <p className="text-sm text-muted-foreground">{offer.body}</p>
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
