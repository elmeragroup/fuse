import { loadElmeraMark } from "../../../og/og-assets";
import { OgCard } from "../../../og/og-card";
import { ogResponse } from "../../../og/og-response";

/**
 * The landing's Open Graph image: the card with no subtitle. It reads nothing from the request, so
 * `next build` prerenders it.
 */
export function GET(): Response {
  return ogResponse(<OgCard mark={loadElmeraMark()} />);
}
