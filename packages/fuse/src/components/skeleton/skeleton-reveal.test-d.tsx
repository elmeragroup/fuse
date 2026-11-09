import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type { SkeletonRevealMode, SkeletonRevealProps } from "@elmeragroup/fuse/skeleton";
import { SkeletonReveal } from "@elmeragroup/fuse/skeleton";

type User = { readonly name: string };

declare const maybeUser: User | null;

test("the data form infers its data from data, sample and the render function", () => {
  const _data = (
    <SkeletonReveal data={maybeUser} sample={{ name: "Kari Nordmann" }}>
      {(user) => {
        expectTypeOf(user).toEqualTypeOf<User>();
        return user.name;
      }}
    </SkeletonReveal>
  );
  const _refetch = (
    <SkeletonReveal
      data={{ name: "Ola" }}
      loading
      reveal="sequence"
      label="Henter"
      onReveal={() => undefined}>
      {(user) => user.name}
    </SkeletonReveal>
  );
});

test("the plain form takes loading and children, and no data or sample", () => {
  const _plain = (
    <SkeletonReveal loading className="w-full" id="balance" render={<section />}>
      <p>Balance</p>
    </SkeletonReveal>
  );
  // @ts-expect-error -- plain children need `loading`
  const _noLoading = <SkeletonReveal>{"Balance"}</SkeletonReveal>;
  const _sample = (
    // @ts-expect-error -- a sample draws only a render function's data
    <SkeletonReveal loading sample={{ name: "Kari" }}>
      {"Balance"}
    </SkeletonReveal>
  );
  // @ts-expect-error -- data needs a render function
  const _dataNode = <SkeletonReveal data={{ name: "Kari" }}>{"Balance"}</SkeletonReveal>;
});

test("the sample and the render function must agree with the data", () => {
  const _mismatch = (
    // @ts-expect-error -- the sample is not a User
    <SkeletonReveal data={maybeUser} sample={{ id: 1 }}>
      {(user: User) => user.name}
    </SkeletonReveal>
  );
});

test("reveal takes the three modes", () => {
  expectTypeOf<SkeletonRevealMode>().toEqualTypeOf<"smart" | "together" | "sequence">();
  expectTypeOf<NonNullable<SkeletonRevealProps["reveal"]>>().toEqualTypeOf<SkeletonRevealMode>();
  const _sweep = (
    <SkeletonReveal
      loading
      // @ts-expect-error -- not a reveal mode
      reveal="sweep">
      {"Balance"}
    </SkeletonReveal>
  );
  expectTypeOf<SkeletonRevealProps<User>>().toMatchTypeOf<{
    children: ReactNode | ((data: User) => ReactNode);
  }>();
});
