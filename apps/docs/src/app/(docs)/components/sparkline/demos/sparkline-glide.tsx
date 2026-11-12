import { Sparkline, SparklineHover } from "@elmeragroup/fuse/chart";

const ORE = [61.2, 58.4, 55.9, 54.1, 57.3, 72.8, 104.5, 131.9, 118.2, 96.4, 88.7, 84.1];
const PRICE = { preset: "unit-price", currency: "NOK", minor: true, vat: "included" } as const;
const VARIANTS = [
  { variant: "line", color: "chart-1" },
  { variant: "area", color: "chart-2" },
  { variant: "bar", color: "chart-3" },
] as const;

/**
 * A server component that writes each variant twice: on the left with the CSS hover alone, which
 * cross-fades from value to value, and on the right inside one `SparklineHover`, whose crosshair,
 * dot and band glide on a spring once it hydrates. `render` makes the wrapper the column's own grid.
 * The Sparklines render on the server either way.
 */
export function SparklineGlide() {
  return (
    <div className="max-w-xl grid w-full grid-cols-2 gap-x-6 gap-y-4">
      <p className="text-sm text-muted-foreground">CSS hover</p>
      <p className="text-sm text-muted-foreground">SparklineHover</p>
      {VARIANTS.map(({ variant, color }) => (
        <Sparkline
          key={`css-${variant}`}
          aria-label={`Spot price, ${variant}, CSS hover`}
          data={ORE}
          locale="en-US"
          format={PRICE}
          variant={variant}
          color={color}
          className="col-start-1"
        />
      ))}
      <SparklineHover render={<div className="col-start-2 row-span-3 row-start-2 grid gap-y-4" />}>
        {VARIANTS.map(({ variant, color }) => (
          <Sparkline
            key={variant}
            aria-label={`Spot price, ${variant}, gliding`}
            data={ORE}
            locale="en-US"
            format={PRICE}
            variant={variant}
            color={color}
          />
        ))}
      </SparklineHover>
    </div>
  );
}
