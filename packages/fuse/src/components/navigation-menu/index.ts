/**
 * Server-visible namespace for `NavigationMenu`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import {
  NavigationMenuRoot,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
  NavigationMenuIndicator,
} from "./navigation-menu";

export const NavigationMenu = {
  Root: NavigationMenuRoot,
  List: NavigationMenuList,
  Item: NavigationMenuItem,
  Trigger: NavigationMenuTrigger,
  Content: NavigationMenuContent,
  Link: NavigationMenuLink,
  Indicator: NavigationMenuIndicator,
};
