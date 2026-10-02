import type { TokenContract } from "./contract";
import type { BrandCode } from "./themes";

export type BrandPointer = Pick<TokenContract, "brand" | "brand-foreground">;

export function brandPointer(code: BrandCode): BrandPointer {
  return {
    brand: `var(--brand-${code})`,
    "brand-foreground": `var(--brand-${code}-foreground)`,
  };
}
