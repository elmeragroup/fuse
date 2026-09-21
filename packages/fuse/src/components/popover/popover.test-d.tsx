import { expectTypeOf, test } from "vitest";

import type { Popover as RootPopover } from "@elmeragroup/fuse";
import type { PopoverContentProps } from "@elmeragroup/fuse/popover";
import { Popover } from "@elmeragroup/fuse/popover";

test("Popover ships from the popover entry and the root barrel", () => {
  expectTypeOf<typeof Popover>().toEqualTypeOf<typeof RootPopover>();
  expectTypeOf(Popover.Root).toBeFunction();
  expectTypeOf(Popover.Trigger).toBeFunction();
  expectTypeOf(Popover.Content).toBeFunction();
  expectTypeOf(Popover.Header).toBeFunction();
  expectTypeOf(Popover.Title).toBeFunction();
  expectTypeOf(Popover.Description).toBeFunction();
});

test("Portal, Positioner and Popup stay off the public namespace", () => {
  expectTypeOf(Popover).not.toHaveProperty("Portal");
  expectTypeOf(Popover).not.toHaveProperty("Positioner");
  expectTypeOf(Popover).not.toHaveProperty("Popup");
});

test("Content takes the positioner props, showArrow and container", () => {
  expectTypeOf<PopoverContentProps["showArrow"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<PopoverContentProps["side"]>().toEqualTypeOf<
    "top" | "bottom" | "left" | "right" | "inline-end" | "inline-start" | undefined
  >();
  expectTypeOf<PopoverContentProps["align"]>().toEqualTypeOf<"start" | "center" | "end" | undefined>();

  const _content = <Popover.Content showArrow side="top" align="start" sideOffset={8} alignOffset={4} />;

  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Popover.Trigger as="div" />;
});
