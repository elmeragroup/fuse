"use client";

import type { ComponentProps, ReactElement } from "react";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";

import { cn } from "../../styles/cn";
import { ROOT_CLASSES } from "./avatar-variants";

/**
 * Client image-or-initials avatar (avatar.md §2/§7). Base-ui Avatar owns image
 * loading state (performance.md §RSC classification).
 */
function AvatarRoot({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Root>): ReactElement {
  return <AvatarPrimitive.Root data-slot="avatar" className={cn(ROOT_CLASSES, className)} {...props} />;
}

function AvatarImage({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Image>): ReactElement {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("size-full object-cover", className)}
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
      className={cn("flex size-full items-center justify-center", className)}
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
