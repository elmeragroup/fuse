"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";

/**
 * Ref attachment and chip layout effects are interleaved during a React commit.
 * Collect membership changes first, then order the complete roster in the single
 * subscriber's synchronous follow-up render, before paint.
 */
export function createChipIndexRegistry() {
  const elements = new Map<HTMLElement, (index: number) => void>();
  const listeners = new Set<() => void>();
  let version = 0;
  let orderedVersion = -1;
  const invalidate = () => {
    version += 1;
    listeners.forEach((listener) => listener());
  };
  return {
    getVersion: () => version,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    invalidate,
    reconcile(renderedVersion: number) {
      if (renderedVersion !== version || orderedVersion === version) return;
      orderedVersion = version;
      const ordered = [...elements.keys()].sort((left, right) =>
        left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      );
      ordered.forEach((element, index) => elements.get(element)?.(index));
    },
    register(element: HTMLElement, setIndex: (index: number) => void) {
      elements.set(element, setIndex);
      invalidate();
      return () => {
        elements.delete(element);
        invalidate();
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
  return { ref, index };
}

/** Selection changes also invalidate order when memoized chips skip rendering. */
export function ChipIndexCommit({ selected }: { selected: ReactNode }): null {
  const registry = useContext(ChipIndexContext);
  const [version, setVersion] = useState(0);
  useLayoutEffect(() => {
    if (!registry) return;
    const update = () => setVersion(registry.getVersion());
    const unsubscribe = registry.subscribe(update);
    update();
    return unsubscribe;
  }, [registry]);
  useLayoutEffect(() => {
    registry?.invalidate();
  }, [registry, selected]);
  useLayoutEffect(() => {
    registry?.reconcile(version);
  }, [registry, version]);
  return null;
}
