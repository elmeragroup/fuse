import { expectTypeOf, test } from "vitest";

import type { InputGroup as RootInputGroup } from "@elmeragroup/ui";
import { InputGroup } from "@elmeragroup/ui/input-group";
import type { InputGroupAddonProps, InputGroupButtonProps } from "@elmeragroup/ui/input-group";

test("InputGroup ships from the input-group entry and the root barrel", () => {
  expectTypeOf<typeof InputGroup>().toEqualTypeOf<typeof RootInputGroup>();
  expectTypeOf(InputGroup.Root).toBeFunction();
  expectTypeOf(InputGroup.Addon).toBeFunction();
  expectTypeOf(InputGroup.Button).toBeFunction();
  expectTypeOf(InputGroup.Text).toBeFunction();
  expectTypeOf(InputGroup.Input).toBeFunction();
  expectTypeOf(InputGroup.Textarea).toBeFunction();
});

test("the addon align axis is the four spec values", () => {
  expectTypeOf<InputGroupAddonProps["align"]>().toEqualTypeOf<
    "inline-start" | "inline-end" | "block-start" | "block-end" | undefined
  >();
});

test("the button takes the local compact size subset and a non-submitting type", () => {
  expectTypeOf<InputGroupButtonProps["size"]>().toEqualTypeOf<
    "xs" | "sm" | "icon-xs" | "icon-sm" | undefined
  >();
  expectTypeOf<InputGroupButtonProps["type"]>().toEqualTypeOf<"button" | "submit" | "reset" | undefined>();
});

test("the parts take the spec's props and no polymorphic as prop", () => {
  const _grouped = (
    <InputGroup.Root>
      <InputGroup.Addon align="inline-start">
        <InputGroup.Text>NO</InputGroup.Text>
      </InputGroup.Addon>
      <InputGroup.Input aria-label="Account" placeholder="1234" />
      <InputGroup.Addon align="inline-end">
        <InputGroup.Button size="icon-xs" variant="ghost" aria-label="Clear" />
      </InputGroup.Addon>
    </InputGroup.Root>
  );

  const _textarea = (
    <InputGroup.Root>
      <InputGroup.Textarea aria-label="Message" rows={3} />
    </InputGroup.Root>
  );

  // @ts-expect-error Button's own control-box `size` values are not accepted (§4)
  const _badSize = <InputGroup.Button size="lg" />;
  // @ts-expect-error `align` is the four-value axis only
  const _badAlign = <InputGroup.Addon align="top" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <InputGroup.Root as="section" />;
});
