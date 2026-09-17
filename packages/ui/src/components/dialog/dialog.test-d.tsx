import { expectTypeOf, test } from "vitest";

import type { Dialog as RootDialog } from "@elmeragroup/ui";
import type { DialogContentProps, DialogFooterProps, DialogTitleProps } from "@elmeragroup/ui/dialog";
import { Dialog } from "@elmeragroup/ui/dialog";

test("the namespace ships all ten parts from the dialog entry and the root barrel", () => {
  expectTypeOf<typeof Dialog>().toEqualTypeOf<typeof RootDialog>();
  expectTypeOf(Dialog).toHaveProperty("Root");
  expectTypeOf(Dialog).toHaveProperty("Trigger");
  expectTypeOf(Dialog).toHaveProperty("Portal");
  expectTypeOf(Dialog).toHaveProperty("Close");
  expectTypeOf(Dialog).toHaveProperty("Overlay");
  expectTypeOf(Dialog).toHaveProperty("Content");
  expectTypeOf(Dialog).toHaveProperty("Header");
  expectTypeOf(Dialog).toHaveProperty("Footer");
  expectTypeOf(Dialog).toHaveProperty("Title");
  expectTypeOf(Dialog).toHaveProperty("Description");
});

test("Content carries the 13-value overlay width axis and the close affordance props", () => {
  expectTypeOf<DialogContentProps["size"]>().toEqualTypeOf<
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
  expectTypeOf<DialogContentProps["showCloseButton"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<DialogContentProps["closeLabel"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<DialogFooterProps["showCloseButton"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<DialogFooterProps["closeLabel"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<DialogTitleProps["isFocusable"]>().toEqualTypeOf<boolean | undefined>();

  const _content = <Dialog.Content size="10xl" showCloseButton={false} closeLabel="Dismiss" />;
  const _footer = <Dialog.Footer showCloseButton closeLabel="Dismiss" />;

  // @ts-expect-error the width axis is the 13 overlay sizes and nothing else
  const _badSize = <Dialog.Content size="xs" />;
  // @ts-expect-error dialogContentVariants is package-private; no recipe prop leaks
  const _noVariant = <Dialog.Content variant="ghost" />;
});

test("parts take useRender's render prop and never a polymorphic as prop", () => {
  const _trigger = <Dialog.Trigger render={<button type="button" />} />;
  const _title = <Dialog.Title render={<h2 />} />;

  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Dialog.Trigger as="span" />;
});
