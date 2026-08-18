import { eslintCompatPlugin } from "@oxlint/plugins";

import enforceVariantStandard from "./rules/enforce-variant-standard.js";
import noInternalDynamicImport from "./rules/no-internal-dynamic-import.js";
import noLocalFocusRing from "./rules/no-local-focus-ring.js";
import noPrimitiveColors from "./rules/no-primitive-colors.js";
import noTailwindDarkVariant from "./rules/no-tailwind-dark-variant.js";
import requireIconButtonLabel from "./rules/require-icon-button-label.js";
import restrictProcessEnv from "./rules/restrict-process-env.js";

export default eslintCompatPlugin({
  meta: {
    name: "elmera",
  },
  rules: {
    "enforce-variant-standard": enforceVariantStandard,
    "no-internal-dynamic-import": noInternalDynamicImport,
    "no-local-focus-ring": noLocalFocusRing,
    "no-primitive-colors": noPrimitiveColors,
    "no-tailwind-dark-variant": noTailwindDarkVariant,
    "require-icon-button-label": requireIconButtonLabel,
    "restrict-process-env": restrictProcessEnv,
  },
});
