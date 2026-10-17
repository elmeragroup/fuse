import { useRef } from "react";
import type { ReactElement } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Command } from "@elmeragroup/fuse/command";
import { Kbd } from "@elmeragroup/fuse/kbd";

import { typedCount } from "../../../components/remocn/typewriter";
import { useCopy } from "../../../copy/copy";
import { useFrameClock } from "../../../motion/frame-clock";
import { SeekedOverlay } from "../../../motion/seeked-overlay";
import { beats } from "../../../music/beat-grid";
import { CLICK, MontageShot } from "./montage-shot";

/** The query starts typing a beat after the palette opens. */
const TYPE_AT = CLICK + beats(1);
const CHARS_PER_SECOND = 10;

/**
 * The montage's Command shot: Elmera's internal app, dark, a palette that opens on the click and
 * filters as the query types itself.
 *
 * @returns The shot.
 */
export function CommandShot(): ReactElement {
  const { montage } = useCopy();
  const clock = useFrameClock();
  const trigger = useRef<HTMLButtonElement>(null);
  const query = Array.from(montage.command.query);
  const typed = query
    .slice(0, typedCount(clock.frame - TYPE_AT, clock.fps, query.length, CHARS_PER_SECOND))
    .join("");
  return (
    <MontageShot
      part="Command"
      brand="elma"
      scheme="dark"
      variant="internal"
      target={trigger}
      actions={
        <Button ref={trigger} variant="outline">
          {montage.search}
          <Kbd>⌘K</Kbd>
        </Button>
      }>
      <SeekedOverlay openAt={CLICK} clock={clock}>
        {({ open, container }) => (
          <Command.Root items={montage.command.items} open={open} value={typed}>
            <Command.Content container={container}>
              <Command.Input placeholder={montage.command.placeholder} />
              <Command.Empty />
              <Command.List>
                {(item: string) => (
                  <Command.Item key={item} value={item}>
                    {item}
                  </Command.Item>
                )}
              </Command.List>
              <Command.Footer>
                <Command.NavigateHint />
                <Command.SelectHint />
                <Command.CloseHint />
              </Command.Footer>
            </Command.Content>
          </Command.Root>
        )}
      </SeekedOverlay>
    </MontageShot>
  );
}
