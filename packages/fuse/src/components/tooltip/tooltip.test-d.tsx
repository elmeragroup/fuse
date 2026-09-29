import { expectTypeOf, test } from "vitest";

import type { TooltipContentProps, TooltipProviderProps, TooltipRootProps } from "@elmeragroup/fuse/tooltip";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

test("Content takes the positioner props and container, and Root takes per-tooltip delay", () => {
  expectTypeOf<TooltipContentProps["side"]>().toEqualTypeOf<
    "top" | "bottom" | "left" | "right" | "inline-end" | "inline-start" | undefined
  >();
  expectTypeOf<TooltipContentProps["align"]>().toEqualTypeOf<"start" | "center" | "end" | undefined>();
  expectTypeOf<TooltipRootProps["delay"]>().toEqualTypeOf<number | undefined>();
  expectTypeOf<TooltipProviderProps["delay"]>().toEqualTypeOf<number | undefined>();
  expectTypeOf<TooltipContentProps>().not.toHaveProperty("showArrow");

  const _tree = (
    <Tooltip.Provider delay={0}>
      <Tooltip.Root delay={500}>
        <Tooltip.Trigger />
        <Tooltip.Content side="top" align="start" sideOffset={8} alignOffset={4} />
      </Tooltip.Root>
    </Tooltip.Provider>
  );

  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Tooltip.Trigger as="div" />;
});
