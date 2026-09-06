import { expectTypeOf, test } from "vitest";

import type { Toggle as RootToggle } from "@elmeragroup/ui";
import type { ToggleProps } from "@elmeragroup/ui/toggle";
import { Toggle, toggleVariants } from "@elmeragroup/ui/toggle";

test("Toggle ships from the toggle entry and the root barrel", () => {
  expectTypeOf<typeof Toggle>().toEqualTypeOf<typeof RootToggle>();
  expectTypeOf(Toggle).toBeFunction();
});

test("ToggleProps is the primitive surface plus the recipe axes", () => {
  expectTypeOf<ToggleProps["variant"]>().toEqualTypeOf<"default" | "outline" | undefined>();
  expectTypeOf<ToggleProps["size"]>().toEqualTypeOf<"xs" | "sm" | "default" | "lg" | undefined>();
  expectTypeOf<ToggleProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<ToggleProps["pressed"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ToggleProps["defaultPressed"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ToggleProps>().not.toHaveProperty("as");
});

test("toggleVariants is public and returns a class string", () => {
  expectTypeOf(toggleVariants).toBeFunction();
  expectTypeOf(toggleVariants({ variant: "outline", size: "sm" })).toBeString();
  expectTypeOf(toggleVariants()).toBeString();
});

test("the element takes the public props and no polymorphic as prop", () => {
  const _basic = <Toggle>Bold</Toggle>;
  const _axes = (
    <Toggle variant="outline" size="xs" className="uppercase">
      Bold
    </Toggle>
  );
  const _controlled = <Toggle pressed onPressedChange={() => undefined} aria-label="Bold" />;

  // @ts-expect-error ghost is not a toggle variant
  const _badVariant = <Toggle variant="ghost" />;
  // @ts-expect-error sizes are xs | sm | default | lg only
  const _badSize = <Toggle size="xl" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Toggle as="div" />;
});
