import { expectTypeOf, test } from "vitest";

import type { NavigationMenuRootProps } from "@elmeragroup/fuse/navigation-menu";
import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";

test("Positioner, Popup and Viewport stay off the namespace because Root owns them and takes align and container", () => {
  expectTypeOf(NavigationMenu).not.toHaveProperty("Positioner");
  expectTypeOf(NavigationMenu).not.toHaveProperty("Popup");
  expectTypeOf(NavigationMenu).not.toHaveProperty("Viewport");
  expectTypeOf(NavigationMenu).not.toHaveProperty("Portal");

  expectTypeOf<NavigationMenuRootProps["align"]>().toEqualTypeOf<"start" | "center" | "end" | undefined>();

  const _tree = (
    <NavigationMenu.Root aria-label="Site" align="center" orientation="horizontal">
      <NavigationMenu.List>
        <NavigationMenu.Item value="products">
          <NavigationMenu.Trigger>
            Products
            <NavigationMenu.Indicator />
          </NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link href="/electricity" closeOnClick />
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );

  // @ts-expect-error Root aligns the popup; side and offsets are fixed
  const _noSide = <NavigationMenu.Root side="top" />;
});

test("Link takes active and composes through render, never an `as` prop", () => {
  const _active = <NavigationMenu.Link href="/" active render={<a href="/" />} />;
  const _stateClass = (
    <NavigationMenu.Link
      href="/"
      className={(state) => {
        expectTypeOf(state.active).toEqualTypeOf<boolean>();
        return "";
      }}
    />
  );

  // @ts-expect-error active is a boolean, not aria-current's token
  const _token = <NavigationMenu.Link active="page" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <NavigationMenu.Link as="button" />;
});
