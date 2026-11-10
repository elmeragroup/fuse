"use client";

import { createContext, use, useState } from "react";
import type { Dispatch, ReactElement, ReactNode, SetStateAction } from "react";

/** True while the hero window shows the side the reader sits on. Outside the window, always true. */
const SideShownContext = createContext(true);

type WindowSideProps = {
  /** Whether the window shows this side. */
  shown: boolean;
  children: ReactNode;
};

/** Tells every overlay on one side of the hero window whether that side is shown. */
export function WindowSide({ shown, children }: WindowSideProps): ReactElement {
  return <SideShownContext value={shown}>{children}</SideShownContext>;
}

/**
 * True while the hero window shows the side the caller sits on.
 *
 * @returns Whether the caller's side is shown; true outside the window.
 */
export function useSideShown(): boolean {
  return use(SideShownContext);
}

/**
 * State for an overlay on one side of the hero window: it returns to `closed` whenever the side
 * hides. Every route to an identity change, the window's switch, the picker, ⌘J, a link, Back or
 * Forward, hides a side, so a modal never keeps its scroll lock or hides the shown side from
 * assistive technology. The reset happens in the render that hides the side, and Base UI closes
 * the controlled popup in the same commit. The rest of the side keeps its state.
 *
 * A hidden side reads `closed` whatever the setter last stored, and the stored value resets again
 * when the side shows. Base UI opens a pressed trigger's popup a frame after the press, so a flip
 * in that frame would otherwise open the popup on the side it just hid.
 *
 * @template T - The overlay's open state, such as a boolean or a nav panel's value.
 * @param closed - The value that closes the overlay; also the initial value.
 * @returns The current value and its setter, as `useState` returns them.
 */
export function useSideOverlay<T>(closed: T): readonly [T, Dispatch<SetStateAction<T>>] {
  const shown = useSideShown();
  const [value, setValue] = useState(closed);
  const [wasShown, setWasShown] = useState(shown);
  if (wasShown !== shown) {
    setWasShown(shown);
    setValue(closed);
  }
  return [shown ? value : closed, setValue] as const;
}
