import { expectTypeOf, test } from "vitest";

import type { ToggleGroup as RootToggleGroup } from "@elmeragroup/fuse";
import type { ToggleGroupItemProps, ToggleGroupRootProps } from "@elmeragroup/fuse/toggle-group";
import * as ToggleGroupModule from "@elmeragroup/fuse/toggle-group";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

test("the namespace ships Root and Item from the toggle-group entry and the root barrel", () => {
  expectTypeOf<typeof ToggleGroup>().toEqualTypeOf<typeof RootToggleGroup>();
  expectTypeOf(ToggleGroup).toHaveProperty("Root");
  expectTypeOf(ToggleGroup).toHaveProperty("Item");
  expectTypeOf(ToggleGroup.Root).toBeFunction();
  expectTypeOf(ToggleGroup.Item).toBeFunction();
});

test("public API exports only the namespace — never flat ref names or toggleVariants", () => {
  expectTypeOf(ToggleGroupModule).not.toHaveProperty("toggleVariants");
  expectTypeOf(ToggleGroupModule).not.toHaveProperty("toggleGroupVariants");
  expectTypeOf(ToggleGroupModule).not.toHaveProperty("ToggleGroupItem");
  expectTypeOf(ToggleGroupModule).not.toHaveProperty("ToggleGroupRoot");
  expectTypeOf(ToggleGroup).not.toHaveProperty("List");
  expectTypeOf(ToggleGroup).not.toHaveProperty("Trigger");
});

test("Root and Item take the public props and no polymorphic as prop", () => {
  expectTypeOf<ToggleGroupRootProps["variant"]>().toEqualTypeOf<"default" | "outline" | undefined>();
  expectTypeOf<ToggleGroupRootProps["size"]>().toEqualTypeOf<"xs" | "sm" | "default" | "lg" | undefined>();
  expectTypeOf<ToggleGroupRootProps["spacing"]>().toEqualTypeOf<number | undefined>();
  expectTypeOf<ToggleGroupRootProps["orientation"]>().toEqualTypeOf<"horizontal" | "vertical" | undefined>();
  expectTypeOf<ToggleGroupRootProps["multiple"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ToggleGroupRootProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<ToggleGroupRootProps>().not.toHaveProperty("as");
  expectTypeOf<ToggleGroupItemProps["variant"]>().toEqualTypeOf<"default" | "outline" | undefined>();
  expectTypeOf<ToggleGroupItemProps["size"]>().toEqualTypeOf<"xs" | "sm" | "default" | "lg" | undefined>();
  expectTypeOf<ToggleGroupItemProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<ToggleGroupItemProps>().not.toHaveProperty("as");

  const _tree = (
    <ToggleGroup.Root
      variant="outline"
      size="sm"
      spacing={0}
      orientation="horizontal"
      multiple={false}
      defaultValue={["left"]}
      onValueChange={() => undefined}
      aria-label="Align">
      <ToggleGroup.Item value="left" aria-label="Align left">
        Left
      </ToggleGroup.Item>
      <ToggleGroup.Item value="right" size="lg" variant="default">
        Right
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  );
  const _vertical = (
    <ToggleGroup.Root orientation="vertical" multiple>
      <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
    </ToggleGroup.Root>
  );
  const _standalone = <ToggleGroup.Item value="alone">Alone</ToggleGroup.Item>;
  const _ref = <ToggleGroup.Root ref={null} />;

  // @ts-expect-error ghost is not a toggle variant
  const _badVariant = <ToggleGroup.Root variant="ghost" />;
  // @ts-expect-error sizes are xs | sm | default | lg only
  const _badSize = <ToggleGroup.Item size="xl" />;
  // @ts-expect-error orientation is horizontal | vertical only
  const _badOrientation = <ToggleGroup.Root orientation="responsive" />;
  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <ToggleGroup.Root as="section" />;
  // @ts-expect-error Item polymorphism is never an as prop
  const _noItemAs = <ToggleGroup.Item as="div" />;
});
