import type { ReactElement } from "react";

import { AdminTableScreen } from "../../../../components/studio/screens/admin-table-screen";
import { CheckoutScreen } from "../../../../components/studio/screens/checkout-screen";
import { SelfServiceScreen } from "../../../../components/studio/screens/self-service-screen";
import { SettingsScreen } from "../../../../components/studio/screens/settings-screen";
import { StudioArtboard } from "../../../../components/studio/studio-artboard";
import { studioPageMetadata } from "../../../../components/studio/studio-metadata";

export const metadata = studioPageMetadata("/studio/screens");

/**
 * The studio's Screens page: whole product screens, each in the variant it pins, so the base
 * brand's external and internal looks sit side by side under every edit.
 */
export default function StudioScreensPage(): ReactElement {
  return (
    <>
      <StudioArtboard id="screen-self-service">
        <SelfServiceScreen />
      </StudioArtboard>
      <StudioArtboard id="screen-admin-table">
        <AdminTableScreen />
      </StudioArtboard>
      <StudioArtboard id="screen-checkout">
        <CheckoutScreen />
      </StudioArtboard>
      <StudioArtboard id="screen-settings">
        <SettingsScreen />
      </StudioArtboard>
    </>
  );
}
