import type { ReactElement, ReactNode } from "react";

import { AppShell } from "../../../../(docs)/blocks/app-shell/demos/app-shell";

export type AppShellPreviewLayoutProps = {
  children: ReactNode;
};

/** The app shell block's layout: in your app, the layout that wraps every page of the app. */
export default function AppShellPreviewLayout({ children }: AppShellPreviewLayoutProps): ReactElement {
  return <AppShell>{children}</AppShell>;
}
