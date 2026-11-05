import { useRef } from "react";
import type { ReactElement, RefObject } from "react";

import { useCopy } from "../../../copy/copy";
import { useFrameClock } from "../../../motion/frame-clock";
import type { FrameClock } from "../../../motion/frame-clock";
import { SeekedOverlay } from "../../../motion/seeked-overlay";
import { PriceAreaSelect } from "../../../sample/price-area-select";
import { CLICK, MontageShot } from "./montage-shot";

/** Props for {@link SeekedPriceAreaSelect}. */
export type SeekedPriceAreaSelectProps = {
  readonly clock: FrameClock;
  /** Receives the trigger, which the shot's cursor aims at. */
  readonly trigger?: RefObject<HTMLButtonElement | null>;
};

/**
 * The Select shot's price-area picker, which opens on the shot's click. It takes the clock as a
 * prop, so the browser suite renders this same picker inside a scaled stage.
 *
 * @returns The picker and its motion host.
 */
export function SeekedPriceAreaSelect({ clock, trigger }: SeekedPriceAreaSelectProps): ReactElement {
  const { montage } = useCopy();
  return (
    <SeekedOverlay openAt={CLICK} clock={clock}>
      {(overlay) => (
        <PriceAreaSelect {...overlay} label={montage.select.label} className="w-52" trigger={trigger} />
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
          <SeekedPriceAreaSelect clock={clock} trigger={trigger} />
        </>
      }
    />
  );
}
