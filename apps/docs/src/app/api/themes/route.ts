import { THEME_CATALOG } from "../../../generated/theme-catalog";

export function GET(): Response {
  return Response.json(THEME_CATALOG);
}
