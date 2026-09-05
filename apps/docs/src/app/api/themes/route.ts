import { THEME_CATALOG } from "../../../generated/theme-catalog";

export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(THEME_CATALOG);
}
