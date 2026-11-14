"use client";

import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { ariaDisabledGuard } from "../../internal/aria-disabled-guard";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { cardSectionVariants } from "./card-variants";

/** `Card.SectionButton` takes a native button's props and `render`. */
export type CardSectionButtonProps = Omit<
  useRender.ComponentProps<"button">,
  "render" | "children" | "aria-disabled"
> & {
  /**
   * Replaces the host `<button type="button">`. `render={<a href="/terms" />}` makes the section a
   * link. To make it a trigger, pass it to the trigger's `render`, as with `Button`:
   * `<Dialog.Trigger render={<Card.SectionButton />}>Change plan</Dialog.Trigger>`.
   */
  render?: useRender.ComponentProps<"button">["render"];
  /**
   * The section's content. Use phrasing content only, such as text, an icon and a
   * `Card.SectionMedia`, and no other control. Beside a `Card.SectionMedia`, put the text in a
   * plain `span`, not a `Card.Content`, which is a `div`.
   */
  children?: useRender.ComponentProps<"button">["children"];
  /**
   * Marks an unavailable section. A link takes no `disabled`, so mark it `aria-disabled="true"`.
   * The section dims and drops its hover fill, and a click or Enter neither follows the link nor
   * runs `onClick`. A middle-click opens no new tab.
   */
  "aria-disabled"?: useRender.ComponentProps<"button">["aria-disabled"];
};

/**
 * A whole stacked section of a vertical card as one button. It stacks, divides and rounds like a
 * `Card.Section`, and adds a hover fill, a pointer cursor, the state face and a focus ring drawn
 * inside its own edges, so the sections around it cannot cover it. Its default button gets
 * `type="button"` from `useRender`, so it never submits a form it sits in. It is a client module
 * because `useRender` is; the rest of the Card compound stays server.
 *
 * @param props - The native button props and the host element.
 * @returns The rendered section button.
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
