import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { Textarea as RootTextarea } from "@elmeragroup/ui";
import type { TextareaProps } from "@elmeragroup/ui/textarea";
import { Textarea } from "@elmeragroup/ui/textarea";

test("Textarea ships from the textarea entry and the root barrel", () => {
  expectTypeOf<typeof Textarea>().toEqualTypeOf<typeof RootTextarea>();
  expectTypeOf(Textarea).toBeFunction();
});

test("TextareaProps is the native textarea surface, with no recipe axis and no render prop", () => {
  expectTypeOf<TextareaProps>().toEqualTypeOf<ComponentProps<"textarea">>();

  const _area = <Textarea aria-label="Notes" maxLength={200} rows={4} />;

  // @ts-expect-error the min-h floor is not a control rung; there is no size axis
  const _noSize = <Textarea size="lg" />;
  // @ts-expect-error the box is not variant-axed
  const _noVariant = <Textarea variant="ghost" />;
  // @ts-expect-error Textarea takes the native element only — no useRender polymorphism
  const _noRender = <Textarea render={<input />} />;
});
