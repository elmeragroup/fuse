import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type { Show as RootShow } from "@elmeragroup/ui";
import type { ShowProps } from "@elmeragroup/ui/show";
import { Show } from "@elmeragroup/ui/show";

test("Show ships from the show entry and the root barrel", () => {
  expectTypeOf<typeof Show>().toEqualTypeOf<typeof RootShow>();
  expectTypeOf(Show).toBeFunction();
});

test("when accepts only boolean — no truthy coercion at the type level", () => {
  expectTypeOf<ShowProps["when"]>().toEqualTypeOf<boolean>();
  expectTypeOf<ShowProps["children"]>().toEqualTypeOf<ReactNode | undefined>();

  const items: unknown[] = [];
  const _true = <Show when={true}>shown</Show>;
  const _false = <Show when={false}>hidden</Show>;
  const _coerced = <Show when={items.length > 0}>list</Show>;

  // @ts-expect-error when is boolean, not a truthy number
  const _number = <Show when={1}>no</Show>;
  // @ts-expect-error when is boolean, not a length
  const _length = <Show when={items.length}>no</Show>;
});

test("the helper has no namespace, fallback, or as prop", () => {
  expectTypeOf(Show).not.toHaveProperty("Root");
  expectTypeOf<ShowProps>().not.toHaveProperty("fallback");
  expectTypeOf<ShowProps>().not.toHaveProperty("as");
});
