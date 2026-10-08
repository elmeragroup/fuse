import { cn } from "../cn";

// The inner-corner shells of the Field label card. The rules every shell follows are in
// `corner-radius.ts`. Each constant pairs a part's rung or padding with the corner it publishes.

/**
 * A Field label that holds a Field: the label rounds `rounded-md` behind a 1px border and the Field
 * pads inside it with the medium surface tier, `--surface-pad-md`. Both clear the relay.
 */
export const fieldLabelCardShellClass = cn(
  "has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border has-[>[data-slot=field]]:[--inner-corner:var(--shell-inner)] has-[>[data-slot=field]]:[--shell-corner:initial] has-[>[data-slot=field]]:[--shell-inner:max(0px,--theme(--radius-md)-1px)] *:data-[slot=field]:p-(--surface-pad-md) *:data-[slot=field]:[--inner-corner:var(--shell-inner)] *:data-[slot=field]:[--shell-corner:initial] *:data-[slot=field]:[--shell-inner:max(0px,--theme(--radius-md)-1px-var(--surface-pad-md))]"
);
