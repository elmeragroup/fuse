/**
 * Server-visible namespace for `Carousel`.
 * Every part is a client module; this file has no directive, so a server component can read
 * each part instead of dotting into a client reference.
 */
import { CarouselRoot, CarouselSlide, CarouselViewport } from "./carousel";
import {
  CarouselAutoplay,
  CarouselControls,
  CarouselIndicator,
  CarouselIndicators,
  CarouselNext,
  CarouselPrevious,
  CarouselStatus,
} from "./carousel-controls";

export const Carousel = {
  Root: CarouselRoot,
  Viewport: CarouselViewport,
  Slide: CarouselSlide,
  Controls: CarouselControls,
  Previous: CarouselPrevious,
  Next: CarouselNext,
  Indicators: CarouselIndicators,
  Indicator: CarouselIndicator,
  Status: CarouselStatus,
  Autoplay: CarouselAutoplay,
};
