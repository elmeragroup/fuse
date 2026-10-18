import type { HTMLAttributes, ReactElement, ReactNode } from "react";

import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { CardSectionButton } from "./card-section-button";
import {
  cardDescriptionVariants,
  cardSectionVariants,
  cardTitleVariants,
  cardVariants,
} from "./card-variants";

// Every part takes `direction`; only the root takes the card's `size`, so the typography `size`
// of `Card.Title` and `Card.Description` stays their own.
type CardVariantProps = Pick<VariantProps<typeof cardVariants>, "direction">;

type CardDivProps = HTMLAttributes<HTMLDivElement> & CardVariantProps;

type CardRootProps = CardDivProps & {
  /**
   * The card's surface tier, which pads its sections, gaps them and sets their inner corner.
   * `default` takes the medium tier, `--surface-pad-md`, which Items and Accordion items pad with
   * too, so the card's text starts on their edge. `lg` takes the large
   * tier, `--surface-pad-lg`, for a card that holds long prose or acts as a page's main panel.
   */
  size?: keyof typeof cardVariants.variants.size;
};

type CardTitleLevel = 1 | 2 | 3 | 4 | 5 | 6;

type CardTitleProps = HTMLAttributes<HTMLHeadingElement> &
  CardVariantProps & {
    /**
     * Heading element level — `1`–`6` picks the rendered `h1`–`h6`. Defaults to `3`, so
     * a card titles itself without assuming its place in the document outline.
     */
    level?: CardTitleLevel;
    /** Typography size for the title, mapped to a `text-{size}` class. Defaults to `2xl`. */
    size?: NonNullable<VariantProps<typeof cardTitleVariants>["size"]>;
    /**
     * Rendered before `children` — the title becomes a flex row (`items-center gap-x-1.5`)
     * and any `svg` is sized to `5`.
     */
    icon?: ReactNode;
  };

type CardDescriptionProps = HTMLAttributes<HTMLParagraphElement> &
  CardVariantProps & {
    /** Typography size for the description, mapped to a `text-{size}` class. Defaults to `sm`. */
    size?: NonNullable<VariantProps<typeof cardDescriptionVariants>["size"]>;
  };

/**
 * The Card surface. It publishes `--inner-corner`, its corner less its border, and its header,
 * content and footer publish it less their padding too. The root and its sections write their
 * `direction` as `data-direction`: a vertical card pads its sections, a horizontal one pads itself.
 * The root writes its `size` as `data-size` and publishes its tier to the sections it holds.
 * Its 1px edge is the theme's `--card-border`: `--border` in internal themes and a zero-alpha
 * colour in external ones. A border colour class still wins. It casts Tailwind's `shadow-xs` in
 * the theme's `--card-shadow`: 5% black in internal themes and zero alpha in external ones. A
 * `shadow-*` class replaces it.
 */
function CardRoot({ className, direction, size = "default", ...props }: CardRootProps): ReactElement {
  const { base } = cardVariants({ direction, size });

  return (
    <div
      data-slot="card"
      data-direction={direction ?? "vertical"}
      data-size={size}
      className={cn(base(), className)}
      {...props}
    />
  );
}

function CardHeader({ className, direction, ...props }: CardDivProps): ReactElement {
  const { cardHeader } = cardVariants({ direction });

  return (
    <div
      data-slot="card-header"
      data-direction={direction ?? "vertical"}
      className={cn(cardHeader(), className)}
      {...props}
    />
  );
}

function CardTag({ className, direction, ...props }: CardDivProps): ReactElement {
  const { cardTag } = cardVariants({ direction });

  return <div data-slot="card-tag" className={cn(cardTag(), className)} {...props} />;
}

function CardTitle({
  children,
  className,
  direction,
  level = 3,
  size = "2xl",
  icon,
  ...props
}: CardTitleProps): ReactElement {
  const { cardTitle } = cardVariants({ direction });
  const Heading = `h${level}` as const;

  return (
    <Heading
      data-slot="card-title"
      className={cn(
        cardTitleVariants({ size }),
        cardTitle({
          // `direction="horizontal"` pins `text-xl/snug` here, so the size class must come first,
          // and the slot's leading must follow it: a font size drops a line height before it.
          className: icon ? "flex items-center gap-x-1.5 [&>svg]:size-5" : undefined,
        }),
        className
      )}
      {...props}>
      {icon ?? null}
      {children}
    </Heading>
  );
}

function CardDescription({
  className,
  direction,
  size = "sm",
  ...props
}: CardDescriptionProps): ReactElement {
  const { cardDescription } = cardVariants({ direction });

  return (
    <p
      data-slot="card-description"
      className={cn(cardDescriptionVariants({ size }), cardDescription(), className)}
      {...props}
    />
  );
}

function CardAction({ className, direction, ...props }: CardDivProps): ReactElement {
  const { cardAction } = cardVariants({ direction });

  return <div data-slot="card-action" className={cn(cardAction(), className)} {...props} />;
}

/**
 * A card's body. Inside a `Card.Section` it is the section's content column, beside a
 * `Card.SectionMedia`, and drops its own padding, since the section pads.
 */
function CardContent({ className, direction, ...props }: CardDivProps): ReactElement {
  const { cardContent } = cardVariants({ direction });

  return (
    <div
      data-slot="card-content"
      data-direction={direction ?? "vertical"}
      className={cn(cardContent(), className)}
      {...props}
    />
  );
}

function CardFooter({ className, direction, ...props }: CardDivProps): ReactElement {
  const { cardFooter } = cardVariants({ direction });

  return (
    <div
      data-slot="card-footer"
      data-direction={direction ?? "vertical"}
      className={cn(cardFooter(), className)}
      {...props}
    />
  );
}

/**
 * One of a vertical card's stacked sections of equal weight. Sections form the card's body under
 * one optional `Card.Header`: a `Card.Content` or `Card.Footer` beside them takes no divider, so
 * put that content in a section instead. A section pads every side with the card's tier, a 1px
 * `--card-section-divider` line separates it from the part above, and the first and last
 * sections round with the card's corners. A `Card.SectionMedia` as its first child makes it a
 * two-column grid with the media centred beside a `Card.Content`, the unpadded content column.
 * A horizontal card pads itself, so sections take no `direction` and belong in a vertical card.
 * A whole section that acts is a `Card.SectionButton`.
 */
function CardSection({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement {
  const { section } = cardSectionVariants();

  return <div data-slot="card-section" className={cn(section(), className)} {...props} />;
}

/**
 * The icon column of a `Card.Section` or `Card.SectionButton`. The section becomes a two-column
 * grid, this column and the content, with the icon centred on the section's height. An `svg` is
 * sized to `5`. It is a `span`, so it is phrasing content inside a section button.
 */
function CardSectionMedia({ className, ...props }: HTMLAttributes<HTMLSpanElement>): ReactElement {
  const { media } = cardSectionVariants();

  return <span data-slot="card-section-media" className={cn(media(), className)} {...props} />;
}

CardRoot.displayName = "Card.Root";
CardHeader.displayName = "Card.Header";
CardTag.displayName = "Card.Tag";
CardTitle.displayName = "Card.Title";
CardDescription.displayName = "Card.Description";
CardAction.displayName = "Card.Action";
CardContent.displayName = "Card.Content";
CardFooter.displayName = "Card.Footer";
CardSection.displayName = "Card.Section";
CardSectionMedia.displayName = "Card.SectionMedia";

export const Card = {
  Root: CardRoot,
  Header: CardHeader,
  Tag: CardTag,
  Title: CardTitle,
  Description: CardDescription,
  Action: CardAction,
  Content: CardContent,
  Footer: CardFooter,
  Section: CardSection,
  SectionButton: CardSectionButton,
  SectionMedia: CardSectionMedia,
};
