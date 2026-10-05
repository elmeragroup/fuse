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
 * hides. Every route to a variant change, the window's switch, the picker, ⌘J, a link, Back or
 * Forward, hides a side, so a modal never keeps its scroll lock or hides the shown side from
 * assistive technology. The reset happens in the render that hides the side, and Base UI closes
 * the controlled popup in the same commit. The rest of the side keeps its state.
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
    if (!shown) {
      setValue(closed);
    }
  }
  return [value, setValue] as const;
}

/**
 * A remount key for a part on one side of the hero window that keeps its overlay's open state
 * where `useSideOverlay` cannot reach it. The key changes in the render that hides the side, so a
 * keyed part remounts there: its popup closes and drops any scroll lock, while the part stays in
 * the side's layout through the flip. State the part reads from its owner survives the remount.
 *
 * @returns A number that changes each time the caller's side hides.
 */
export function useSideRemountKey(): number {
  const shown = useSideShown();
  const [hides, setHides] = useState(0);
  const [wasShown, setWasShown] = useState(shown);
  if (wasShown !== shown) {
    setWasShown(shown);
    if (!shown) {
      setHides(hides + 1);
    }
  }
  return hides;
}
