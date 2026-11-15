// This file is the source entry for `@elmeragroup/fuse/sidebar`. It contains only explicit named re-exports,
// with no `export *`, local declarations or directives. The exports and barrel generators read this file, so
// change `package.json#exports` and `src/index.ts` only through them. The menu-button and menu-sub-button
// recipes stay module-private, and the viewport probe hook is package-private.
export {
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_KEYBOARD_SHORTCUT,
  useSidebar,
} from "./components/sidebar/sidebar";
export { SIDEBAR_WIDTH, SIDEBAR_WIDTH_ICON, SIDEBAR_WIDTH_MOBILE } from "./components/sidebar/sidebar-width";
export { Sidebar } from "./components/sidebar";
export type {
  SidebarBounds,
  SidebarContentProps,
  SidebarContextValue,
  SidebarFooterProps,
  SidebarGroupActionProps,
  SidebarGroupContentProps,
  SidebarGroupLabelProps,
  SidebarGroupProps,
  SidebarHeaderProps,
  SidebarIconProps,
  SidebarInputProps,
  SidebarInsetProps,
  SidebarLabels,
  SidebarMenuActionProps,
  SidebarMenuBadgeProps,
  SidebarMenuButtonProps,
  SidebarMenuItemProps,
  SidebarMenuProps,
  SidebarMenuSkeletonProps,
  SidebarMenuSubButtonProps,
  SidebarMenuSubItemProps,
  SidebarMenuSubProps,
  SidebarProviderProps,
  SidebarRailProps,
  SidebarRootProps,
  SidebarSeparatorProps,
  SidebarTriggerProps,
} from "./components/sidebar/sidebar";
