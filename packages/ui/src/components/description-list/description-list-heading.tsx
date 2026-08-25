"use client";

import type { ComponentProps, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "../../styles/cn";

export type DescriptionListHeadingProps = ComponentProps<"h2"> & {
  /**
   * Replaces the host `<h2>` via base-ui `useRender`. Use this for other outline
   * levels; the level-2 type classes and `data-slot` stay merged onto the replacement.
   */
  render?: useRender.RenderProp;
};

/**
 * Plain semantic `<h2>` with the ref's level-2 type classes (description-list.md §8.2).
 * Client only because polymorphism is `useRender`; the rest of the compound stays server.
 */
export function DescriptionListHeading({
  className,
  render,
  ...props
}: DescriptionListHeadingProps): ReactElement {
  return useRender({
    defaultTagName: "h2",
    props: {
      "data-slot": "description-list-heading",
      ...mergeProps<"h2">(
        {
          className: cn("text-lg leading-snug font-medium font-heading text-inherit", className),
        },
        props
      ),
    },
    render,
  });
}

DescriptionListHeading.displayName = "DescriptionList.Heading";
