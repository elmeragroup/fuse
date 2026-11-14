import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { SkeletonProps } from "@elmeragroup/fuse/skeleton";
import { Skeleton } from "@elmeragroup/fuse/skeleton";

// Skeleton redeclares `className` to document it. Flattening both sides to one object type
// compares the props themselves, so the check stays exact.
type Flat<T> = { [K in keyof T]: T[K] };

test("SkeletonProps is ComponentProps of a div so ref passes through, with no namespace or as prop", () => {
  expectTypeOf<Flat<SkeletonProps>>().toEqualTypeOf<Flat<ComponentProps<"div">>>();
  expectTypeOf<SkeletonProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SkeletonProps["id"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SkeletonProps["ref"]>().toEqualTypeOf<ComponentProps<"div">["ref"]>();

  const _sized = <Skeleton className="h-4 w-full max-w-24 rounded-full" id="line" data-loading="row" />;
  const _ref = <Skeleton ref={null} />;

  expectTypeOf(Skeleton).not.toHaveProperty("Root");
  expectTypeOf<SkeletonProps>().not.toHaveProperty("as");
});
