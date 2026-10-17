import { useRef } from "react";
import type { ReactElement } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { NumberField } from "@elmeragroup/fuse/number-field";
import { TextField } from "@elmeragroup/fuse/text-field";

import { useCopy, useVideoLocale } from "../../../copy/copy";
import { useFrameClock } from "../../../motion/frame-clock";
import { FrameToast } from "../../../motion/frame-toast";
import { METER_NUMBER, READING_KWH } from "../../../sample/customer-data";
import { CLICK, MontageShot } from "./montage-shot";

/**
 * The montage's Toast shot: Nordic Green Energy, light, a reading form whose save raises a toast
 * on the click.
 *
 * @returns The shot.
 */
export function ToastShot(): ReactElement {
  const { montage, density } = useCopy();
  const locale = useVideoLocale();
  const clock = useFrameClock();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <MontageShot
      part="Toast"
      brand="ngfi"
      scheme="light"
      variant="external"
      target={trigger}
      aside={
        <Card.Root>
          <Card.Header>
            <Card.Title>{density.form.title}</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <TextField label={density.form.meter} defaultValue={METER_NUMBER} />
            <NumberField label={density.form.reading} denomination="kWh" defaultValue={READING_KWH} />
            <div>
              <Button ref={trigger}>{density.form.save}</Button>
            </div>
          </Card.Content>
        </Card.Root>
      }>
      <FrameToast
        at={CLICK}
        clock={clock}
        title={montage.toast.title}
        description={montage.toast.description(
          new Intl.NumberFormat(locale).format(READING_KWH),
          METER_NUMBER
        )}
        // Fuse places the viewport with `sm:` classes too; the stage's viewport is wider than `sm`.
        className="sm:right-36 sm:bottom-40 sm:w-90 absolute right-36 bottom-40 w-90"
      />
    </MontageShot>
  );
}
