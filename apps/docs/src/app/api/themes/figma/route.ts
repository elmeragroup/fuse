import { FIGMA_THEME_INDEX } from "../../../../generated/theme-catalog-figma";

export function GET(): Response {
  return Response.json(FIGMA_THEME_INDEX);
}
