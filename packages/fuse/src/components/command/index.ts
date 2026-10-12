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
  CommandContent,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandLabel,
  CommandList,
  CommandNavigateHint,
  CommandPage,
  CommandPageTrigger,
  CommandRoot,
  CommandSelectHint,
  CommandTrigger,
} from "./command";
import { CommandFooter, CommandHint, CommandShortcut } from "./command-markup";

export const Command = {
  Root: CommandRoot,
  Trigger: CommandTrigger,
  Content: CommandContent,
  Input: CommandInput,
  Back: CommandBack,
  List: CommandList,
  Empty: CommandEmpty,
  Group: CommandGroup,
  Label: CommandLabel,
  Collection: CommandCollection,
  Item: CommandItem,
  Shortcut: CommandShortcut,
  Page: CommandPage,
  PageTrigger: CommandPageTrigger,
  Footer: CommandFooter,
  Hint: CommandHint,
  NavigateHint: CommandNavigateHint,
  SelectHint: CommandSelectHint,
  CloseHint: CommandCloseHint,
  BackHint: CommandBackHint,
};
