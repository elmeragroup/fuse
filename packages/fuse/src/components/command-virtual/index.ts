/**
 * Server-visible namespace for `CommandVirtual`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { CommandVirtualList, CommandVirtualRoot } from "./command-virtual";

export const CommandVirtual = {
  Root: CommandVirtualRoot,
  List: CommandVirtualList,
};
