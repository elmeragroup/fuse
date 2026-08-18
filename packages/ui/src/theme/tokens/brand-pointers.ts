import type { TokenContract } from "./contract";
import type { BrandCode } from "./themes";

export type BrandPointer = Pick<TokenContract, "brand" | "brand-foreground">;

export function brandPointer(code: BrandCode): BrandPointer {
  return {
    brand: `var(--brand-${code})`,
    "brand-foreground": `var(--brand-${code}-foreground)`,
  };
}

export const BRAND_POINTERS = {
  fkas: brandPointer("fkas"),
  tkas: brandPointer("tkas"),
  guen: brandPointer("guen"),
  fkab: brandPointer("fkab"),
  fkse: brandPointer("fkse"),
} as const satisfies Record<BrandCode, BrandPointer>;
