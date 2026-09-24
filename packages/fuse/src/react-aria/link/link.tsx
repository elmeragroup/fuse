"use client";

import type { ComponentPropsWithoutRef, ReactElement, RefAttributes } from "react";

import { composeRenderProps, Link as ReactAriaLink } from "react-aria-components";
import type { LinkRenderProps } from "react-aria-components";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { linkVariants } from "../../styles/link";
import { racDisabledStateFaceClass } from "../../styles/state-face";
import { focusRing } from "../../styles/utils";

/**
 * The RAC `Link` surface as-is plus the typography axes. RAC renders a real
 * `<a href>` when `href` is set and a `role="link"` span otherwise, so `href`, `target`,
 * `routerOptions`, `isDisabled`, the press/hover/focus events and `aria-current` all come
 * from RAC unchanged; nothing beyond them is added.
 */
export type LinkProps = ComponentPropsWithoutRef<typeof ReactAriaLink> & VariantProps<typeof linkVariants>;

/**
 * Interim foundational link atom over RAC `Link`. Client — RAC owns press,
 * hover and focus state.
 *
 * Client-side navigation is not this module's job: RAC's own router integration picks up
 * the `RouterProvider` that `UiProviders` installs, so an internal `href` calls the app's
 * `navigate` while `target="_blank"` and cross-origin links stay full navigations.
 *
 * `className` is documented as a plain string merged after the recipe, but RAC's own
 * type also allows the render-prop form. Both are handled by `composeRenderProps`: the
 * recipe resolves first, the shared focus ring reads RAC's `isFocusVisible`, the rac-target
 * state face reads `isDisabled`, and the caller's classes merge last so a Tailwind conflict
 * resolves their way. The hover fade sits behind `enabled-hover:`, so a disabled link stays
 * still under the pointer.
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
        (resolved: string | undefined, { isFocusVisible, isDisabled }: LinkRenderProps) =>
          cn(
            linkVariants({ variant, leading, truncate, align, weight }),
            focusRing({ target: "state", isFocusVisible }).root(),
            isDisabled && racDisabledStateFaceClass,
            resolved
          )
      )}
    />
  );
}

Link.displayName = "Link";
