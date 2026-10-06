import type { BrandCode } from "@elmeragroup/fuse/theme";

import type { Site } from "./site-model";
import { ELMERA_GROUP_SITE } from "./sites/elmera-group";
import { FJORDKRAFT_SITE } from "./sites/fjordkraft";
import { FJORDKRAFT_FORETAG_SITE } from "./sites/fjordkraft-foretag";
import { GUDBRANDSDAL_ENERGI_SITE } from "./sites/gudbrandsdal-energi";
import { NORDIC_GREEN_ENERGY_SITE } from "./sites/nordic-green-energy";
import { TELINET_SITE } from "./sites/telinet";
import { TRONDELAGKRAFT_SITE } from "./sites/trondelagkraft";

/** Every brand's site, so the External side has one for whichever brand the landing picks. */
export const SITES = {
  elma: ELMERA_GROUP_SITE,
  fkas: FJORDKRAFT_SITE,
  tkas: TRONDELAGKRAFT_SITE,
  guen: GUDBRANDSDAL_ENERGI_SITE,
  fkse: TELINET_SITE,
  fkab: FJORDKRAFT_FORETAG_SITE,
  ngfi: NORDIC_GREEN_ENERGY_SITE,
} as const satisfies { readonly [Brand in BrandCode]: Site & { readonly brand: Brand } };
