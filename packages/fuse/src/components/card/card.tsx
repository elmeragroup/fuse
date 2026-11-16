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
type CardVariantProps = {
  /**
   * The card's layout. `horizontal` sets the header, content and footer side by side and wraps
   * whole parts onto a new row as the container narrows, keeping a title with its description.
   * Pass the same value to the root and to every part. Sections take no `direction`, so use them
   * in a vertical card.
   */
  direction?: VariantProps<typeof cardVariants>["direction"];
};

type CardDivProps = HTMLAttributes<HTMLDivElement> & CardVariantProps;

type CardRootProps = CardDivProps & {
  /**
   * The card's surface tier, which pads its parts, gaps them and sets their inner corner.
   * `default` takes the medium tier, `--surface-pad-md`, which Items and Accordion items pad with
   * too, so the card's text starts on their edge. `lg` takes the large tier, `--surface-pad-lg`,
   * for a card that holds long prose or is a page's main panel. A card nested in another takes
   * its own `size`, not its parent's.
   */
  size?: keyof typeof cardVariants.variants.size;
  /**
   * The card's parts. Give it a `Card.Header` if it needs one, then a `Card.Content` and a
   * `Card.Footer`, or a run of `Card.Section` and `Card.SectionButton` parts. In a vertical card,
   * a content or footer that opens the card pads every side with the card's tier, and one below
   * another part drops its top padding, so the tier is also the gap between them. A horizontal
   * card pads itself and gaps its parts with the tier. Sections make up the whole body. A
   * `Card.Content` or `Card.Footer` beside them gets no divider line, so put that content in a
   * last section.
   */
  children?: HTMLAttributes<HTMLDivElement>["children"];
  /**
   * Extra classes, merged after the card's own. A border colour class replaces the card's edge
   * colour, a shadow size class such as `shadow-md` replaces its shadow, and a shadow colour class
   * tints the shadow. To recolour the edge or shadow of many cards, set `--card-border` or
   * `--card-shadow` on the `ThemeScope` or another element around them. A `bg-*` class that
   * changes the fill should set `--surface` and `--surface-muted-foreground` to match, as in
   * `className="bg-muted [--surface:var(--muted)] [--surface-muted-foreground:var(--muted-foreground)]"`,
   * so a chart inside cuts its seams out of the new fill.
   */
  className?: HTMLAttributes<HTMLDivElement>["className"];
};

type CardTitleLevel = 1 | 2 | 3 | 4 | 5 | 6;

type CardTitleProps = HTMLAttributes<HTMLHeadingElement> &
  CardVariantProps & {
    /**
     * The outline level, `1` to `6`, which picks the rendered `h1` to `h6`. The default `3`
     * suits a card in a page section. Set the level that fits the card's place in the outline.
     */
    level?: CardTitleLevel;
    /** The title's type size. */
    size?: NonNullable<VariantProps<typeof cardTitleVariants>["size"]>;
    /**
     * An icon before the title text. The title becomes a flex row, and an `svg` is sized to
     * `size-5`. Mark a decorative icon `aria-hidden`.
     */
    icon?: ReactNode;
  };

type CardDescriptionProps = HTMLAttributes<HTMLParagraphElement> &
  CardVariantProps & {
    /** The description's type size. */
    size?: NonNullable<VariantProps<typeof cardDescriptionVariants>["size"]>;
  };

type CardSectionMediaProps = HTMLAttributes<HTMLSpanElement> & {
  /**
   * The section's icon, sized to `size-5`. Put the media first in a `Card.Section` or
   * `Card.SectionButton`. The section becomes two columns, the icon centred on the section's
   * height beside the content. In a `Card.Section`, put the content in a `Card.Content`. In a
   * `Card.SectionButton`, put it in a plain `span`, because a button holds phrasing content only.
   */
  children?: ReactNode;
};

/**
 * The Card surface. It publishes `--inner-corner`, its corner less its border, and its header,
 * content and footer publish it less their padding too. The root and its parts write their
 * `direction` as `data-direction`: a vertical card pads its parts, a horizontal one pads itself.
 * The root writes its `size` as `data-size` and publishes its tier to the sections it holds.
 * Its 1px edge is the theme's `--card-border`, which is `--border` in neutral themes and a
 * zero-alpha colour in branded ones. It casts Tailwind's `shadow-xs` in the theme's
 * `--card-shadow`, which is 5% black in neutral themes and zero alpha in branded ones. In a
 * branded theme only its fill sets a card apart from the page tint, so a card nested in another
 * card shows no edge.
 *
 * It states its `card` fill as `--surface`, the colour of the fill an element sits on, so a
 * chart in it cuts its rings and seams out of the card, and its muted text as
 * `--surface-muted-foreground`, which a chart's chips read.
 */
function CardRoot({
  className,
  direction = "vertical",
  size = "default",
  ...props
}: CardRootProps): ReactElement {
  const { base } = cardVariants({ direction, size });

  return (
    <div
      data-slot="card"
      data-direction={direction}
      data-size={size}
      className={cn(base(), className)}
      {...props}
    />
  );
}

function CardHeader({ className, direction = "vertical", ...props }: CardDivProps): ReactElement {
  const { cardHeader } = cardVariants({ direction });

  return (
    <div
      data-slot="card-header"
      data-direction={direction}
      className={cn(cardHeader(), className)}
      {...props}
    />
  );
}

function CardTag({ className, direction = "vertical", ...props }: CardDivProps): ReactElement {
  const { cardTag } = cardVariants({ direction });

  return <div data-slot="card-tag" className={cn(cardTag(), className)} {...props} />;
}

function CardTitle({
  children,
  className,
  direction = "vertical",
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
  direction = "vertical",
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

function CardAction({ className, direction = "vertical", ...props }: CardDivProps): ReactElement {
  const { cardAction } = cardVariants({ direction });

  return <div data-slot="card-action" className={cn(cardAction(), className)} {...props} />;
}

/**
 * A card's body. Inside a `Card.Section` it is the section's content column, beside a
 * `Card.SectionMedia`, and drops its own padding, because the section pads.
 */
function CardContent({ className, direction = "vertical", ...props }: CardDivProps): ReactElement {
  const { cardContent } = cardVariants({ direction });

  return (
    <div
      data-slot="card-content"
      data-direction={direction}
      className={cn(cardContent(), className)}
      {...props}
    />
  );
}

function CardFooter({ className, direction = "vertical", ...props }: CardDivProps): ReactElement {
  const { cardFooter } = cardVariants({ direction });

  return (
    <div
      data-slot="card-footer"
      data-direction={direction}
      className={cn(cardFooter(), className)}
      {...props}
    />
  );
}

/**
 * One of a vertical card's stacked sections of equal weight. A section pads every side with the
 * card's tier. A 1px line in the theme's `--card-section-divider` runs above every section that
 * has a part above it, from edge to edge: `--border` in neutral themes and the page tint,
 * `--background`, in branded ones. The first and last sections round with the card's corners, so
 * a fill follows them. A footer after sections takes no line and no top padding.
 */
function CardSection({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement {
  const { section } = cardSectionVariants();

  return <div data-slot="card-section" className={cn(section(), className)} {...props} />;
}

/** The icon column of a `Card.Section` or `Card.SectionButton`, a `span` so a section button can hold it. */
function CardSectionMedia({ className, ...props }: CardSectionMediaProps): ReactElement {
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
