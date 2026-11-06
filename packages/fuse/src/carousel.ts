// Source entry facade for `@elmeragroup/fuse/carousel` (Appendix A). Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. No public recipe. The part classes stay module-private.
export { Carousel } from "./components/carousel";
export { useCarousel } from "./components/carousel/carousel-context";
export type {
  CarouselActions,
  CarouselIndexChangeDetails,
  CarouselIndexChangeReason,
  CarouselMeta,
  CarouselState,
} from "./components/carousel/carousel-context";
export type {
  CarouselName,
  CarouselRootProps,
  CarouselSlideProps,
  CarouselViewportProps,
} from "./components/carousel/carousel";
export type {
  CarouselAutoplayProps,
  CarouselControlsProps,
  CarouselIndicatorProps,
  CarouselIndicatorsProps,
  CarouselNextProps,
  CarouselPreviousProps,
  CarouselStatusProps,
} from "./components/carousel/carousel-controls";
export type { CarouselOrientation } from "./components/carousel/carousel-engine";
