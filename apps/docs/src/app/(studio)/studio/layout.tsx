import type { ReactElement, ReactNode } from "react";

import { LocaleProvider } from "@elmeragroup/fuse/theme";

import { CornerXrayProvider } from "../../../studio/components/corner-xray";
import { DensityViewProvider } from "../../../studio/components/density/density-view";
import { PartSelectionProvider } from "../../../studio/components/studio-part-selection";
import { StudioShell } from "../../../studio/components/studio-shell";
import { StudioProvider } from "../../../studio/components/studio-state";
import { TokenFocusProvider } from "../../../studio/components/studio-token-focus";
import { ViewportProvider } from "../../../studio/components/studio-viewport";

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
