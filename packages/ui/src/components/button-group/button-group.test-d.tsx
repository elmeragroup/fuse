import { expectTypeOf, test } from "vitest";

import type { ButtonGroup as RootButtonGroup } from "@elmeragroup/ui";
import * as ButtonGroupModule from "@elmeragroup/ui/button-group";
import { ButtonGroup, buttonGroupVariants } from "@elmeragroup/ui/button-group";

test("the namespace ships Root, Separator, and Text from the button-group entry and the root barrel", () => {
  expectTypeOf<typeof ButtonGroup>().toEqualTypeOf<typeof RootButtonGroup>();
  expectTypeOf(ButtonGroup).toHaveProperty("Root");
  expectTypeOf(ButtonGroup).toHaveProperty("Separator");
  expectTypeOf(ButtonGroup).toHaveProperty("Text");
});

test("public API exports the namespace and recipe, never the flat ref names", () => {
  expectTypeOf(buttonGroupVariants).toBeFunction();
  expectTypeOf(buttonGroupVariants({ orientation: "vertical" })).toBeString();
  expectTypeOf(buttonGroupVariants()).toBeString();

  expectTypeOf(ButtonGroupModule).not.toHaveProperty("ButtonGroupSeparator");
  expectTypeOf(ButtonGroupModule).not.toHaveProperty("ButtonGroupText");
  expectTypeOf(ButtonGroup).not.toHaveProperty("Addon");
});

test("parts take the public props, Text render, and no polymorphic as prop", () => {
  const _root = (
    <ButtonGroup.Root orientation="horizontal" className="w-full" aria-label="Actions">
      <ButtonGroup.Text>https://</ButtonGroup.Text>
      <ButtonGroup.Text render={<label htmlFor="amount" />}>NOK</ButtonGroup.Text>
      <ButtonGroup.Separator />
      <ButtonGroup.Separator orientation="horizontal" />
    </ButtonGroup.Root>
  );
  const _vertical = <ButtonGroup.Root orientation="vertical" />;
  const _ref = <ButtonGroup.Root ref={null} />;

  // @ts-expect-error orientation is horizontal | vertical only
  const _badOrientation = <ButtonGroup.Root orientation="responsive" />;
  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <ButtonGroup.Root as="section" />;
  // @ts-expect-error Text polymorphism is render, not as
  const _noTextAs = <ButtonGroup.Text as="span" />;
});
