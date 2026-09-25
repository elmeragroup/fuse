/**
 * Server-visible namespace for `Tabs`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from "./tabs";

export const Tabs = {
  Root: TabsRoot,
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
};
