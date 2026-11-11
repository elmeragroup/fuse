"use client";

import { isValidElement } from "react";
import type { Context, ReactElement } from "react";

import { LabelableProvider } from "@base-ui/react/internals/labelable-provider";
import type { useLabelableContext } from "@base-ui/react/internals/labelable-provider";

import { isThemeDevelopment } from "../../theme/validate-theme";

/**
 * Package-private. What Base UI's labelable context holds: the control, label and message ids of
 * one Field.
 */
export type LabelableValue = ReturnType<typeof useLabelableContext>;

/** Package-private. A labelable scope: Base UI's context, and a scope of the pane's own to give it. */
export type LabelableScope = { readonly Provider: Context<LabelableValue>; readonly own: LabelableValue };

/** The Base UI release whose labelable provider the probe below reads. */
const BASE_UI_ASSUMED = "@base-ui/react 1.9.0";

/** The context an element renders as its provider, when it is one, as React 19 renders a context. */
function contextOf(element: ReactElement): Context<LabelableValue> | null {
  // Typed as a tag or a component, but React renders a context as its own provider object.
  const type: unknown = element.type;
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- an element's type is a tag, a function or an object; only the object can be a context
  if (typeof type !== "object" || type === null || !("$$typeof" in type)) return null;
  if (type.$$typeof !== Symbol.for("react.context")) return null;
  // SAFETY: React marks a context with the context symbol, and this is the context Base UI's
  // labelable provider renders, whose value is Base UI's labelable value.
  return type as Context<LabelableValue>;
}

/** Whether the probe has reported missing Base UI's context, so development logs it once a page. */
let reportedMissing = false;

/**
 * Package-private. A labelable scope of a SkeletonReveal pane's own, from Base UI itself.
 *
 * Why a probe: Base UI 1.9.0 exports its labelable provider but not the context the provider
 * fills (`@base-ui/react/internals/labelable-provider` exports only the provider and hooks, and
 * the package's exports map reaches nothing deeper), and a patch to Base UI would not reach
 * Fuse's consumers. A pane can only change scope without a remount by providing that context
 * itself, so this runs the provider as a hook, every render, so its state is the pane's own scope,
 * and takes the context from the element it renders. Issue #504 tracks asking Base UI to export
 * the context, which would let a pane mount the provider normally.
 *
 * It never throws. If a Base UI release renders its provider differently, it returns null and the
 * pane shares the Field's scope, as before panes had scopes of their own; development logs one
 * error naming the release it assumes.
 *
 * @returns Base UI's labelable context and a scope of the pane's own, or null when the installed
 *   Base UI no longer renders its provider as assumed.
 */
export function useOwnLabelableScope(): LabelableScope | null {
  const element = LabelableProvider({ children: null });
  const Provider = isValidElement<{ value?: LabelableValue }>(element) ? contextOf(element) : null;
  const own = isValidElement<{ value?: LabelableValue }>(element) ? element.props.value : undefined;
  if (Provider !== null && own !== undefined) return { Provider, own };
  if (isThemeDevelopment() && !reportedMissing) {
    reportedMissing = true;
    console.error(
      `SkeletonReveal: Base UI's LabelableProvider no longer renders its labelable context as ${BASE_UI_ASSUMED} did, so excluded panes share the Field's labels. Update skeleton-reveal-labelable.ts for the installed Base UI.`
    );
  }
  return null;
}
