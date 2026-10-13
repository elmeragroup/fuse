import { expectTypeOf, test } from "vitest";

import { Button } from "@elmeragroup/fuse/button";
import type { ToolbarRootProps, ToolbarSeparatorProps } from "@elmeragroup/fuse/toolbar";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

test("Root takes Base UI's orientation and loopFocus, and no recipe axis", () => {
  expectTypeOf<ToolbarRootProps["orientation"]>().toEqualTypeOf<"horizontal" | "vertical" | undefined>();
  expectTypeOf<ToolbarRootProps["loopFocus"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ToolbarSeparatorProps["orientation"]>().toEqualTypeOf<"horizontal" | "vertical" | undefined>();

  const _bar = (
    <Toolbar.Root aria-label="Format" orientation="vertical" loopFocus={false} disabled={false}>
      <Toolbar.Group aria-label="Style" disabled>
        <Toolbar.Button render={<Button variant="ghost" size="sm" />} focusableWhenDisabled={false} disabled>
          Bold
        </Toolbar.Button>
      </Toolbar.Group>
      <Toolbar.Separator orientation="horizontal" />
      <Toolbar.Link href="/help">Help</Toolbar.Link>
      <Toolbar.Input aria-label="Find" defaultValue="" />
    </Toolbar.Root>
  );

  // @ts-expect-error the toolbar has no third orientation
  const _badOrientation = <Toolbar.Root orientation="both" />;
  // @ts-expect-error the root has no recipe axis; its items take their look from what they render
  const _noVariant = <Toolbar.Root variant="outline" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Toolbar.Button as="a" />;
});
