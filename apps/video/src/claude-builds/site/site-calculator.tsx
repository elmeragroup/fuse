import type { ReactElement, RefObject } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { Select } from "@elmeragroup/fuse/select";
import { SelectField } from "@elmeragroup/fuse/select-field";
import { Separator } from "@elmeragroup/fuse/separator";
import { Slider } from "@elmeragroup/fuse/slider";
import type { BrandCode } from "@elmeragroup/fuse/theme";

import { moneyFormat } from "../../brand/brand-market";
import { useCopy, useVideoLocale } from "../../copy/copy";
import { marketOf, monthlyEstimate } from "./site-market";

/** The yearly use the slider ranges over, in kWh, and its snap step. */
const USE_RANGE = { min: 2000, max: 30_000, step: 100 } as const;

/** Props for {@link SiteCalculator}. */
export type SiteCalculatorProps = {
  readonly brand: BrandCode;
  /** The yearly use the slider shows on this frame, in kWh. */
  readonly yearlyKwh: number;
  /** Receives the order button, which the session's cursor aims at. */
  readonly order: RefObject<HTMLButtonElement | null>;
};

/**
 * The site's price calculator: the brand's price area, the yearly use on a slider, and the
 * month's estimated cost in the brand's currency, which follows the slider.
 *
 * @returns The calculator, filling its section.
 */
export function SiteCalculator({ brand, yearlyKwh, order }: SiteCalculatorProps): ReactElement {
  const { calculator, order: orderLabel, plans, areas } = useCopy().claudeBuilds.site;
  const market = marketOf(brand);
  const area = areas[market.currency];
  const money = moneyFormat(useVideoLocale(), market.currency);
  return (
    <section className="grid h-full grid-cols-[minmax(0,1fr)_30rem] items-center gap-12 bg-card-soft px-10 text-card-soft-foreground">
      <div className="flex flex-col gap-3">
        <h2 className="text-3xl font-semibold tracking-tight m-0 font-heading">{calculator.title}</h2>
        <p className="m-0 text-pretty text-muted-foreground">{calculator.lede}</p>
        <p className="text-sm m-0 text-pretty text-muted-foreground">{calculator.note}</p>
      </div>
      <Card.Root>
        <Card.Content className="flex flex-col gap-5 pt-(--surface-pad-lg)">
          <SelectField label={calculator.area} items={{ [area]: area }} value={area}>
            <Select.Item value={area}>{area}</Select.Item>
          </SelectField>
          <Slider
            label={calculator.use}
            value={yearlyKwh}
            minValue={USE_RANGE.min}
            maxValue={USE_RANGE.max}
            step={USE_RANGE.step}
            formatOptions={{ maximumFractionDigits: 0 }}
            showValue
          />
          <Separator />
          <div className="flex items-end justify-between gap-4">
            <p className="m-0 flex flex-col">
              <span className="text-xs text-muted-foreground">{calculator.estimate}</span>
              <span className="text-3xl font-semibold tracking-tight font-heading tabular-nums">
                {plans.perMonth(money.format(monthlyEstimate(market, yearlyKwh)))}
              </span>
            </p>
            <Button ref={order} size="lg">
              {orderLabel}
            </Button>
          </div>
        </Card.Content>
      </Card.Root>
    </section>
  );
}
