"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Carousel, useCarousel } from "@elmeragroup/fuse/carousel";

const PLANS = ["Basic", "Plus", "Premium"];

/** A custom control. It reads the carousel's state and acts through `useCarousel`. */
function PlanPicker() {
  const { state, actions } = useCarousel();
  return (
    <div role="group" aria-label="Plan" className="flex justify-center gap-2">
      {PLANS.map((plan, page) => (
        <Button
          key={plan}
          variant="outline"
          size="sm"
          aria-pressed={state.index === page}
          onClick={() => actions.goTo(page)}>
          {plan}
        </Button>
      ))}
    </div>
  );
}

export function CarouselControlled() {
  const [index, setIndex] = useState(1);
  return (
    <div className="max-w-md flex w-full flex-col gap-3">
      <Carousel.Root aria-label="Plans" index={index} onIndexChange={setIndex}>
        <Carousel.Viewport>
          {PLANS.map((plan) => (
            <Carousel.Slide key={plan} aria-label={plan} className="me-4 last:me-0">
              <div className="text-lg font-medium flex h-36 items-center justify-center rounded-lg bg-muted">
                {plan}
              </div>
            </Carousel.Slide>
          ))}
        </Carousel.Viewport>
        <PlanPicker />
      </Carousel.Root>
      <p className="text-sm text-center text-muted-foreground">Selected: {PLANS[index]}</p>
    </div>
  );
}
