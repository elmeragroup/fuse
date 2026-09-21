import { expectTypeOf, test } from "vitest";

import type { Loader as RootLoader, loaderVariants as RootLoaderVariants } from "@elmeragroup/fuse";
import type { LoaderProps } from "@elmeragroup/fuse/loader";
import { Loader, loaderVariants } from "@elmeragroup/fuse/loader";

test("Loader and loaderVariants ship from the loader entry and the root barrel", () => {
  expectTypeOf<typeof Loader>().toEqualTypeOf<typeof RootLoader>();
  expectTypeOf<typeof loaderVariants>().toEqualTypeOf<typeof RootLoaderVariants>();
  expectTypeOf(Loader).toBeFunction();
  expectTypeOf(loaderVariants).toBeFunction();
});

test("LoaderProps is native div props plus the recipe axes", () => {
  expectTypeOf<LoaderProps["variant"]>().toEqualTypeOf<"default" | undefined>();
  expectTypeOf<LoaderProps["size"]>().toEqualTypeOf<
    "default" | "small" | "medium" | "large" | "xl" | undefined
  >();
  expectTypeOf<LoaderProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<LoaderProps["id"]>().toEqualTypeOf<string | undefined>();
});

test("loaderVariants is public and returns base/icon slot functions", () => {
  expectTypeOf(loaderVariants().base).toBeFunction();
  expectTypeOf(loaderVariants().icon).toBeFunction();
  expectTypeOf(loaderVariants().base()).toBeString();
  expectTypeOf(loaderVariants({ size: "xl", variant: "default" }).icon()).toBeString();
});

test("the element takes the public props and no polymorphic as prop", () => {
  const _basic = <Loader />;
  const _named = <Loader size="medium" variant="default" aria-label="Laster" className="p-0" />;

  // @ts-expect-error the variant axis is intentionally single-valued
  const _badVariant = <Loader variant="muted" />;
  // @ts-expect-error decorative sizes are default | small | medium | large | xl
  const _badSize = <Loader size="md" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Loader as="span" />;
});
