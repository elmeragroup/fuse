import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { headingVariants } from "./heading-variants";

/** The outline level of a Heading, `1` to `6`. */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** The levels that have theme roles for their size, line height and weight. */
export const THEMED_HEADING_LEVELS = [1, 2, 3] as const satisfies readonly HeadingLevel[];

/** The classes that read a level's theme roles, one for the type pair and one for the weight. */
type LevelRoleClasses = {
  /** The font size and line height, used when the Heading has no `size` prop. */
  readonly type: string;
  /** The font weight, used when the Heading has no `font` prop. */
  readonly weight: string;
};

/**
 * The theme roles of levels 1 to 3. Levels 4 to 6 have none and keep the recipe's default size,
 * line height and weight. Each fallback is the neutral value the role defaults to, so a host
 * without `themes.css` keeps the scale these levels had before the roles: h1 `text-2xl`, h2
 * `text-lg` and h3 `text-base` at the snug 1.375 ratio, all at 500. `oxfmt` sorts the classes
 * inside one string, so the leading is its own `cn` argument to stay after the size. tailwind-merge
 * drops a line height that a later font size follows.
 * These merge over the recipe's size and font arms, so `headingVariants()` alone keeps the
 * level-free scale.
 */
const LEVEL_ROLE_CLASSES = {
  1: {
    type: cn("text-(length:--heading-1-size,1.5rem)", "leading-(--heading-1-leading,2.0625rem)"),
    weight: cn("font-[number:var(--heading-1-weight,500)]"),
  },
  2: {
    type: cn("text-(length:--heading-2-size,1.125rem)", "leading-(--heading-2-leading,1.546875rem)"),
    weight: cn("font-[number:var(--heading-2-weight,500)]"),
  },
  3: {
    type: cn("text-(length:--heading-3-size,1rem)", "leading-(--heading-3-leading,1.375rem)"),
    weight: cn("font-[number:var(--heading-3-weight,500)]"),
  },
} as const satisfies Record<(typeof THEMED_HEADING_LEVELS)[number], LevelRoleClasses>;

/** A level's role classes, or none for levels 4 to 6. */
function levelRoleClasses(level: HeadingLevel): LevelRoleClasses | undefined {
  switch (level) {
    case 1:
    case 2:
    case 3:
      return LEVEL_ROLE_CLASSES[level];
    default:
      return undefined;
  }
}

/** The recipe axes and the outline level that pick a Heading's classes. */
export type HeadingClassOptions = VariantProps<typeof headingVariants> & {
  /** The outline level. Levels 1 to 3 read the theme's roles where `size` or `font` is unset. */
  readonly level: HeadingLevel;
};

/**
 * The classes `Heading` renders before a consumer's `className`: the recipe's, with the level's
 * theme size and line height merged over them where `size` is unset, and the level's theme weight
 * where `font` is unset. Not exported from `@elmeragroup/fuse/heading`; the workspace-only recipe
 * catalog re-exports it for the Figma component sync, which builds the Heading text styles from it.
 *
 * @param options - The recipe axes and the outline level.
 * @returns The merged class string.
 */
export function headingClass({ level, size, font, ...recipe }: HeadingClassOptions): string {
  const roles = levelRoleClasses(level);
  return cn(
    headingVariants({ ...recipe, size, font }),
    size === undefined ? roles?.type : undefined,
    font === undefined ? roles?.weight : undefined
  );
}
