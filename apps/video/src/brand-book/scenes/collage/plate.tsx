import { createContext, use } from "react";
import type { ReactElement, ReactNode } from "react";

import type { BrandCode, ThemeVariant } from "@elmeragroup/fuse/theme";
import type { ResolvedColorScheme } from "@elmeragroup/fuse/theme-catalog";

import { BrandMark } from "../../../brand/brand-mark";
import type { FrameClock } from "../../../motion/frame-clock";
import { SeekedOverlay } from "../../../motion/seeked-overlay";
import type { SeekedOverlayState } from "../../../motion/seeked-overlay";
import { SceneTheme } from "../../../primitives/scene-theme";
import type { OverlayWindow } from "./collage-layout";

/** The theme a plate shows its part in. */
export type PlateTheme = {
  readonly brand: BrandCode;
  readonly scheme: ResolvedColorScheme;
  /** External by default, as a customer page is. */
  readonly variant?: ThemeVariant;
};

/** Props for {@link ComponentPlate}. */
export type ComponentPlateProps = {
  /** The part's API name, the same in every locale. */
  readonly name: string;
  readonly theme: PlateTheme;
  readonly children: ReactNode;
};

/**
 * One plate of the collage: a part on its brand's page, captioned like a brand book's specimen with
 * the part's name and the brand's mark. Overlays inside portal into the plate's theme scope, and
 * the plate's own transform contains their fixed layers, so a Dialog centres on the plate.
 *
 * @returns The plate, filling its slot.
 */
export function ComponentPlate({ name, theme, children }: ComponentPlateProps): ReactElement {
  return (
    <SceneTheme
      brand={theme.brand}
      scheme={theme.scheme}
      variant={theme.variant}
      className="relative flex size-full flex-col bg-background font-sans text-foreground">
      <div className="flex min-h-0 flex-1 flex-col justify-center px-5 pt-5">{children}</div>
      <div className="text-xs flex h-10 shrink-0 items-center justify-between px-5 text-muted-foreground">
        <span>{name}</span>
        <BrandMark brand={theme.brand} className="h-3.5" />
      </div>
    </SceneTheme>
  );
}

/**
 * What a plate's overlays move by: the collage's clock, and the frames they are open on, which the
 * collage works out from where the plate's lane carries it; `null` while the plate is never wholly
 * in view, so its overlays stay closed.
 */
export type PlateMotion = {
  readonly clock: FrameClock;
  readonly window: OverlayWindow | null;
};

/** The motion of the plate a part renders on; each collage plate provides its own. */
export const PlateMotionContext = createContext<PlateMotion | null>(null);

/**
 * The motion of the plate this part renders on.
 *
 * @returns The plate's clock and overlay window.
 * @throws When the part renders outside a collage plate, a defect in the collage.
 */
export function usePlateMotion(): PlateMotion {
  const motion = use(PlateMotionContext);
  if (motion === null) {
    throw new Error("A collage part rendered outside a plate, which provides its motion.");
  }
  return motion;
}

/**
 * An overlay on a plate. It opens with Fuse's own motion once its plate is wholly in view, and
 * closes at once before the plate reaches the frame's edge, inside a motion host that seeks its
 * motion from the opening frame and holds the frame until the popup has mounted. Its popup follows
 * the focus rule on `SeekedOverlay`.
 *
 * @param props.children - Renders the overlay from its state.
 * @returns The overlay and its motion host.
 */
export function PlateOverlay({
  children,
}: {
  readonly children: (overlay: SeekedOverlayState) => ReactNode;
}): ReactElement {
  const { clock, window: span } = usePlateMotion();
  return (
    <SeekedOverlay openAt={span?.openAt ?? Number.POSITIVE_INFINITY} closeAt={span?.closeAt} clock={clock}>
      {children}
    </SeekedOverlay>
  );
}
