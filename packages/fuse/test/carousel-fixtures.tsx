import type { ReactElement } from "react";

import { Carousel } from "../src/components/carousel/index";

/**
 * The carousel suites' slides: `count` slides 80px tall, each the viewport's width, or a third of
 * it with `perView` 3. The width is inline, as the suites' stylesheet holds only the classes the
 * package itself writes.
 *
 * @param count - How many slides.
 * @param perView - How many show at once.
 * @returns The slides, keyed by place, each reading "Slide body N".
 */
export function carouselSlides(count: number, perView: 1 | 3): ReactElement[] {
  return Array.from({ length: count }, (_, index) => (
    <Carousel.Slide key={index} style={perView === 3 ? { flexBasis: `${100 / 3}%` } : undefined}>
      <div style={{ height: 80 }}>Slide body {index + 1}</div>
    </Carousel.Slide>
  ));
}
