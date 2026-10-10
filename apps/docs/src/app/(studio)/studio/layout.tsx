import type { ReactElement, ReactNode } from "react";

import { LocaleProvider } from "@elmeragroup/fuse/theme";

import { CornerXrayProvider } from "../../../components/studio/corner-xray";
import { DensityViewProvider } from "../../../components/studio/density/density-view";
import { PartSelectionProvider } from "../../../components/studio/studio-part-selection";
import { StudioShell } from "../../../components/studio/studio-shell";
import { StudioProvider } from "../../../components/studio/studio-state";
import { TokenFocusProvider } from "../../../components/studio/studio-token-focus";
import { ViewportProvider } from "../../../components/studio/studio-viewport";

export type StudioLayoutProps = {
  children: ReactNode;
};

/**
 * The editor every studio page shares. The state lives here, above the pages, so the base theme
 * and each artboard's settings survive a switch between them.
 */
export default function StudioLayout({ children }: StudioLayoutProps): ReactElement {
  return (
    <StudioProvider>
      <LocaleProvider locale="en-US">
        <ViewportProvider>
          <DensityViewProvider>
            <CornerXrayProvider>
              <TokenFocusProvider>
                <PartSelectionProvider>
                  <StudioShell>{children}</StudioShell>
                </PartSelectionProvider>
              </TokenFocusProvider>
            </CornerXrayProvider>
          </DensityViewProvider>
        </ViewportProvider>
      </LocaleProvider>
    </StudioProvider>
  );
}
