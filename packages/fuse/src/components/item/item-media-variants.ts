import { tv } from "../../styles/tv";

/**
 * The `Item.Media` recipe. Package-private: not on the `@elmeragroup/fuse/item` facade. The
 * workspace-only recipe catalog re-exports it for the Figma component sync.
 *
 * Beside a description the media and Item.Content both align to the row's top, so media taller than
 * the content shares its top edge, and `--item-media-line` becomes one Item.Title line, `text-sm` at
 * `leading-snug` as ITEM_TITLE_CLASSES sets it. Icon media is exactly that tall and centres its
 * glyph, so a glyph of any size centres on the title's first line. Default and image media keep
 * their content's own height and so top-align with the content. The row is the part's own parent,
 * so a row nested in another row's footer or in a selection SubSection keeps its own centring; the
 * selection shell places its control on its first line through `--selection-first-line`.
 * Elsewhere the property is `auto` and the row centres the media. A plain utility reads the
 * property, so tailwind-merge drops it for a consumer's own height or size, and that size wins. A
 * minimum of one line on default media would override a smaller consumer height, which CSS cannot
 * tell apart without the class attribute.
 */
export const itemMediaVariants = tv({
  base: "flex shrink-0 items-center justify-center gap-2 [--item-media-line:auto] item-described:self-start item-described:[--item-media-line:calc(var(--text-sm)*var(--leading-snug))] [&_svg]:pointer-events-none",
  variants: {
    variant: {
      default: "bg-transparent",
      icon: "h-(--item-media-line) [&_svg:not([class*='size-'])]:size-4",
      // An image is taller than a title line, so beside a description it tops flush with the
      // content.
      image:
        "outline-black/10 size-10 overflow-hidden rounded-sm outline outline-1 -outline-offset-1 group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 [&_img]:size-full [&_img]:object-cover",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
