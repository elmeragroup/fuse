"use client";

import type { ComponentProps, ReactElement } from "react";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";

import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";

const ROOT_CLASSES = cn(
  "text-sm font-medium inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted align-middle text-muted-foreground select-none"
);

/**
 * Stack classes for `Avatar.Group`. `:where()` wraps the whole parent-and-child selector, so the
 * group's ring rule scores zero specificity and any explicit ring utility on a child avatar wins.
 */
const GROUP_CLASSES = cn("flex -space-x-2 [:where(&>*)]:ring-2 [:where(&>*)]:ring-background");

/**
 * Client image-or-initials avatar. Base-ui Avatar owns image
 * loading state (performance.md §RSC classification).
 */
function AvatarRoot({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Root>): ReactElement {
  return (
    <AvatarPrimitive.Root data-slot="avatar" className={mergeClassName(className, ROOT_CLASSES)} {...props} />
  );
}

/**
 * Stacks its avatars and separates them with a background-coloured ring, so a group needs neither
 * negative spacing nor a ring on every child.
 */
function AvatarGroup({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="avatar-group" className={cn(GROUP_CLASSES, className)} {...props} />;
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
AvatarGroup.displayName = "Avatar.Group";
AvatarImage.displayName = "Avatar.Image";
AvatarFallback.displayName = "Avatar.Fallback";

export const Avatar = {
  Root: AvatarRoot,
  Group: AvatarGroup,
  Image: AvatarImage,
  Fallback: AvatarFallback,
};
