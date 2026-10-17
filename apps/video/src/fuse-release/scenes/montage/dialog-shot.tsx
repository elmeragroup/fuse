import { useRef } from "react";
import type { ReactElement } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Dialog } from "@elmeragroup/fuse/dialog";

import { useCopy } from "../../../copy/copy";
import { useFrameClock } from "../../../motion/frame-clock";
import { SeekedOverlay } from "../../../motion/seeked-overlay";
import { CLICK, MontageShot } from "./montage-shot";

/**
 * The montage's Dialog shot: TrøndelagKraft, dark, a confirmation that opens on the click.
 *
 * @returns The shot.
 */
export function DialogShot(): ReactElement {
  const { montage } = useCopy();
  const clock = useFrameClock();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <MontageShot
      part="Dialog"
      brand="tkas"
      scheme="dark"
      variant="external"
      target={trigger}
      actions={
        <Button ref={trigger} variant="outline">
          {montage.dialog.trigger}
        </Button>
      }>
      <SeekedOverlay openAt={CLICK} clock={clock}>
        {({ open, container }) => (
          <Dialog.Root open={open}>
            <Dialog.Content container={container}>
              <Dialog.Header>
                <Dialog.Title>{montage.dialog.title}</Dialog.Title>
                <Dialog.Description>{montage.dialog.description}</Dialog.Description>
              </Dialog.Header>
              <Dialog.Footer>
                <Button variant="outline">{montage.dialog.cancel}</Button>
                <Button>{montage.dialog.confirm}</Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Root>
        )}
      </SeekedOverlay>
    </MontageShot>
  );
}
