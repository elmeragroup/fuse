import type { ComponentType, ReactElement } from "react";

import { Interactive, Sequence } from "remotion";

import { sceneGrid } from "../../music/scene-grid";
import { SceneFrame } from "../../primitives/scene-frame";
import { CommandShot } from "./montage/command-shot";
import { DialogShot } from "./montage/dialog-shot";
import { MONTAGE_PARTS } from "./montage/montage-shot";
import type { MontagePart } from "./montage/montage-shot";
import { SelectShot } from "./montage/select-shot";
import { SheetShot } from "./montage/sheet-shot";
import { ToastShot } from "./montage/toast-shot";

/** The shot that opens each part. */
const SHOTS = {
  Select: SelectShot,
  Dialog: DialogShot,
  Sheet: SheetShot,
  Command: CommandShot,
  Toast: ToastShot,
} as const satisfies Record<MontagePart, ComponentType>;

/** The shots laid end to end, two bars each. */
const GRID = sceneGrid(MONTAGE_PARTS.map((name) => ({ name, bars: 2 })));

function MontageSceneInner(): ReactElement {
  return (
    <SceneFrame>
      <div className="relative size-full overflow-hidden">
        {MONTAGE_PARTS.map((name) => {
          const Shot = SHOTS[name];
          return (
            <Sequence key={name} name={name} {...GRID.frames(name)} layout="none">
              <Shot />
            </Sequence>
          );
        })}
      </div>
    </SceneFrame>
  );
}

/**
 * Scene 4: Select, Dialog, Sheet, Command and Toast, two bars (2.8 s) each, each opening with
 * Fuse's own motion in another brand. Every cut lands on a downbeat.
 */
export const MontageScene = Interactive.withSchema({
  Component: MontageSceneInner,
  componentName: "MontageScene",
  schema: {},
  wrapInSequence: true,
  layout: "absolute-fill",
});
