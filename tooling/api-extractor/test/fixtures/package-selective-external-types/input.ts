import type { PrimitiveProps, SelectedKeySource } from "@fixture/selected/button";
import type { ExtraProps } from "@fixture/selected-extra";
import type { ReactElement } from "react";

export interface WrapperProps extends PrimitiveProps, ExtraProps {
  localLabel: string;
}

export declare function PrimitiveComponent(props: WrapperProps): ReactElement;

export type SelectedMappedUse = import("@fixture/selected/button").SelectedMapped;
export type SelectedKeysUse = keyof SelectedKeySource;
export type { MixedOwner, SelectedOwner } from "@fixture/selected/button";
