import type { ReactElement, RefObject } from "react";

import { Select } from "@elmeragroup/fuse/select";
import { useTheme } from "@elmeragroup/fuse/theme";

import { priceAreasOf } from "../brand/brand-market";
import type { SeekedOverlayState } from "../motion/seeked-overlay";

/** Props for {@link PriceAreaSelect}. */
export type PriceAreaSelectProps = SeekedOverlayState & {
  /** Names the trigger. */
  readonly label: string;
  /** Sizes the trigger. */
  readonly className: string;
  /** Receives the trigger, for a cursor to aim at. */
  readonly trigger?: RefObject<HTMLButtonElement | null>;
};

/**
 * A price-area picker in its theme's market, drawn from an overlay host's state. The host, a
 * `SeekedOverlay` or a collage plate, decides when it opens.
 *
 * @returns The picker.
 */
export function PriceAreaSelect({
  open,
  container,
  label,
  className,
  trigger,
}: PriceAreaSelectProps): ReactElement {
  const { areas, picked } = priceAreasOf(useTheme().brand);
  return (
    <Select.Root items={areas} value={picked} open={open}>
      <Select.Trigger ref={trigger} aria-label={label} className={className}>
        <Select.Value />
      </Select.Trigger>
      {/* Every host sits under a scaled stage or a plate's transform, a containing block for fixed
          content where Fuse documents item alignment as unsupported, so the popup opens under its
          trigger. `finalFocus` follows the focus rule on `SeekedOverlay`. */}
      <Select.Content container={container} alignItemWithTrigger={false} finalFocus={false}>
        {Object.entries(areas).map(([value, label]) => (
          <Select.Item key={value} value={value}>
            {label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}
