"use client";

import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";
import type { VariantProps } from "tailwind-variants";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { Info } from "../../icons/generated/info";
import type { ButtonProps } from "../button/button";
import { Button } from "../button/button";
import type { OverlayContainerProps } from "../overlay/overlay-props";
import { Popover } from "../popover/popover";
import { popoverInfoButtonStrings } from "./intl";

const popoverInfoButtonStyles = tv({
  slots: {
    icon: "size-4",
    content: "text-sm w-auto p-4",
  },
  variants: {
    contentSize: {
      sm: {
        content: "max-w-sm",
      },
      default: {
        content: "max-w-md",
      },
      lg: {
        content: "max-w-lg",
      },
      xl: {
        content: "max-w-xl",
      },
      "2xl": {
        content: "max-w-2xl",
      },
      "3xl": {
        content: "max-w-3xl",
      },
      "4xl": {
        content: "max-w-4xl",
      },
      "5xl": {
        content: "max-w-5xl",
      },
      "6xl": {
        content: "max-w-6xl",
      },
      "7xl": {
        content: "max-w-7xl",
      },
    },
  },
  defaultVariants: {
    contentSize: "default",
  },
});

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type PopoverInfoButtonProps = DistributiveOmit<ButtonProps, "children" | "aria-label"> &
  VariantProps<typeof popoverInfoButtonStyles> & {
    /** Popover body. */
    children: ReactNode;
    /**
     * Trigger accessible name (`aria-label`). Defaults to the locale dictionary;
     * an explicit value wins.
     */
    label?: string;
    /**
     * Portal target forwarded to `Popover.Content`. Defaults to the nearest
     * enclosing `ThemeScope` element.
     */
    container?: OverlayContainerProps["container"];
    /**
     * Max-width of the popover content. `sm`–`7xl` map to `max-w-sm`–`max-w-7xl`;
     * `"default"` is `max-w-md`.
     */
    contentSize?: VariantProps<typeof popoverInfoButtonStyles>["contentSize"];
  };

/**
 * Ghost icon-sm info button that opens a Popover (popover-info-button.md §2/§7).
 * Client — Popover state and localized trigger name.
 */
export function PopoverInfoButton({
  children,
  size = "icon-sm",
  variant = "ghost",
  contentSize = "default",
  label,
  container,
  ...other
}: PopoverInfoButtonProps): ReactElement {
  const strings = useLocalizedStrings(popoverInfoButtonStrings);
  const accessibleName = label ?? strings.format("moreInformation");
  const { icon, content } = popoverInfoButtonStyles({ contentSize });

  // SAFETY: PopoverInfoButtonProps is a distributive Omit of ButtonProps. Reassembling
  // the icon/label union after destructuring is a TypeScript limitation; the runtime
  // props are the same Button surface plus the owned aria-label.
  const trigger = (
    <Button
      {...({
        ...other,
        size,
        variant,
        "aria-label": accessibleName,
      } as ButtonProps)}
    />
  );

  return (
    <Popover.Root>
      <Popover.Trigger render={trigger}>
        <Info aria-hidden="true" className={icon()} />
      </Popover.Trigger>
      <Popover.Content side="right" sideOffset={8} showArrow className={content()} container={container}>
        {children}
      </Popover.Content>
    </Popover.Root>
  );
}

PopoverInfoButton.displayName = "PopoverInfoButton";
