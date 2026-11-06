import type { BrandCode } from "../theme-input";
import type { TokenContract } from "./contract";

export type BrandPointer = Pick<TokenContract, "brand" | "brand-foreground">;

export function brandPointer(code: BrandCode): BrandPointer {
  return {
    brand: `var(--brand-${code})`,
    "brand-foreground": `var(--brand-${code}-foreground)`,
  };
}
