/**
 * Item.Title class string. Shared with Alert.Title so the alert
 * heading keeps the same weight and layout while staying an `h*`; Alert.Title swaps the fixed
 * `text-sm` for the density's `--label-text`, and sizes its own media line to match. Titles
 * wrap: Alert.Title and a selection row's title must show every line, and `flex` would win over
 * a `line-clamp-*`.
 * Alert.Title renders an `h1`–`h6`, so the string resets block margins that a host without
 * Tailwind's preflight would otherwise keep. Item.Media sizes itself to one line of this type,
 * `text-sm` at `leading-snug`, beside a description; change both together.
 * Package-private — not on the `@elmeragroup/fuse/item` facade.
 */
import { cn } from "../../styles/cn";

export const ITEM_TITLE_CLASSES = cn(
  "text-sm leading-snug font-medium m-0 flex w-fit items-center gap-2 underline-offset-4"
);
