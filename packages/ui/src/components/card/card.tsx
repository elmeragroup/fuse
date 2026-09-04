import type { HTMLAttributes, ReactElement, ReactNode } from "react";

import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { cardDescriptionVariants, cardTitleVariants, cardVariants } from "./card-variants";

type CardVariantProps = VariantProps<typeof cardVariants>;

type CardDivProps = HTMLAttributes<HTMLDivElement> & CardVariantProps;

type CardTitleLevel = 1 | 2 | 3 | 4 | 5 | 6;

type CardTitleProps = HTMLAttributes<HTMLHeadingElement> &
  CardVariantProps &
  VariantProps<typeof cardTitleVariants> & {
    /**
     * Heading element level — `1`–`6` picks the rendered `h1`–`h6`. Defaults to `3`, so
     * a card titles itself without assuming its place in the document outline.
     */
    level?: CardTitleLevel;
    /**
     * Rendered before `children` — the title becomes a flex row (`items-center gap-x-1.5`)
     * and any `svg` is sized to `5`.
     */
    icon?: ReactNode;
  };

type CardDescriptionProps = HTMLAttributes<HTMLParagraphElement> &
  CardVariantProps &
  VariantProps<typeof cardDescriptionVariants>;

function CardRoot({ className, direction, ...props }: CardDivProps): ReactElement {
  const { base } = cardVariants({ direction });

  return <div data-slot="card" className={cn(base(), className)} {...props} />;
}

function CardHeader({ className, direction, ...props }: CardDivProps): ReactElement {
  const { cardHeader } = cardVariants({ direction });

  return <div data-slot="card-header" className={cn(cardHeader(), className)} {...props} />;
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
          // `direction="horizontal"` pins `text-xl` here, so the size class must come first.
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

function CardContent({ className, direction, ...props }: CardDivProps): ReactElement {
  const { cardContent } = cardVariants({ direction });

  return <div data-slot="card-content" className={cn(cardContent(), className)} {...props} />;
}

function CardFooter({ className, direction, ...props }: CardDivProps): ReactElement {
  const { cardFooter } = cardVariants({ direction });

  return <div data-slot="card-footer" className={cn(cardFooter(), className)} {...props} />;
}

CardRoot.displayName = "Card.Root";
CardHeader.displayName = "Card.Header";
CardTag.displayName = "Card.Tag";
CardTitle.displayName = "Card.Title";
CardDescription.displayName = "Card.Description";
CardAction.displayName = "Card.Action";
CardContent.displayName = "Card.Content";
CardFooter.displayName = "Card.Footer";

export const Card = {
  Root: CardRoot,
  Header: CardHeader,
  Tag: CardTag,
  Title: CardTitle,
  Description: CardDescription,
  Action: CardAction,
  Content: CardContent,
  Footer: CardFooter,
};
