// Source entry facade for `@elmeragroup/fuse/carousel`. The file holds only explicit named
// re-exports, with no `export *`, no local declarations and no directives.
// The exports and barrel generators discover this file, so never hand-edit package.json#exports
// or src/index.ts. There is no public recipe, and the part classes stay module-private.
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
