import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of InputGroup addons. The rules every shell follows are in
// `corner-radius.ts`. Each constant pairs a part's rung or padding with the corner it publishes.

/**
 * An inline-start InputGroup addon. It pads with the md control icon inset,
 * `--control-px-icon-md`, less 4px beside a button and 0.15rem beside a kbd
 * through a negative margin, and publishes the field corner less that and the border. A button sets
 * the inset when the addon also holds a kbd.
 */
export const addonStartShellClass = cn(
  "pl-(--control-px-icon-md) [--shell-inner:max(0px,var(--field-corner)-1px-var(--control-px-icon-md))] has-[>button]:-ml-1 has-[>button]:[--shell-inner:max(0px,var(--field-corner)-1px-var(--control-px-icon-md)+var(--spacing))] has-[>kbd]:not-has-[>button]:ml-[-0.15rem] has-[>kbd]:not-has-[>button]:[--shell-inner:max(0px,var(--field-corner)-1px-var(--control-px-icon-md)+0.15rem)] [&>kbd]:rounded-inner",
  publishShellBoundary
);

/**
 * The inline-end mirror of {@link addonStartShellClass}.
 */
export const addonEndShellClass = cn(
  "pr-(--control-px-icon-md) [--shell-inner:max(0px,var(--field-corner)-1px-var(--control-px-icon-md))] has-[>button]:-mr-1 has-[>button]:[--shell-inner:max(0px,var(--field-corner)-1px-var(--control-px-icon-md)+var(--spacing))] has-[>kbd]:not-has-[>button]:mr-[-0.15rem] has-[>kbd]:not-has-[>button]:[--shell-inner:max(0px,var(--field-corner)-1px-var(--control-px-icon-md)+0.15rem)] [&>kbd]:rounded-inner",
  publishShellBoundary
);

/**
 * A block-start or block-end InputGroup addon: the md control inset, `--control-px-md`, inline.
 */
export const addonBlockShellClass = cn(
  "px-(--control-px-md) [--shell-inner:max(0px,var(--field-corner)-1px-var(--control-px-md))] [&>kbd]:rounded-inner",
  publishShellBoundary
);
