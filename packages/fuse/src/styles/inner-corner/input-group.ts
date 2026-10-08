import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of InputGroup addons. The rules every shell follows are in
// `corner-radius.ts`. Each constant pairs a part's rung or padding with the corner it publishes.

/**
 * An inline-start InputGroup addon. It pads 8px, or 4px beside a button and 5.6px beside a kbd
 * through a negative margin, and publishes the field corner less that and the border. A button sets
 * the inset when the addon also holds a kbd.
 */
export const addonStartShellClass = cn(
  "pl-2 [--shell-inner:max(0px,var(--field-corner)-1px-2*var(--spacing))] has-[>button]:-ml-1 has-[>button]:[--shell-inner:max(0px,var(--field-corner)-1px-var(--spacing))] has-[>kbd]:not-has-[>button]:ml-[-0.15rem] has-[>kbd]:not-has-[>button]:[--shell-inner:max(0px,var(--field-corner)-1px-2*var(--spacing)+0.15rem)] [&>kbd]:rounded-inner",
  publishShellBoundary
);

/**
 * The inline-end mirror of {@link addonStartShellClass}.
 */
export const addonEndShellClass = cn(
  "pr-2 [--shell-inner:max(0px,var(--field-corner)-1px-2*var(--spacing))] has-[>button]:-mr-1 has-[>button]:[--shell-inner:max(0px,var(--field-corner)-1px-var(--spacing))] has-[>kbd]:not-has-[>button]:mr-[-0.15rem] has-[>kbd]:not-has-[>button]:[--shell-inner:max(0px,var(--field-corner)-1px-2*var(--spacing)+0.15rem)] [&>kbd]:rounded-inner",
  publishShellBoundary
);

/**
 * A block-start or block-end InputGroup addon: 10px inline padding.
 */
export const addonBlockShellClass = cn(
  "px-2.5 [--shell-inner:max(0px,var(--field-corner)-1px-2.5*var(--spacing))] [&>kbd]:rounded-inner",
  publishShellBoundary
);
