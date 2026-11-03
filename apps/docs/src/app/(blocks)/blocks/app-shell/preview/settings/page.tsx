import type { ReactElement } from "react";

import type { Metadata } from "next";

import { SettingsPage } from "../../../../../(docs)/blocks/app-shell/demos/settings-page";

export const metadata: Metadata = { title: "Settings" };

export default function Page(): ReactElement {
  return <SettingsPage />;
}
