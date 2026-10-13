/**
 * What each composition rule tells the consumer, after the name of the part that threw: the
 * rule, then the fix.
 */
const MESSAGES = {
  "outside-root": "must be used within Command.Root. Wrap the palette's parts in Command.Root.",
  "outside-stack":
    "must be used within a Command.Root that holds a stack of pages. Give the Root defaultPages, or pages with onPagesChange.",
  "groups-without-grouped":
    "received groups of items without `grouped`. Add `grouped` beside `items`, or pass a flat list.",
  "grouped-without-groups":
    "received `grouped` with a flat list of items. Pass groups, each with its own `items`, or drop `grouped`.",
  "virtualized-grouped":
    "received `virtualized` beside `grouped`, and a virtual list renders flat items only. Drop `grouped` and pass a flat list, or drop `virtualized`.",
  "virtualized-list-without-render":
    "renders a virtualized search's rows through a row function without a render value, which mounts every row without its index. Pass render={<CommandVirtual.List />}, or render indexed Command.Item elements as children.",
  "virtual-list-without-virtualized":
    "must be used in a virtualized search. Add `virtualized` to the Command.Root or Command.Page that holds the search.",
  "virtual-list-outside-list":
    "must be the render element of Command.List. Render it as <Command.List render={<CommandVirtual.List />}> with a row function as children.",
} as const;

/**
 * The ways a palette's parts can be composed wrong. Each is a defect in the consumer's tree, so
 * the part throws while rendering, and the message names the fix.
 */
export type CommandCompositionRule = keyof typeof MESSAGES;

/**
 * Thrown when a palette's parts are composed in a way that cannot work, such as `Command.Page`
 * outside a Root with a stack. Its message starts with the part that threw and names the fix.
 */
export class CommandCompositionError extends Error {
  override readonly name = "CommandCompositionError";
  readonly _tag = "CommandCompositionError" as const;

  /**
   * @param part - The part that threw, such as `Command.Page`.
   * @param rule - The composition rule the tree breaks.
   */
  constructor(
    readonly part: string,
    readonly rule: CommandCompositionRule
  ) {
    super(`${part} ${MESSAGES[rule]}`);
  }
}
