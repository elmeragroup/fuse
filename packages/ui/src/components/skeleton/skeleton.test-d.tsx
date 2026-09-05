import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { Skeleton as RootSkeleton } from "@elmeragroup/ui";
import type { SkeletonProps } from "@elmeragroup/ui/skeleton";
import { Skeleton } from "@elmeragroup/ui/skeleton";

test("Skeleton ships from the skeleton entry and the root barrel", () => {
  expectTypeOf<typeof Skeleton>().toEqualTypeOf<typeof RootSkeleton>();
  expectTypeOf(Skeleton).toBeFunction();
});

test("SkeletonProps is ComponentProps of a div so ref passes through", () => {
  expectTypeOf<SkeletonProps>().toEqualTypeOf<ComponentProps<"div">>();
  expectTypeOf<SkeletonProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SkeletonProps["id"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SkeletonProps["ref"]>().toEqualTypeOf<ComponentProps<"div">["ref"]>();
});

test("the element takes native div props and no namespace or as prop", () => {
  const _sized = <Skeleton className="h-4 w-full max-w-24" id="line" data-loading="row" />;
  const _ref = <Skeleton ref={null} />;

  expectTypeOf(Skeleton).not.toHaveProperty("Root");
  expectTypeOf<SkeletonProps>().not.toHaveProperty("as");
});
