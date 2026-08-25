/**
 * Package-private typography fragments shared by Heading and Text. Nothing here
 * is exported through `package.json#exports`; recipes stay public from their own
 * entries (`headingVariants` / `textVariants`).
 *
 * Size, font, weight, leading, prose, truncate, and descendant size selectors
 * stay on the recipes — those axes differ on purpose.
 */

/**
 * Heading's color map (`heading.md` §8.4). `destructive` keeps the ref value
 * name; the class is `text-error`. Text spreads this and adds `success`.
 */
export const typographyColorClasses = {
  default: "text-inherit",
  foreground: "text-foreground",
  primary: "text-primary",
  secondary: "text-secondary",
  brand: "text-brand",
  muted: "text-muted-foreground",
  inherit: "text-inherit",
  destructive: "text-error",
} as const;

/**
 * Shared start/center/end alignment. Text spreads this and adds `justify`.
 */
export const typographyAlignClasses = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;
