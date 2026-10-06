import { loadElmeraMark } from "../../../og/og-assets";
import { OgCard } from "../../../og/og-card";
import { ogResponse } from "../../../og/og-response";

/** The card reads no query, so `next build` prerenders it; GET handlers otherwise run per request. */
export const dynamic = "force-static";

/** The landing's Open Graph image: the card with no subtitle. */
export async function GET(): Promise<Response> {
  return await ogResponse(<OgCard mark={await loadElmeraMark()} />);
}
