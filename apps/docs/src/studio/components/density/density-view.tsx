"use client";

import { createContext, use, useCallback, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import type { DensityRole } from "@elmeragroup/fuse/theme-catalog";

import { keepInspected } from "../../lib/density-parts";
import type { InspectedPart } from "../../lib/density-parts";

type DensityViewValue = {
  /** The measure overlay, shown while on or while Alt is held. */
  measure: boolean;
  setMeasure: (on: boolean) => void;
  /** The role X-ray. */
  xray: boolean;
  setXray: (on: boolean) => void;
  /** The roles the X-ray leaves untinted. */
  hiddenRoles: ReadonlySet<DensityRole>;
  setRoleShown: (role: DensityRole, shown: boolean) => void;
  /** The part last pointed at or focused, for the inspector's text alternative. */
  inspected: InspectedPart | undefined;
  inspect: (part: InspectedPart) => void;
};

/**
 * The roles the X-ray starts without: layout and fixed parts are mostly containers, whose tints
 * would cover the parts that move with density. Their legend chips show them.
 */
const INITIALLY_HIDDEN: ReadonlySet<DensityRole> = new Set(["layout", "fixed"]);

const DensityViewContext = createContext<DensityViewValue | undefined>(undefined);

/**
 * The Density page's view state: its overlays and the part they describe. It sits in the studio
 * layout, because the inspector reads it beside the canvas, and a page switch keeps it.
 */
export function DensityViewProvider({ children }: { children: ReactNode }): ReactElement {
  const [measure, setMeasure] = useState(false);
  const [xray, setXray] = useState(false);
  const [hiddenRoles, setHiddenRoles] = useState<ReadonlySet<DensityRole>>(INITIALLY_HIDDEN);
  const [inspected, setInspected] = useState<InspectedPart | undefined>(undefined);

  const inspect = useCallback((part: InspectedPart) => {
    setInspected((current) => keepInspected(current, part));
  }, []);

  const setRoleShown = useCallback((role: DensityRole, shown: boolean) => {
    setHiddenRoles((current) => {
      const next = new Set(current);
      if (shown) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  }, []);

  const value = useMemo(
    (): DensityViewValue => ({
      measure,
      setMeasure,
      xray,
      setXray,
      hiddenRoles,
      setRoleShown,
      inspected,
      inspect,
    }),
    [measure, xray, hiddenRoles, setRoleShown, inspected, setMeasure, setXray, inspect]
  );

  return <DensityViewContext.Provider value={value}>{children}</DensityViewContext.Provider>;
}

export function useDensityView(): DensityViewValue {
  const value = use(DensityViewContext);
  if (value === undefined) {
    throw new Error("useDensityView must be used within DensityViewProvider");
  }
  return value;
}
