import { createRef } from "react";

import { expectTypeOf, test } from "vitest";

import type { PopoverContentProps } from "@elmeragroup/fuse/popover";
import { Popover } from "@elmeragroup/fuse/popover";

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

test("Content takes an element, a ref, a virtual element or a function as its anchor", () => {
  const ref = createRef<HTMLDivElement>();
  const _element = <Popover.Content anchor={document.body} />;
  const _ref = <Popover.Content anchor={ref} />;
  const _function = <Popover.Content anchor={() => ref.current} />;
  const _virtual = <Popover.Content anchor={{ getBoundingClientRect: () => new DOMRect(0, 0, 10, 10) }} />;
  const _none = <Popover.Content anchor={null} />;

  // @ts-expect-error a selector string is not an anchor
  const _selector = <Popover.Content anchor="#target" />;
});
