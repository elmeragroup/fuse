/**
 * Server-visible namespace for `Avatar`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { Root, Group, Image, Fallback } from "./index.parts";

export const Avatar = {
  Root,
  Group,
  Image,
  Fallback,
};
