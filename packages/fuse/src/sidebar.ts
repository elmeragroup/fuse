// The source entry for `@elmeragroup/fuse/sidebar`. It holds explicit named re-exports only,
// with no `export *`, no local declarations and no directives. The exports and barrel generators
// find this file, so never edit `package.json#exports` or `src/index.ts` by hand.
// The menu-button and menu-sub-button recipes stay module-private, and the viewport probe hook
// is package-private.
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
