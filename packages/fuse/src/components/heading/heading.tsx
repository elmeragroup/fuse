"use client";

import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { headingVariants } from "./heading-variants";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

/** A named style of the design's heading ramp, largest first. */
type HeadingTypography = "large" | "medium" | "small" | "xsmall";

/** The classes that read a set of theme roles, one for the type pair and one for the weight. */
type RoleClasses = {
  /** The font size and line height. */
  readonly type: string;
  /** The font weight. */
  readonly weight: string;
};

/**
 * The theme roles of each heading style. Each fallback is the internal value the role defaults
 * to, so a host without `themes.css` gets Tailwind's text-4xl, text-3xl, text-2xl and text-lg at
 * the snug 1.375 ratio, all at 500. `oxfmt` sorts the classes inside one string, so the leading
 * is its own `cn` argument to stay after the size: tailwind-merge drops a line height that a
 * later font size follows.
 */
const TYPOGRAPHY_CLASSES = {
  large: {
    type: cn("text-(length:--heading-large-size,2.25rem)", "leading-(--heading-large-leading,3.09375rem)"),
    weight: cn("font-[number:var(--heading-large-weight,500)]"),
  },
  medium: {
    type: cn(
      "text-(length:--heading-medium-size,1.875rem)",
      "leading-(--heading-medium-leading,2.578125rem)"
    ),
    weight: cn("font-[number:var(--heading-medium-weight,500)]"),
  },
  small: {
    type: cn("text-(length:--heading-small-size,1.5rem)", "leading-(--heading-small-leading,2.0625rem)"),
    weight: cn("font-[number:var(--heading-small-weight,500)]"),
  },
  xsmall: {
    type: cn(
      "text-(length:--heading-xsmall-size,1.125rem)",
      "leading-(--heading-xsmall-leading,1.546875rem)"
    ),
    weight: cn("font-[number:var(--heading-xsmall-weight,500)]"),
  },
} as const satisfies Record<HeadingTypography, RoleClasses>;

/**
 * The theme roles of levels 1 to 3. Levels 4 to 6 have none and keep the recipe's default size,
 * line height and weight. Themes point h1 at the heading small style and h2 at heading xsmall,
 * and external themes point h3 at heading xsmall too. Each fallback is the internal value, so a
 * host without `themes.css` keeps the scale these levels had before the roles: h1 text-2xl, h2
 * text-lg and h3 text-base at the snug 1.375 ratio, all at 500. The leading stays its own `cn`
 * argument after the size, as in `TYPOGRAPHY_CLASSES`.
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
} as const satisfies Partial<Record<HeadingLevel, RoleClasses>>;

/** A level's role classes, or none for levels 4 to 6. */
function levelRoleClasses(level: HeadingLevel): RoleClasses | undefined {
  switch (level) {
    case 1:
    case 2:
    case 3:
      return LEVEL_ROLE_CLASSES[level];
    default:
      return undefined;
  }
}

type HeadingRecipeProps = VariantProps<typeof headingVariants>;

/** A Heading on the plain type scale: the level's defaults, or an explicit `size` and `font`. */
type HeadingScaleProps = {
  // The API reference joins both members' descriptions, so each shared prop is documented once:
  // `typography` in `HeadingStyleProps`, and `size` and `font` here.
  typography?: undefined;
  /**
   * A rung of the plain type scale, the same in every theme, at the snug 1.375 line height (`6xl`
   * at 1.25). It replaces a level's themed size and line height. Not allowed with `typography`.
   */
  size?: HeadingRecipeProps["size"];
  /**
   * The plain weight, `default` 500, `normal` 400 or `semi-bold` 600, the same in every theme. It
   * replaces a level's themed weight. Not allowed with `typography`.
   */
  font?: HeadingRecipeProps["font"];
};

/** A Heading in a named heading style, which owns the size, line height and weight. */
type HeadingStyleProps = {
  /**
   * A named heading style, `large`, `medium`, `small` or `xsmall`, which sets the size, line
   * height and weight together from the theme at any level: `--heading-<style>-size`,
   * `--heading-<style>-leading` and `--heading-<style>-weight`. External themes set the design's
   * bold heading styles, 34/40, 28/34, 24/32 and 20/32 at 700, and internal themes 36/49.5,
   * 30/41.25, 24/33 and 18/24.75 at 500. Omitted, levels 1 to 3 take their theme defaults and
   * levels 4 to 6 are 16/22 at 500. It excludes `size` and `font`; a JavaScript caller that
   * passes them anyway gets the style. A `className` size, line height or weight still wins.
   */
  typography: HeadingTypography;
  size?: undefined;
  font?: undefined;
};

export type HeadingProps = useRender.ComponentProps<"h2"> &
  Omit<HeadingRecipeProps, "size" | "font"> &
  (HeadingScaleProps | HeadingStyleProps) & {
    /**
     * Document-outline level — `1`–`6` picks the rendered `h1`–`h6`. Defaults to `2`.
     * Without `typography`, levels 1 to 3 also pick the theme's default size, line height and
     * weight: `--heading-<level>-size` and `--heading-<level>-leading` apply when `size` is
     * omitted, and `--heading-<level>-weight` when `font` is omitted. Themes point h1 at the
     * heading small style and h2 at heading xsmall, and external themes point h3 at heading
     * xsmall too: internal themes keep h1 at 24/33, h2 at 18/24.75 and h3 at 16/22, all at
     * 500, and external themes set h1 to 24/32 and h2 and h3 to 20/32, all at 700. Levels 4 to
     * 6 are 16/22 at 500 in every theme.
     */
    level?: HeadingLevel;
  };

/**
 * Plain `h1`–`h6` typography primitive. `level` owns the document outline and, for levels 1 to
 * 3, the theme's default size, line height and weight. `typography` picks a named heading style
 * at any level, which sets all three from the theme. Without it, an explicit `size` replaces the
 * level's size and line height with the recipe's plain scale, and an explicit `font` replaces its
 * weight, each on its own. A `className` size or weight replaces any of them. Polymorphism is
 * `render` via base-ui `useRender`, never `as`.
 *
 * @param props - The recipe axes, the named style, the outline level, the host element and the
 *   native heading props.
 * @returns The rendered heading element, with `data-slot="heading"`.
 */
export function Heading({
  className,
  variant = "default",
  size,
  font,
  typography,
  level = 2,
  noMargin,
  uppercase,
  align,
  render,
  ...props
}: HeadingProps): ReactElement {
  const tag: HeadingTag = `h${level}`;
  // A named style wins over `size` and `font`, which its type excludes, if a caller passes both.
  const recipeSize = typography === undefined ? size : undefined;
  const recipeFont = typography === undefined ? font : undefined;
  const roles = typography === undefined ? levelRoleClasses(level) : TYPOGRAPHY_CLASSES[typography];
  return useRender({
    defaultTagName: tag,
    props: mergeProps<"h2">(
      {
        className: cn(
          headingVariants({ variant, size: recipeSize, font: recipeFont, noMargin, uppercase, align }),
          recipeSize === undefined ? roles?.type : undefined,
          recipeFont === undefined ? roles?.weight : undefined,
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
