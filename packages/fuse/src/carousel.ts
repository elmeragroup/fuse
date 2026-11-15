// This file is the source entry for `@elmeragroup/fuse/carousel`. It contains only explicit named re-exports,
// with no `export *`, local declarations or directives. The exports and barrel generators read this file, so
// change `package.json#exports` and `src/index.ts` only through them. There is no public recipe, and the part
// classes stay module-private.
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
