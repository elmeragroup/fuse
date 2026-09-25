// Source entry facade for `@elmeragroup/fuse/sidebar` (Appendix A). Pure re-export file:
// explicit named re-exports only — no `export *`, no local declarations, no directives.
// The exports/barrel generators discover this file; never hand-edit package.json#exports
// or src/index.ts. The menu-button and menu-sub-button recipes stay module-private;
// the viewport probe hook is package-private.
export {
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_KEYBOARD_SHORTCUT,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  SIDEBAR_WIDTH_MOBILE,
  Sidebar,
  useSidebar,
} from "./components/sidebar";
export type {
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
} from "./components/sidebar";
