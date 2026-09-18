import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { Skeleton as RootSkeleton } from "@elmeragroup/ui";
import * as SkeletonModule from "@elmeragroup/ui/skeleton";
import type { SkeletonProps } from "@elmeragroup/ui/skeleton";
import { Skeleton } from "@elmeragroup/ui/skeleton";

test("Skeleton ships from the skeleton entry and the root barrel", () => {
  expectTypeOf<typeof Skeleton>().toEqualTypeOf<typeof RootSkeleton>();
  expectTypeOf(Skeleton).toBeFunction();
});

test("public API exports only the component — the recipe stays private", () => {
  expectTypeOf(SkeletonModule).not.toHaveProperty("skeletonVariants");
});

test("SkeletonProps is native div props plus the silhouette recipe axis", () => {
  expectTypeOf<SkeletonProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SkeletonProps["id"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SkeletonProps["ref"]>().toEqualTypeOf<ComponentProps<"div">["ref"]>();
  expectTypeOf<SkeletonProps["silhouette"]>().toEqualTypeOf<"rounded" | "circle" | undefined>();
});

test("the element takes native div props and no namespace or as prop", () => {
  const _circled = <Skeleton silhouette="circle" className="size-10" />;
  const _rounded = <Skeleton silhouette="rounded" data-loading="row" />;
  const _defaulted = <Skeleton className="h-4 w-full max-w-24" id="line" />;
  const _ref = <Skeleton ref={null} />;

  expectTypeOf(Skeleton).not.toHaveProperty("Root");
  expectTypeOf<SkeletonProps>().not.toHaveProperty("as");

  // @ts-expect-error silhouette is the two-value radius axis only
  const _badSilhouette = <Skeleton silhouette="square" />;
});
