/**
 * Server-visible namespace for `Avatar`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { AvatarRoot, AvatarGroup, AvatarImage, AvatarFallback } from "./avatar";

export const Avatar = {
  Root: AvatarRoot,
  Group: AvatarGroup,
  Image: AvatarImage,
  Fallback: AvatarFallback,
};
