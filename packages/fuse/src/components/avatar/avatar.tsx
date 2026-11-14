"use client";

import type { ComponentProps, ReactElement } from "react";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";

import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { avatarFallbackClass, avatarGroupClass, avatarImageClass, avatarRootClass } from "./avatar-class";

type AvatarRootPrimitiveProps = ComponentProps<typeof AvatarPrimitive.Root>;
type AvatarImagePrimitiveProps = ComponentProps<typeof AvatarPrimitive.Image>;

/**
 * An image or initials that stand for a person, built on Base UI's avatar, which tracks whether
 * the image loaded.
 */
export function AvatarRoot({
  className,
  ...props
}: Omit<AvatarRootPrimitiveProps, "className"> & {
  /**
   * Extra classes for the 32px circle, or a function of the avatar's state that returns them. A
   * `size-*` class, such as `size-12`, replaces the 32px size.
   */
  className?: AvatarRootPrimitiveProps["className"];
}): ReactElement {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={mergeClassName(className, avatarRootClass)}
      {...props}
    />
  );
}

/** A row of overlapping avatars. */
export function AvatarGroup({
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  /**
   * The `Avatar.Root`s to stack. The group overlaps them and rings each in the background
   * colour, so they need no negative margin or ring of their own. A ring class on one avatar
   * wins over the group's.
   */
  children?: ComponentProps<"div">["children"];
}): ReactElement {
  return <div data-slot="avatar-group" className={cn(avatarGroupClass, className)} {...props} />;
}

/** The avatar's image. It fills the circle and crops what overflows, and shows once it loads. */
export function AvatarImage({
  className,
  ...props
}: Omit<AvatarImagePrimitiveProps, "alt"> & {
  /**
   * The image's text alternative. Write the person's name, or `""` when the name already shows
   * beside the avatar.
   */
  alt?: AvatarImagePrimitiveProps["alt"];
}): ReactElement {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={mergeClassName(className, avatarImageClass)}
      {...props}
    />
  );
}

/**
 * What the avatar shows while the image loads, or when it fails or is missing, such as the
 * person's initials.
 */
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
