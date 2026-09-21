import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { Code as RootCode } from "@elmeragroup/fuse";
import type { CodeProps } from "@elmeragroup/fuse/code";
import { Code } from "@elmeragroup/fuse/code";

test("Code ships from the code entry and the root barrel", () => {
  expectTypeOf<typeof Code>().toEqualTypeOf<typeof RootCode>();
  expectTypeOf(Code).toBeFunction();
});

test("CodeProps is pre props without children plus the required code string", () => {
  expectTypeOf<CodeProps["code"]>().toEqualTypeOf<string>();
  expectTypeOf<CodeProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<CodeProps["id"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<CodeProps["ref"]>().toEqualTypeOf<ComponentProps<"pre">["ref"]>();
  expectTypeOf<CodeProps>().not.toHaveProperty("children");
});

test("the element takes native pre props and no namespace, children, or as prop", () => {
  const _basic = <Code code="const answer = 42;" />;
  const _labelled = <Code code="const answer = 42;" id="answer" aria-label="Answer snippet" />;
  const _ref = <Code ref={null} code="const answer = 42;" />;

  expectTypeOf(Code).not.toHaveProperty("Root");
  expectTypeOf<CodeProps>().not.toHaveProperty("as");

  // @ts-expect-error code is required
  const _missing = <Code />;
  // @ts-expect-error content comes exclusively from the code prop
  const _children = <Code code="const answer = 42;">nope</Code>;
  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <Code as="div" code="const answer = 42;" />;
});
