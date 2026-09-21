import type { ReactNode, RefObject } from "react";

import { expectTypeOf, test } from "vitest";

import type { PopoverInfoButton as RootPopoverInfoButton } from "@elmeragroup/fuse";
import type { PopoverInfoButtonProps } from "@elmeragroup/fuse/popover-info-button";
import * as PopoverInfoButtonModule from "@elmeragroup/fuse/popover-info-button";
import { PopoverInfoButton } from "@elmeragroup/fuse/popover-info-button";

test("PopoverInfoButton ships from the popover-info-button entry and the root barrel", () => {
  expectTypeOf<typeof PopoverInfoButton>().toEqualTypeOf<typeof RootPopoverInfoButton>();
  expectTypeOf(PopoverInfoButton).toBeFunction();
});

test("the recipe stays off the public module and locale is provider-only", () => {
  expectTypeOf(PopoverInfoButtonModule).not.toHaveProperty("popoverInfoButtonStyles");
  expectTypeOf(PopoverInfoButtonModule).not.toHaveProperty("popoverInfoButtonVariants");
  expectTypeOf<PopoverInfoButtonProps>().not.toHaveProperty("locale");
  expectTypeOf<PopoverInfoButtonProps["label"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<PopoverInfoButtonProps["children"]>().toEqualTypeOf<ReactNode>();
  expectTypeOf<PopoverInfoButtonProps["container"]>().toEqualTypeOf<
    HTMLElement | RefObject<HTMLElement | null> | undefined
  >();
  expectTypeOf<PopoverInfoButtonProps["contentSize"]>().toEqualTypeOf<
    "sm" | "default" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | undefined
  >();
});

test("the element takes Button props, children are required, and icon-sm does not need aria-label", () => {
  const _ok = <PopoverInfoButton>Grid rent is the network fee.</PopoverInfoButton>;
  const _labeled = (
    <PopoverInfoButton label="About grid rent" contentSize="2xl">
      Grid rent is the network fee.
    </PopoverInfoButton>
  );
  const _passthrough = (
    <PopoverInfoButton size="icon-sm" variant="ghost" disabled>
      Grid rent is the network fee.
    </PopoverInfoButton>
  );
  const container: RefObject<HTMLElement | null> = { current: null };
  const _container = (
    <PopoverInfoButton container={container}>Grid rent is the network fee.</PopoverInfoButton>
  );

  // @ts-expect-error children are required
  const _missing = <PopoverInfoButton />;
  // @ts-expect-error locale is provider-only
  const _noLocale = <PopoverInfoButton locale="nb-NO">x</PopoverInfoButton>;
  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <PopoverInfoButton as="div">x</PopoverInfoButton>;
});
