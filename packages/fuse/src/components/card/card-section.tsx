"use client";

import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "../../styles/cn";
import { cardVariants } from "./card-variants";

export type CardSectionProps = useRender.ComponentProps<"div">;

/**
 * One of a vertical card's stacked sections. It pads every side with the card's tier, a 1px
 * `--card-section-divider` line separates it from the section above, and the first and last
 * sections round with the card's corners. A `Card.SectionMedia` as its first child makes it a
 * two-column grid with the media centred beside the content; wrap the content in one element.
 *
 * `render` makes the whole section a button or a link, such as
 * `render={<button type="button" onClick={onDecline} />}`. It keeps its native semantics and takes
 * a hover fill, a pointer cursor and an inset focus ring; put no other control inside it. Client
 * only because polymorphism is `useRender`; the rest of the Card compound stays server.
 */
export function CardSection({ className, render, ...props }: CardSectionProps): ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { "data-slot": "card-section", className: cn(cardVariants().cardSection(), className) },
      props
    ),
    render,
  });
}

CardSection.displayName = "Card.Section";
