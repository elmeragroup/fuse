import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import { Collapsible } from "@elmeragroup/fuse/collapsible";

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
