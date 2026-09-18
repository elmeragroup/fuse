"use client";

import type { ComponentProps, ReactElement } from "react";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";

import { mergeClassName } from "../../styles/merge-class-name";
import { avatarVariants } from "./avatar-variants";

type AvatarRootProps = ComponentProps<typeof AvatarPrimitive.Root> & {
  /** Separates stacked avatars with a background-coloured ring. */
  grouped?: boolean;
};

/**
 * Client image-or-initials avatar. Base-ui Avatar owns image
 * loading state (performance.md §RSC classification).
 */
function AvatarRoot({ className, grouped, ...props }: AvatarRootProps): ReactElement {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={mergeClassName(className, avatarVariants({ grouped }))}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Image>): ReactElement {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={mergeClassName(className, "size-full object-cover")}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Fallback>): ReactElement {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={mergeClassName(className, "flex size-full items-center justify-center")}
      {...props}
    />
  );
}

AvatarRoot.displayName = "Avatar.Root";
AvatarImage.displayName = "Avatar.Image";
AvatarFallback.displayName = "Avatar.Fallback";

export const Avatar = {
  Root: AvatarRoot,
  Image: AvatarImage,
  Fallback: AvatarFallback,
};
