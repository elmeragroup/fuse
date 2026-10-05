import type { ComponentProps, ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";

import type { SiteActions, SiteImage, SiteLink } from "./site-model";

type ButtonVariant = NonNullable<ComponentProps<typeof Button>["variant"]>;
/** The labelled sizes; the icon sizes need an `aria-label` a site link never has. */
type ButtonSize = "xs" | "sm" | "default" | "lg";

/** A site link drawn as a Fuse Button. */
export function SiteButton({
  link,
  variant = "default",
  size = "default",
  className,
  children,
}: {
  link: SiteLink;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  /** Icons around the label; the label itself always comes from the link. */
  children?: ReactNode;
}): ReactElement {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      render={<a href={link.href} />}
      nativeButton={false}>
      {children}
      {link.label}
    </Button>
  );
}

const siteActions = tv({
  base: "flex flex-wrap items-center gap-3",
});

/**
 * A hero's or a section's calls to action: the first in `primary`'s variant, a second one in
 * the quieter `quiet` variant.
 */
export function SiteActionRow({
  actions,
  primary = "default",
  quiet = "outline",
  size = "lg",
  className,
}: {
  actions: SiteActions;
  primary?: ButtonVariant;
  /**
   * The second action's variant. On a strong brand block pass `ghost`: an outline button paints
   * `background` but keeps the block's light text (see TODO.md).
   */
  quiet?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}): ReactElement {
  const [first, second] = actions;
  return (
    <div className={siteActions({ className })}>
      <SiteButton link={first} variant={primary} size={size} />
      {second === undefined ? null : <SiteButton link={second} variant={quiet} size={size} />}
    </div>
  );
}

/**
 * A photo at its intrinsic size, so the page reserves its box before it loads. The hero's
 * photo loads at once; the rest wait until they near the site's scroller. A plain `img`: each
 * file is one WebP already resized for the window, so `next/image` would add nothing.
 */
export function SitePhoto({
  image,
  className,
  priority = "lazy",
}: {
  image: SiteImage;
  className?: string;
  priority?: "eager" | "lazy";
}): ReactElement {
  return (
    <img
      src={image.src}
      alt={image.alt}
      width={image.width}
      height={image.height}
      loading={priority}
      decoding="async"
      className={className}
    />
  );
}
