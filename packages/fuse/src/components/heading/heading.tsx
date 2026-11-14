"use client";

import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { headingVariants } from "./heading-variants";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

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
 * without `themes.css` keeps the scale these levels had before the roles: h1 text-2xl, h2 text-lg
 * and h3 text-base at the snug 1.375 ratio, all at 500. `oxfmt` sorts the classes inside one
 * string, so the leading is its own `cn` argument to stay after the size: tailwind-merge drops a
 * line height that a later font size follows.
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
} as const satisfies Partial<Record<HeadingLevel, LevelRoleClasses>>;

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

/** `Heading` takes a native heading's props plus the recipe axes and the outline `level`. */
export type HeadingProps = useRender.ComponentProps<"h2"> &
  Omit<VariantProps<typeof headingVariants>, "size" | "font"> & {
    /**
     * The outline level, `1` to `6`, which picks the rendered `h1` to `h6`. For levels 1 to 3 it
     * also picks the theme's size, line height and weight: `--heading-<level>-size` and
     * `--heading-<level>-leading` apply when `size` is unset, and `--heading-<level>-weight` when
     * `font` is unset. Neutral themes set h1 to 24/33, h2 to 18/24.75 and h3 to 16/22, all at 500.
     * Branded themes set h1 to 24/32 and h2 and h3 to 20/32, all at 700. Levels 4 to 6 are 16/22
     * at 500 in every theme.
     */
    level?: HeadingLevel;
    /**
     * The type size. Setting it replaces the level's theme size and line height with the
     * recipe's, so use it only where a heading must differ from its level. A size class in
     * `className` replaces them too.
     */
    size?: VariantProps<typeof headingVariants>["size"];
    /**
     * The font weight. Setting it replaces the level's theme weight, and so does a weight class
     * in `className`.
     */
    font?: VariantProps<typeof headingVariants>["font"];
  };

/**
 * An `h1` to `h6` heading. Its `size` and `font` can differ from the type its `level` sets.
 *
 * @param props - The recipe axes, the outline level, the host element and the native heading props.
 * @returns The rendered heading element, with `data-slot="heading"`.
 */
export function Heading({
  className,
  variant = "default",
  size,
  font,
  level = 2,
  noMargin,
  uppercase,
  align,
  render,
  ...props
}: HeadingProps): ReactElement {
  const tag: HeadingTag = `h${level}`;
  const roles = levelRoleClasses(level);
  return useRender({
    defaultTagName: tag,
    props: mergeProps<"h2">(
      {
        className: cn(
          headingVariants({ variant, size, font, noMargin, uppercase, align }),
          size === undefined ? roles?.type : undefined,
          font === undefined ? roles?.weight : undefined,
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "heading",
    },
  });
}

Heading.displayName = "Heading";
