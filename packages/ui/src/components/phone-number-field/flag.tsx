import { flagAssets } from "../../flags";
import type { PhoneCountryCode } from "./phone-engine";

export type FlagProps = {
  country: PhoneCountryCode;
};

/**
 * Decorative packaged-flag slot. Accepts only codes that exist in both
 * libphonenumber and `flagAssets` (phone-number-field.md §8.10, architecture.md §6a).
 */
export function Flag({ country }: FlagProps) {
  return (
    <span className="inline-flex h-[15px] w-5 shrink-0 items-center">
      <img
        src={flagAssets[country]}
        alt=""
        aria-hidden="true"
        width={20}
        height={15}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="block h-auto w-full"
      />
    </span>
  );
}

Flag.displayName = "Flag";
