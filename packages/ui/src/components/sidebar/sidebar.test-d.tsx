import type { Dispatch, SetStateAction } from "react";

import { expectTypeOf, test } from "vitest";

import type { Sidebar as RootSidebar } from "@elmeragroup/ui";
import * as SidebarModule from "@elmeragroup/ui/sidebar";
import { Sidebar, useSidebar } from "@elmeragroup/ui/sidebar";
import type {
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_KEYBOARD_SHORTCUT,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  SIDEBAR_WIDTH_MOBILE,
  SidebarContextValue,
  SidebarLabels,
  SidebarMenuButtonProps,
  SidebarMenuSubButtonProps,
  SidebarProviderProps,
  SidebarRootProps,
} from "@elmeragroup/ui/sidebar";

test("Sidebar, useSidebar and the six constants ship from the sidebar entry and the root barrel", () => {
  expectTypeOf<typeof Sidebar>().toEqualTypeOf<typeof RootSidebar>();
  expectTypeOf(Sidebar.Provider).toBeFunction();
  expectTypeOf(Sidebar.Root).toBeFunction();
  expectTypeOf(Sidebar.Trigger).toBeFunction();
  expectTypeOf(Sidebar.Rail).toBeFunction();
  expectTypeOf(Sidebar.Inset).toBeFunction();
  expectTypeOf(Sidebar.Input).toBeFunction();
  expectTypeOf(Sidebar.Header).toBeFunction();
  expectTypeOf(Sidebar.Footer).toBeFunction();
  expectTypeOf(Sidebar.Separator).toBeFunction();
  expectTypeOf(Sidebar.Content).toBeFunction();
  expectTypeOf(Sidebar.Group).toBeFunction();
  expectTypeOf(Sidebar.GroupLabel).toBeFunction();
  expectTypeOf(Sidebar.GroupAction).toBeFunction();
  expectTypeOf(Sidebar.GroupContent).toBeFunction();
  expectTypeOf(Sidebar.Menu).toBeFunction();
  expectTypeOf(Sidebar.MenuItem).toBeFunction();
  expectTypeOf(Sidebar.MenuButton).toBeFunction();
  expectTypeOf(Sidebar.MenuAction).toBeFunction();
  expectTypeOf(Sidebar.MenuBadge).toBeFunction();
  expectTypeOf(Sidebar.MenuSkeleton).toBeFunction();
  expectTypeOf(Sidebar.MenuSub).toBeFunction();
  expectTypeOf(Sidebar.MenuSubItem).toBeFunction();
  expectTypeOf(Sidebar.MenuSubButton).toBeFunction();
  expectTypeOf(Sidebar.Icon).toBeFunction();
  expectTypeOf(useSidebar).returns.toEqualTypeOf<SidebarContextValue>();
  expectTypeOf<typeof SIDEBAR_COOKIE_NAME>().toEqualTypeOf<"sidebar:state">();
  expectTypeOf<typeof SIDEBAR_COOKIE_MAX_AGE>().toBeNumber();
  expectTypeOf<typeof SIDEBAR_WIDTH>().toEqualTypeOf<"16rem">();
  expectTypeOf<typeof SIDEBAR_WIDTH_MOBILE>().toEqualTypeOf<"18rem">();
  expectTypeOf<typeof SIDEBAR_WIDTH_ICON>().toEqualTypeOf<"3rem">();
  expectTypeOf<typeof SIDEBAR_KEYBOARD_SHORTCUT>().toEqualTypeOf<"b">();
});

test("useIsMobile, the private recipe and the flat ref names stay off the public surface", () => {
  expectTypeOf(SidebarModule).not.toHaveProperty("useIsMobile");
  expectTypeOf(SidebarModule).not.toHaveProperty("sidebarMenuButtonVariants");
  expectTypeOf(SidebarModule).not.toHaveProperty("SidebarProvider");
  expectTypeOf(SidebarModule).not.toHaveProperty("SidebarMenuButton");
  expectTypeOf(Sidebar).not.toHaveProperty("SidebarProvider");
  expectTypeOf(Sidebar).not.toHaveProperty("useSidebar");
  expectTypeOf(Sidebar).not.toHaveProperty("useIsMobile");
});

test("the context surface and part props match the public API", () => {
  expectTypeOf<SidebarContextValue["state"]>().toEqualTypeOf<"expanded" | "collapsed">();
  expectTypeOf<SidebarContextValue["setOpen"]>().toEqualTypeOf<
    (open: boolean | ((open: boolean) => boolean)) => void
  >();
  expectTypeOf<SidebarContextValue["setOpenMobile"]>().toEqualTypeOf<Dispatch<SetStateAction<boolean>>>();
  expectTypeOf<SidebarContextValue["toggleSidebar"]>().toEqualTypeOf<() => void>();
  expectTypeOf<SidebarContextValue>().not.toHaveProperty("labels");

  expectTypeOf<SidebarProviderProps["labels"]>().toEqualTypeOf<Partial<SidebarLabels> | undefined>();
  expectTypeOf<SidebarProviderProps["onOpenChange"]>().toEqualTypeOf<((open: boolean) => void) | undefined>();
  expectTypeOf<SidebarRootProps["side"]>().toEqualTypeOf<"left" | "right" | undefined>();
  expectTypeOf<SidebarRootProps["variant"]>().toEqualTypeOf<"sidebar" | "floating" | "inset" | undefined>();
  expectTypeOf<SidebarRootProps["collapsible"]>().toEqualTypeOf<"offcanvas" | "icon" | "none" | undefined>();
  expectTypeOf<SidebarMenuButtonProps["size"]>().toEqualTypeOf<"default" | "sm" | "lg" | undefined>();
  expectTypeOf<SidebarMenuButtonProps["variant"]>().toEqualTypeOf<"default" | "outline" | undefined>();
  expectTypeOf<SidebarMenuButtonProps["isActive"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SidebarMenuSubButtonProps["size"]>().toEqualTypeOf<"sm" | "md" | undefined>();
  expectTypeOf<Parameters<typeof Sidebar.Input>[0]["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<Parameters<typeof Sidebar.Root>[0]>().not.toHaveProperty("as");
  expectTypeOf<Parameters<typeof Sidebar.MenuButton>[0]>().not.toHaveProperty("as");

  const _tree = (
    <Sidebar.Provider defaultOpen={false} labels={{ toggle: "Menu" }} onOpenChange={(open: boolean) => open}>
      <Sidebar.Root side="right" variant="inset" collapsible="icon" dir="rtl">
        <Sidebar.Header>
          <Sidebar.Input placeholder="Search" />
        </Sidebar.Header>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel render={<h2 />}>Funnel</Sidebar.GroupLabel>
            <Sidebar.GroupAction render={<a href="#" />}>Add</Sidebar.GroupAction>
            <Sidebar.GroupContent>
              <Sidebar.Menu>
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton
                    isActive
                    size="lg"
                    variant="outline"
                    tooltip="Orders"
                    render={<a href="/" />}>
                    <span>Orders</span>
                  </Sidebar.MenuButton>
                  <Sidebar.MenuAction showOnHover>More</Sidebar.MenuAction>
                  <Sidebar.MenuBadge>12</Sidebar.MenuBadge>
                  <Sidebar.MenuSub>
                    <Sidebar.MenuSubItem>
                      <Sidebar.MenuSubButton size="sm" isActive href="/a">
                        <span>Open</span>
                      </Sidebar.MenuSubButton>
                    </Sidebar.MenuSubItem>
                  </Sidebar.MenuSub>
                </Sidebar.MenuItem>
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton tooltip={{ children: "Reports", sideOffset: 8 }}>
                    Reports
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
                <Sidebar.MenuItem>
                  <Sidebar.MenuSkeleton showIcon />
                </Sidebar.MenuItem>
              </Sidebar.Menu>
            </Sidebar.GroupContent>
          </Sidebar.Group>
          <Sidebar.Separator orientation="horizontal" />
        </Sidebar.Content>
        <Sidebar.Footer>
          <Sidebar.Icon>brand</Sidebar.Icon>
        </Sidebar.Footer>
        <Sidebar.Rail />
      </Sidebar.Root>
      <Sidebar.Inset>
        <Sidebar.Trigger />
        <Sidebar.Trigger aria-label="Menu" variant="outline" className="ml-2" />
      </Sidebar.Inset>
    </Sidebar.Provider>
  );

  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <Sidebar.MenuButton as="a" />;
  // @ts-expect-error locale is provider-only
  const _noLocale = <Sidebar.Provider locale="nb-NO" />;
  // @ts-expect-error the size ladder is default | sm | lg
  const _badSize = <Sidebar.MenuButton size="md" />;
  // @ts-expect-error the sub-button ladder is sm | md
  const _badSubSize = <Sidebar.MenuSubButton size="lg" />;
  // @ts-expect-error collapsible is a closed union
  const _badCollapsible = <Sidebar.Root collapsible="always" />;
});
