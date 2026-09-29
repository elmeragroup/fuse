import { expectTypeOf, test } from "vitest";

import { InputGroup } from "@elmeragroup/fuse/input-group";
import type { InputGroupAddonProps, InputGroupButtonProps } from "@elmeragroup/fuse/input-group";

test("the parts take the four-value addon align axis, the compact non-submitting button, and no polymorphic as prop", () => {
  expectTypeOf<InputGroupAddonProps["align"]>().toEqualTypeOf<
    "inline-start" | "inline-end" | "block-start" | "block-end" | undefined
  >();

  expectTypeOf<InputGroupButtonProps["size"]>().toEqualTypeOf<
    "xs" | "sm" | "icon-xs" | "icon-sm" | undefined
  >();
  expectTypeOf<InputGroupButtonProps["type"]>().toEqualTypeOf<"button" | "submit" | "reset" | undefined>();

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

  // @ts-expect-error Button's own control-box `size` values are not accepted
  const _badSize = <InputGroup.Button size="lg" />;
  // @ts-expect-error icon-sm requires aria-label
  const _unlabeledIconSm = <InputGroup.Button size="icon-sm" />; // oxlint-disable-line elmera/require-icon-button-label -- type-level icon-name contract under test
  // @ts-expect-error icon-xs requires aria-label
  const _unlabeledIconXs = <InputGroup.Button size="icon-xs" />; // oxlint-disable-line elmera/require-icon-button-label -- type-level icon-name contract under test
  // @ts-expect-error `align` is the four-value axis only
  const _badAlign = <InputGroup.Addon align="top" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <InputGroup.Root as="section" />;
});
