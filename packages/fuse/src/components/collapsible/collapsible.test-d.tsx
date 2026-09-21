import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { Collapsible as RootCollapsible } from "@elmeragroup/fuse";
import * as CollapsibleModule from "@elmeragroup/fuse/collapsible";
import { Collapsible } from "@elmeragroup/fuse/collapsible";

test("the namespace ships all three parts from the collapsible entry and the root barrel", () => {
  expectTypeOf<typeof Collapsible>().toEqualTypeOf<typeof RootCollapsible>();
  expectTypeOf(Collapsible).toHaveProperty("Root");
  expectTypeOf(Collapsible).toHaveProperty("Trigger");
  expectTypeOf(Collapsible).toHaveProperty("Content");
});

test("public API exports only the namespace — flat parts and Panel stay private", () => {
  expectTypeOf(CollapsibleModule).not.toHaveProperty("collapsibleVariants");
  expectTypeOf(CollapsibleModule).not.toHaveProperty("CollapsibleRoot");
  expectTypeOf(CollapsibleModule).not.toHaveProperty("CollapsibleTrigger");
  expectTypeOf(CollapsibleModule).not.toHaveProperty("CollapsibleContent");
  expectTypeOf(CollapsibleModule).not.toHaveProperty("CollapsiblePanel");
  expectTypeOf(Collapsible).not.toHaveProperty("Panel");
});

test("parts take the primitive passthrough surface and no as prop", () => {
  const _tree = (
    <Collapsible.Root defaultOpen disabled={false} onOpenChange={() => undefined}>
      <Collapsible.Trigger nativeButton render={<button type="button" />}>
        Show details
      </Collapsible.Trigger>
      <Collapsible.Content keepMounted hiddenUntilFound>
        Details
      </Collapsible.Content>
    </Collapsible.Root>
  );
  const _controlled = (
    <Collapsible.Root open onOpenChange={() => undefined}>
      <Collapsible.Trigger disabled>Show details</Collapsible.Trigger>
      <Collapsible.Content />
    </Collapsible.Root>
  );
  const _ref = <Collapsible.Root ref={null} />;

  expectTypeOf<ComponentProps<typeof Collapsible.Root>>().toHaveProperty("open");
  expectTypeOf<ComponentProps<typeof Collapsible.Root>>().toHaveProperty("defaultOpen");
  expectTypeOf<ComponentProps<typeof Collapsible.Root>>().toHaveProperty("onOpenChange");
  expectTypeOf<ComponentProps<typeof Collapsible.Root>>().toHaveProperty("disabled");
  expectTypeOf<ComponentProps<typeof Collapsible.Root>>().toHaveProperty("render");
  expectTypeOf<ComponentProps<typeof Collapsible.Trigger>>().toHaveProperty("disabled");
  expectTypeOf<ComponentProps<typeof Collapsible.Trigger>>().toHaveProperty("nativeButton");
  expectTypeOf<ComponentProps<typeof Collapsible.Trigger>>().toHaveProperty("render");
  expectTypeOf<ComponentProps<typeof Collapsible.Content>>().toHaveProperty("hiddenUntilFound");
  expectTypeOf<ComponentProps<typeof Collapsible.Content>>().toHaveProperty("keepMounted");
  expectTypeOf<ComponentProps<typeof Collapsible.Content>>().toHaveProperty("render");

  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <Collapsible.Trigger as="div" />;
});
