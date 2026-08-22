import type { HTMLAttributes, ReactElement, ReactNode } from "react";

import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { cardVariants } from "./card-variants";

type CardVariantProps = VariantProps<typeof cardVariants>;

type CardDivProps = HTMLAttributes<HTMLDivElement> & CardVariantProps;

/** Heading type scale (heading.md §4 values); `size` maps to `text-{size}` (card.md §3). */
const TITLE_SIZE_CLASSES = {
  default: "text-base",
  sm: "text-sm",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
  "4xl": "text-4xl",
  "5xl": "text-5xl",
  "6xl": "text-6xl",
} as const;

/** Body type scale (text.md §4 values); `size` maps to `text-{size}` (card.md §3). */
const DESCRIPTION_SIZE_CLASSES = {
  xs: "text-xs",
  sm: "text-sm",
  default: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
} as const;

type CardTitleSize = keyof typeof TITLE_SIZE_CLASSES;
type CardDescriptionSize = keyof typeof DESCRIPTION_SIZE_CLASSES;
type CardTitleLevel = 1 | 2 | 3 | 4 | 5 | 6;

type CardTitleProps = HTMLAttributes<HTMLHeadingElement> &
  CardVariantProps & {
    level?: CardTitleLevel;
    size?: CardTitleSize;
    icon?: ReactNode;
  };

type CardDescriptionProps = HTMLAttributes<HTMLParagraphElement> &
  CardVariantProps & {
    size?: CardDescriptionSize;
  };

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
        TITLE_SIZE_CLASSES[size],
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
      className={cn(DESCRIPTION_SIZE_CLASSES[size], cardDescription(), className)}
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
