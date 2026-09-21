import { expectTypeOf, test } from "vitest";

import type { Tabs as RootTabs } from "@elmeragroup/fuse";
import * as TabsModule from "@elmeragroup/fuse/tabs";
import { Tabs, tabsListVariants } from "@elmeragroup/fuse/tabs";

test("Tabs ships from the tabs entry and the root barrel", () => {
  expectTypeOf<typeof Tabs>().toEqualTypeOf<typeof RootTabs>();
  expectTypeOf(Tabs.Root).toBeFunction();
  expectTypeOf(Tabs.List).toBeFunction();
  expectTypeOf(Tabs.Trigger).toBeFunction();
  expectTypeOf(Tabs.Content).toBeFunction();
});

test("the public namespace is four parts plus the public recipe — never the flat ref names", () => {
  expectTypeOf(Tabs).not.toHaveProperty("Panel");
  expectTypeOf(Tabs).not.toHaveProperty("Tab");
  expectTypeOf(Tabs).not.toHaveProperty("TabsList");
  expectTypeOf(Tabs).not.toHaveProperty("TabsTrigger");
  expectTypeOf(Tabs).not.toHaveProperty("TabsContent");
  expectTypeOf(TabsModule).not.toHaveProperty("TabsList");
  expectTypeOf(TabsModule).not.toHaveProperty("TabsTrigger");
  expectTypeOf(TabsModule).not.toHaveProperty("TabsContent");
  expectTypeOf(tabsListVariants).toBeFunction();
});

test("parts take the primitive passthrough surface, list variant, and no as prop", () => {
  expectTypeOf<Parameters<typeof Tabs.Root>[0]["orientation"]>().toEqualTypeOf<
    "horizontal" | "vertical" | undefined
  >();
  expectTypeOf<Parameters<typeof Tabs.List>[0]["variant"]>().toEqualTypeOf<"default" | "line" | undefined>();
  expectTypeOf<Parameters<typeof Tabs.Root>[0]>().not.toHaveProperty("as");
  expectTypeOf<Parameters<typeof Tabs.Trigger>[0]>().not.toHaveProperty("as");
  expectTypeOf<Parameters<typeof Tabs.List>[0]["activateOnFocus"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<Parameters<typeof Tabs.List>[0]["loopFocus"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<Parameters<typeof Tabs.List>[0]>().not.toHaveProperty("loop");

  const _tree = (
    <Tabs.Root defaultValue="account" orientation="horizontal" onValueChange={() => undefined}>
      <Tabs.List variant="default">
        <Tabs.Trigger value="account">Account</Tabs.Trigger>
        <Tabs.Trigger value="password" disabled>
          Password
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="account">Account panel</Tabs.Content>
      <Tabs.Content value="password" keepMounted>
        Password panel
      </Tabs.Content>
    </Tabs.Root>
  );

  const _vertical = (
    <Tabs.Root orientation="vertical" value="account">
      <Tabs.List variant="line" activateOnFocus loopFocus>
        <Tabs.Trigger value="account" nativeButton>
          Account
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="account" render={<section />}>
        Account panel
      </Tabs.Content>
    </Tabs.Root>
  );

  const _ref = <Tabs.Root ref={null} defaultValue="account" />;

  // @ts-expect-error orientation is horizontal | vertical only
  const _badOrientation = <Tabs.Root orientation="responsive" />;
  // @ts-expect-error ghost is not a tabs list variant
  const _badVariant = <Tabs.List variant="ghost" />;
  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <Tabs.Trigger as="div" />;
});

test("tabsListVariants is public and returns a class string", () => {
  expectTypeOf(tabsListVariants({ variant: "line" })).toBeString();
  expectTypeOf(tabsListVariants()).toBeString();
});
