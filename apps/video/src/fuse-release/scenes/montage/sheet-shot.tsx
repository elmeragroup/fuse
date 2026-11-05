import { useRef } from "react";
import type { ReactElement } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Sheet } from "@elmeragroup/fuse/sheet";
import { TextField } from "@elmeragroup/fuse/text-field";

import { useCopy, useVideoLocale } from "../../../copy/copy";
import { formatDay } from "../../../copy/format-day";
import { useFrameClock } from "../../../motion/frame-clock";
import type { FrameClock } from "../../../motion/frame-clock";
import { SeekedOverlay } from "../../../motion/seeked-overlay";
import { CLICK, MontageShot } from "./montage-shot";

/**
 * The Sheet shot's new-order sheet, which slides in on the shot's click. It takes the clock as a
 * prop, so the browser suite renders this same sheet against a history of frames.
 *
 * @param props.clock - The shot's frame.
 * @returns The sheet and its motion host.
 */
export function NewOrderSheet({ clock }: { readonly clock: FrameClock }): ReactElement {
  const { montage } = useCopy();
  const start = formatDay(useVideoLocale(), Date.UTC(2026, 10, 1));
  return (
    <SeekedOverlay openAt={CLICK} clock={clock}>
      {({ open, container }) => (
        <Sheet.Root open={open}>
          {/* The pointer opened it, so focus stays put and no keyboard ring shows. */}
          <Sheet.Content container={container} initialFocus={false}>
            <Sheet.Header>
              <Sheet.Title>{montage.sheet.title}</Sheet.Title>
              <Sheet.Description>{montage.sheet.description}</Sheet.Description>
            </Sheet.Header>
            <Sheet.Body className="flex flex-col gap-4">
              <TextField label={montage.sheet.customer} defaultValue="Ingrid Lie" />
              <TextField label={montage.sheet.product} defaultValue={montage.sheet.productValue} />
              <TextField label={montage.sheet.start} defaultValue={start} />
            </Sheet.Body>
            <Sheet.Footer>
              <Button>{montage.sheet.submit}</Button>
            </Sheet.Footer>
          </Sheet.Content>
        </Sheet.Root>
      )}
    </SeekedOverlay>
  );
}

/**
 * The montage's Sheet shot: Gudbrandsdal Energi's internal app, light, a new-order sheet that
 * slides in on the click.
 *
 * @returns The shot.
 */
export function SheetShot(): ReactElement {
  const { montage } = useCopy();
  const clock = useFrameClock();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <MontageShot
      part="Sheet"
      brand="guen"
      scheme="light"
      variant="internal"
      target={trigger}
      actions={<Button ref={trigger}>{montage.sheet.title}</Button>}>
      <NewOrderSheet clock={clock} />
    </MontageShot>
  );
}
