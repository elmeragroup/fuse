"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useState } from "react";

/**
 * Base UI removes chips by their committed DOM order. Labels use the same order,
 * registered through refs, without consuming a mutable counter while rendering.
 */
export function createChipIndexRegistry() {
  const elements = new Map<HTMLElement, (index: number) => void>();
  const update = () => {
    const ordered = [...elements.keys()].sort((left, right) =>
      left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );
    ordered.forEach((element, index) => elements.get(element)?.(index));
  };
  return {
    update,
    register(element: HTMLElement, setIndex: (index: number) => void) {
      elements.set(element, setIndex);
      return () => {
        elements.delete(element);
        update();
      };
    },
  };
}

export const ChipIndexContext = createContext<ReturnType<typeof createChipIndexRegistry> | null>(null);

export function useChipIndex() {
  const registry = useContext(ChipIndexContext);
  const [index, setIndex] = useState(-1);
  const ref = useCallback(
    (element: HTMLDivElement | null) => {
      if (element) return registry?.register(element, setIndex);
    },
    [registry]
  );
  // A keyed chip can move without its ref changing. Recompute after each committed
  // render, including an isolated child update; unchanged indices bail out in React.
  useLayoutEffect(() => {
    registry?.update();
  });
  return { ref, index };
}
