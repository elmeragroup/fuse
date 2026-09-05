import { expectTypeOf, test } from "vitest";

import type { Tooltip as RootTooltip } from "@elmeragroup/ui";
import type { TooltipContentProps, TooltipProviderProps, TooltipRootProps } from "@elmeragroup/ui/tooltip";
import { Tooltip } from "@elmeragroup/ui/tooltip";

test("Tooltip ships from the tooltip entry and the root barrel", () => {
  expectTypeOf<typeof Tooltip>().toEqualTypeOf<typeof RootTooltip>();
  expectTypeOf(Tooltip.Provider).toBeFunction();
  expectTypeOf(Tooltip.Root).toBeFunction();
  expectTypeOf(Tooltip.Trigger).toBeFunction();
  expectTypeOf(Tooltip.Content).toBeFunction();
});

test("Portal, Positioner and Popup stay off the public namespace", () => {
  expectTypeOf(Tooltip).not.toHaveProperty("Portal");
  expectTypeOf(Tooltip).not.toHaveProperty("Positioner");
  expectTypeOf(Tooltip).not.toHaveProperty("Popup");
  expectTypeOf(Tooltip).not.toHaveProperty("Arrow");
});

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
