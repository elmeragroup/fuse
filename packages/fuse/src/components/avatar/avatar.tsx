"use client";

import type { ComponentProps, ReactElement } from "react";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";

import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { avatarFallbackClass, avatarGroupClass, avatarImageClass, avatarRootClass } from "./avatar-class";

/**
 * Client image-or-initials avatar. Base-ui Avatar owns image
 * loading state.
 */
export function AvatarRoot({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Root>): ReactElement {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={mergeClassName(className, avatarRootClass)}
      {...props}
    />
  );
}

/**
 * Stacks its avatars and separates them with a background-coloured ring, so a group needs neither
 * negative spacing nor a ring on every child.
 */
export function AvatarGroup({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="avatar-group" className={cn(avatarGroupClass, className)} {...props} />;
}

export function AvatarImage({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Image>): ReactElement {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={mergeClassName(className, avatarImageClass)}
      {...props}
    />
  );
}

export function AvatarFallback({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Fallback>): ReactElement {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={mergeClassName(className, avatarFallbackClass)}
      {...props}
    />
  );
}

AvatarRoot.displayName = "Avatar.Root";
AvatarGroup.displayName = "Avatar.Group";
AvatarImage.displayName = "Avatar.Image";
AvatarFallback.displayName = "Avatar.Fallback";
