"use client";

import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { ariaDisabledGuard } from "../../internal/aria-disabled-guard";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { cardSectionVariants } from "./card-variants";

export type CardSectionButtonProps = useRender.ComponentProps<"button">;

/**
 * A whole stacked section of a vertical card as one button, such as "No thanks, continue
 * without" with a trailing caret. It stacks, divides and rounds like a `Card.Section`, and adds
 * a hover fill, a pointer cursor, the state face and a focus ring drawn inside its own edges, so
 * the sections around it cannot cover it. It renders `<button type="button">`, the type
 * `useRender` gives its default button, so it never submits a form it sits in.
 *
 * `render={<a href="/terms" />}` makes it a link, which keeps its link semantics and takes no
 * `type`. A link takes no `disabled`, so mark an unavailable one `aria-disabled="true"`: the
 * section then dims, drops its hover fill and cancels its own activation, so a click or a
 * keyboard Enter neither follows the link nor runs `onClick`, and a middle-click opens no new tab.
 * A trigger composes it as it composes `Button`:
 * `<Dialog.Trigger render={<Card.SectionButton />}>Change plan</Dialog.Trigger>`. Hold phrasing
 * content only, such as text, an icon and a `Card.SectionMedia`, and no other control. Client
 * only because polymorphism is `useRender`; the rest of the Card compound stays server.
 */
export function CardSectionButton({ className, render, ...props }: CardSectionButtonProps): ReactElement {
  return useRender({
    defaultTagName: "button",
    props: {
      "data-slot": "card-section-button",
      // Filtered, as Button filters, so a forwarded `type={undefined}` cannot erase the default
      // button's `type="button"`.
      ...mergeProps<"button">(
        { className: cn(cardSectionVariants().button(), className) },
        definedProps(props),
        ariaDisabledGuard
      ),
    },
    render,
  });
}

CardSectionButton.displayName = "Card.SectionButton";
