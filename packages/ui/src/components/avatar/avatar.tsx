"use client";

import type { ComponentProps, ReactElement } from "react";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";

import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";

const ROOT_CLASSES = cn(
  "text-sm font-medium inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted align-middle text-muted-foreground select-none"
);

/**
 * Client image-or-initials avatar (avatar.md §2/§7). Base-ui Avatar owns image
 * loading state (performance.md §RSC classification).
 */
function AvatarRoot({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Root>): ReactElement {
  return (
    <AvatarPrimitive.Root data-slot="avatar" className={mergeClassName(className, ROOT_CLASSES)} {...props} />
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
