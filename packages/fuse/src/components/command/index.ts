/**
 * Server-visible namespace for `Command`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import {
  CommandBack,
  CommandBackHint,
  CommandCloseHint,
  CommandCollection,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandGroupedRoot,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandNavigateHint,
  CommandPage,
  CommandPages,
  CommandPageTrigger,
  CommandRoot,
  CommandSelectHint,
} from "./command";
import { CommandFooter, CommandHint, CommandShortcut } from "./command-markup";

export const Command = {
  Root: CommandRoot,
  GroupedRoot: CommandGroupedRoot,
  Input: CommandInput,
  Back: CommandBack,
  List: CommandList,
  Empty: CommandEmpty,
  Group: CommandGroup,
  GroupLabel: CommandGroupLabel,
  Collection: CommandCollection,
  Item: CommandItem,
  Shortcut: CommandShortcut,
  Pages: CommandPages,
  Page: CommandPage,
  PageTrigger: CommandPageTrigger,
  Footer: CommandFooter,
  Hint: CommandHint,
  NavigateHint: CommandNavigateHint,
  SelectHint: CommandSelectHint,
  CloseHint: CommandCloseHint,
  BackHint: CommandBackHint,
  Dialog: CommandDialog,
};
