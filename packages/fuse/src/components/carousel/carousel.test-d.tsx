import type { MouseEvent } from "react";

import { expectTypeOf, test } from "vitest";

import { Carousel } from "@elmeragroup/fuse/carousel";
import type {
  CarouselIndexChangeReason,
  CarouselOrientation,
  CarouselRootProps,
  CarouselState,
  useCarousel,
} from "@elmeragroup/fuse/carousel";

test("Root requires an accessible name, by aria-label or aria-labelledby", () => {
  const _labelled = <Carousel.Root aria-label="Offers" />;
  const _byHeading = <Carousel.Root aria-labelledby="offers-heading" />;
  // @ts-expect-error a carousel region needs a name
  const _unnamed = <Carousel.Root />;
  // @ts-expect-error an undefined name is no name
  const _undefinedName = <Carousel.Root aria-label={undefined} />;
});

test("Root takes the page controlled or not, and only the two orientations", () => {
  const _controlled = (
    <Carousel.Root aria-label="Offers" index={2} onIndexChange={(_index, _details) => undefined} />
  );
  const _uncontrolled = <Carousel.Root aria-label="Offers" defaultIndex={1} orientation="vertical" />;
  // @ts-expect-error orientation is horizontal | vertical
  const _diagonal = <Carousel.Root aria-label="Offers" orientation="diagonal" />;
  expectTypeOf<CarouselOrientation>().toEqualTypeOf<"horizontal" | "vertical">();
  expectTypeOf<Parameters<NonNullable<CarouselRootProps["onIndexChange"]>>>().toEqualTypeOf<
    [index: number, details: { readonly reason: CarouselIndexChangeReason }]
  >();
  expectTypeOf<CarouselIndexChangeReason>().toEqualTypeOf<
    "scroll" | "previous" | "next" | "indicator" | "autoplay" | "action"
  >();
});

test("Autoplay requires its delay, and takes no boolean feature props", () => {
  const _autoplay = <Carousel.Autoplay delay={5000} />;
  // @ts-expect-error mounting Autoplay is the opt-in, and its delay has no default
  const _noDelay = <Carousel.Autoplay />;
  // @ts-expect-error features are parts, not booleans
  const _loop = <Carousel.Root aria-label="Offers" loop />;
});

test("Indicator requires the page it shows", () => {
  const _indicator = <Carousel.Indicator index={0} />;
  const _thumbnail = (
    <Carousel.Indicator index={1}>
      <img alt="Winter offer" src="/winter.png" />
    </Carousel.Indicator>
  );
  // @ts-expect-error an indicator needs its page
  const _noIndex = <Carousel.Indicator />;
});

test("every control's onClick can cancel the control's own action", () => {
  const _previous = <Carousel.Previous onClick={(event) => event.preventBaseUIHandler()} />;
  const _next = <Carousel.Next onClick={(event) => event.preventBaseUIHandler()} />;
  const _indicator = <Carousel.Indicator index={0} onClick={(event) => event.preventBaseUIHandler()} />;
  const _autoplay = <Carousel.Autoplay delay={5000} onClick={(event) => event.preventBaseUIHandler()} />;
  // A plain React handler still fits.
  const _plain = <Carousel.Indicator index={0} onClick={(_event: MouseEvent) => undefined} />;
});

test("Previous and Next take Button's icon sizes and an optional name", () => {
  const _previous = <Carousel.Previous size="icon" aria-label="Back" />;
  const _next = <Carousel.Next variant="ghost" />;
  // @ts-expect-error the edges are icon-only squares
  const _labelSize = <Carousel.Next size="lg" />;
});

test("useCarousel exposes state, actions and meta, and keeps the wiring private", () => {
  type Value = ReturnType<typeof useCarousel>;
  expectTypeOf<Value["state"]>().toEqualTypeOf<CarouselState>();
  expectTypeOf<CarouselState>().toEqualTypeOf<{
    readonly index: number;
    readonly pageCount: number;
    readonly canPrevious: boolean;
    readonly canNext: boolean;
    readonly rotating: boolean;
  }>();
  expectTypeOf<Value["actions"]["goTo"]>().toEqualTypeOf<(index: number) => void>();
  expectTypeOf<Value["actions"]["play"]>().toEqualTypeOf<() => void>();
  expectTypeOf<Value["meta"]>().toEqualTypeOf<{ readonly orientation: CarouselOrientation }>();
  expectTypeOf<Value>().not.toHaveProperty("wiring");
});
