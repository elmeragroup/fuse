import { useState } from "react";

import { expectTypeOf, test } from "vitest";

import type { NavigationMenuRootProps } from "@elmeragroup/fuse/navigation-menu";
import { NavigationMenu } from "@elmeragroup/fuse/navigation-menu";

test("Positioner and Popup stay off the namespace because Root owns them and takes align, side and container", () => {
  expectTypeOf(NavigationMenu).not.toHaveProperty("Positioner");
  expectTypeOf(NavigationMenu).not.toHaveProperty("Popup");
  expectTypeOf(NavigationMenu).not.toHaveProperty("Portal");

  expectTypeOf<NavigationMenuRootProps["align"]>().toEqualTypeOf<"start" | "center" | "end" | undefined>();
  expectTypeOf<NavigationMenuRootProps["side"]>().toEqualTypeOf<
    "top" | "bottom" | "left" | "right" | "inline-end" | "inline-start" | undefined
  >();

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

  const _submenu = <NavigationMenu.Root orientation="vertical" side="right" align="end" />;
  // @ts-expect-error Root places the popup; the offsets are fixed
  const _noOffset = <NavigationMenu.Root sideOffset={4} />;
});

test("Root keeps Base UI's generic value, so a controlled string value and its setter type-check", () => {
  function Controlled() {
    const [value, setValue] = useState<string | null>(null);
    return <NavigationMenu.Root value={value} onValueChange={setValue} />;
  }
  const _controlled = <Controlled />;

  const _inferred = (
    <NavigationMenu.Root
      defaultValue="products"
      onValueChange={(next) => {
        expectTypeOf(next).toEqualTypeOf<string | null>();
      }}
    />
  );

  // @ts-expect-error a numeric value conflicts with the string the default value fixes
  const _mismatch = <NavigationMenu.Root defaultValue="products" value={1} />;
});

test("an inline Root takes a Viewport and no popup placement", () => {
  const _inline = (
    <NavigationMenu.Root inline orientation="vertical" defaultValue="homes">
      <NavigationMenu.List />
      <NavigationMenu.Viewport className="min-h-64" render={<section />} />
    </NavigationMenu.Root>
  );
  const _stateClass = <NavigationMenu.Viewport className={() => "min-h-64"} />;

  // @ts-expect-error an inline Root renders no popup to place
  const _inlineSide = <NavigationMenu.Root inline side="right" />;
  // @ts-expect-error an inline Root renders no popup to align
  const _inlineAlign = <NavigationMenu.Root inline align="end" />;
  // @ts-expect-error an inline Root renders no popup to portal
  const _inlineContainer = <NavigationMenu.Root inline container={document.body} />;
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
