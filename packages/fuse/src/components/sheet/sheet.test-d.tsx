import { expectTypeOf, test } from "vitest";

import type { Sheet as RootSheet } from "@elmeragroup/fuse";
import type { SheetContentProps, SheetRootProps } from "@elmeragroup/fuse/sheet";
import { Sheet } from "@elmeragroup/fuse/sheet";

test("Sheet ships from the sheet entry and the root barrel", () => {
  expectTypeOf<typeof Sheet>().toEqualTypeOf<typeof RootSheet>();
  expectTypeOf(Sheet.Root).toBeFunction();
  expectTypeOf(Sheet.Trigger).toBeFunction();
  expectTypeOf(Sheet.Close).toBeFunction();
  expectTypeOf(Sheet.Portal).toBeFunction();
  expectTypeOf(Sheet.Overlay).toBeFunction();
  expectTypeOf(Sheet.Content).toBeFunction();
  expectTypeOf(Sheet.Header).toBeFunction();
  expectTypeOf(Sheet.Body).toBeFunction();
  expectTypeOf(Sheet.Footer).toBeFunction();
  expectTypeOf(Sheet.Title).toBeFunction();
  expectTypeOf(Sheet.Description).toBeFunction();
});

test("swipeDirection stays off the public Root props and sheetContentVariants is not exported", () => {
  expectTypeOf<SheetRootProps>().not.toHaveProperty("swipeDirection");
  expectTypeOf<SheetContentProps["showCloseButton"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SheetContentProps["closeLabel"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SheetContentProps["size"]>().toEqualTypeOf<
    | "sm"
    | "md"
    | "lg"
    | "xl"
    | "2xl"
    | "3xl"
    | "4xl"
    | "5xl"
    | "6xl"
    | "7xl"
    | "8xl"
    | "9xl"
    | "10xl"
    | undefined
  >();

  const _root = <Sheet.Root side="left" />;
  const _content = <Sheet.Content size="sm" showCloseButton closeLabel="Dismiss" />;

  // @ts-expect-error swipeDirection is coupled to side and omitted from Root
  const _noSwipe = <Sheet.Root swipeDirection="left" />;

  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Sheet.Trigger as="div" />;
});
