"use client";

import type { ComponentPropsWithoutRef, ReactElement, RefAttributes } from "react";

import { composeRenderProps, Link as ReactAriaLink } from "react-aria-components";
import type { LinkRenderProps } from "react-aria-components";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { focusRing } from "../../styles/utils";
import { linkVariants } from "./link-variants";

/**
 * The RAC `Link` surface as-is plus the typography axes (link.md §3). RAC renders a real
 * `<a href>` when `href` is set and a `role="link"` span otherwise, so `href`, `target`,
 * `routerOptions`, `isDisabled`, the press/hover/focus events and `aria-current` all come
 * from RAC unchanged; nothing beyond them is added.
 */
export type LinkProps = ComponentPropsWithoutRef<typeof ReactAriaLink> & VariantProps<typeof linkVariants>;

/**
 * Interim foundational link atom over RAC `Link` (link.md §2). Client — RAC owns press,
 * hover and focus state.
 *
 * Client-side navigation is not this module's job: RAC's own router integration picks up
 * the `RouterProvider` that `UiProviders` installs, so an internal `href` calls the app's
 * `navigate` while `target="_blank"` and cross-origin links stay full navigations (§8.5).
 *
 * `className` is documented as a plain string merged after the recipe (§3), but RAC's own
 * type also allows the render-prop form. Both are handled by `composeRenderProps`: the
 * recipe resolves first, the shared focus ring reads RAC's `isFocusVisible` (§4), and the
 * caller's classes merge last so a Tailwind conflict resolves their way.
 */
export function Link({
  variant,
  leading,
  truncate,
  align,
  weight,
  className,
  ...props
}: LinkProps & RefAttributes<HTMLAnchorElement>): ReactElement {
  return (
    <ReactAriaLink
      {...props}
      className={composeRenderProps(
        className,
        (resolved: string | undefined, { isFocusVisible }: LinkRenderProps) =>
          cn(
            linkVariants({ variant, leading, truncate, align, weight }),
            focusRing({ target: "state", isFocusVisible }).root(),
            resolved
          )
      )}
    />
  );
}

Link.displayName = "Link";
