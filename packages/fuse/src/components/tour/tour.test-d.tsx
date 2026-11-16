import { expectTypeOf, test } from "vitest";

import { Tour, defineTour, useTour, useTourStep } from "@elmeragroup/fuse/tour";
import type { TourDefinition, TourHandle } from "@elmeragroup/fuse/tour";

const welcome = defineTour({ id: "welcome", steps: ["intro", "usage", "price"] });

test("a definition's step ids are a union, and every part and hook that names a step takes only those", () => {
  expectTypeOf(welcome).toEqualTypeOf<TourDefinition<"intro" | "usage" | "price">>();
  expectTypeOf<TourHandle<"intro" | "usage" | "price">["stepId"]>().toEqualTypeOf<
    "intro" | "usage" | "price" | null
  >();

  const _target = <Tour.Target tour={welcome} step="usage" title="Usage" />;
  // @ts-expect-error a step the definition does not list
  const _wrongTarget = <Tour.Target tour={welcome} step="pricing" />;

  const useParts = () => {
    useTourStep(welcome, "price");
    // @ts-expect-error a step the definition does not list
    useTourStep(welcome, "pricing");
    const tour = useTour(welcome);
    tour.start("intro");
    // @ts-expect-error a step the definition does not list
    tour.start("pricing");
  };
  expectTypeOf(useParts).toBeFunction();

  defineTour({
    id: "content",
    steps: ["intro"],
    // @ts-expect-error words for a step the definition does not list
    content: { outro: { title: "Bye" } },
  });
});

test("a Target's ref is its element's, and the popup takes Base UI's names", () => {
  const _ref = (
    <Tour.Target tour={welcome} step="usage" ref={(_element: HTMLDivElement | null) => undefined} />
  );
  const _popup = (
    <Tour.Popup tour={welcome} modal="trap-focus" initialFocus={false} collisionPadding={{ top: 64 }} />
  );
  // @ts-expect-error parts take no boolean mode props
  const _mode = <Tour.Popup tour={welcome} guided />;
});
