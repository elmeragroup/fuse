import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { ScrollArea as RootScrollArea } from "@elmeragroup/ui";
import { ScrollArea } from "@elmeragroup/ui/scroll-area";

test("the public namespace is Root + Bar on both entries", () => {
  expectTypeOf<typeof ScrollArea>().toEqualTypeOf<typeof RootScrollArea>();
  expectTypeOf(ScrollArea.Root).toBeFunction();
  expectTypeOf(ScrollArea.Bar).toBeFunction();
  expectTypeOf(ScrollArea).not.toHaveProperty("ScrollBar");
  expectTypeOf(ScrollArea).not.toHaveProperty("Viewport");
  expectTypeOf(ScrollArea).not.toHaveProperty("Content");
  expectTypeOf(ScrollArea).not.toHaveProperty("Corner");
});

test("Root and Bar take orientation and type, not as", () => {
  type RootProps = ComponentProps<typeof ScrollArea.Root>;
  type BarProps = ComponentProps<typeof ScrollArea.Bar>;

  expectTypeOf<RootProps["orientation"]>().toEqualTypeOf<"vertical" | "horizontal" | undefined>();
  expectTypeOf<RootProps["type"]>().toEqualTypeOf<"auto" | "always" | "hover" | undefined>();
  expectTypeOf<BarProps["orientation"]>().toEqualTypeOf<"vertical" | "horizontal" | undefined>();
  expectTypeOf<BarProps["type"]>().toEqualTypeOf<"auto" | "always" | "hover" | undefined>();
  expectTypeOf<RootProps>().not.toHaveProperty("as");
  expectTypeOf<BarProps>().not.toHaveProperty("as");

  const _root = <ScrollArea.Root orientation="horizontal" type="always" />;
  const _bar = <ScrollArea.Bar orientation="horizontal" type="auto" keepMounted />;
});
