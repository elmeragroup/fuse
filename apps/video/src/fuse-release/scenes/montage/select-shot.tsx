import { useRef } from "react";
import type { ReactElement, RefObject } from "react";

import { Select } from "@elmeragroup/fuse/select";
import { useTheme } from "@elmeragroup/fuse/theme";

import { priceAreasOf } from "../../../brand/brand-market";
import { useCopy } from "../../../copy/copy";
import { useFrameClock } from "../../../motion/frame-clock";
import type { FrameClock } from "../../../motion/frame-clock";
import { SeekedOverlay } from "../../../motion/seeked-overlay";
import { CLICK, MontageShot } from "./montage-shot";

/** Props for {@link PriceAreaSelect}. */
export type PriceAreaSelectProps = {
  readonly clock: FrameClock;
  /** Receives the trigger, which the shot's cursor aims at. */
  readonly trigger?: RefObject<HTMLButtonElement | null>;
};

/**
 * The Select shot's price-area picker, in its theme's market, which opens on the shot's click. It
 * takes the clock as a prop, so the browser suite renders this same picker inside a scaled stage.
 *
 * @returns The picker and its motion host.
 */
export function PriceAreaSelect({ clock, trigger }: PriceAreaSelectProps): ReactElement {
  const { montage } = useCopy();
  const { areas, picked } = priceAreasOf(useTheme().brand);
  return (
    <SeekedOverlay openAt={CLICK} clock={clock}>
      {({ open, container }) => (
        <Select.Root items={areas} value={picked} open={open}>
          <Select.Trigger ref={trigger} aria-label={montage.select.label} className="w-52">
            <Select.Value />
          </Select.Trigger>
          {/* The scaled stage and the app window's scale are containing blocks for fixed content, where
              Fuse documents item alignment as unsupported; the popup opens under its trigger.
              `finalFocus` follows the focus rule on `SeekedOverlay`. */}
          <Select.Content container={container} alignItemWithTrigger={false} finalFocus={false}>
            {Object.entries(areas).map(([value, label]) => (
              <Select.Item key={value} value={value}>
                {label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      )}
    </SeekedOverlay>
  );
}

/**
 * The montage's Select shot: Fjordkraft, light, a price-area picker that opens on the click.
 *
 * @returns The shot.
 */
export function SelectShot(): ReactElement {
  const { montage } = useCopy();
  const clock = useFrameClock();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <MontageShot
      part="Select"
      brand="fkas"
      scheme="light"
      variant="external"
      target={trigger}
      actions={
        <>
          <span className="text-sm text-muted-foreground">{montage.select.label}</span>
          <PriceAreaSelect clock={clock} trigger={trigger} />
        </>
      }
    />
  );
}
