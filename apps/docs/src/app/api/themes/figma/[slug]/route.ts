import { FIGMA_THEME_FILES, FIGMA_THEME_INDEX } from "../../../../../generated/theme-catalog-figma";

export const dynamic = "force-static";

export function generateStaticParams(): readonly { slug: string }[] {
  return FIGMA_THEME_INDEX.files.map((file) => ({ slug: file.slug }));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
): Promise<Response> {
  const { slug } = await context.params;
  const document = Object.hasOwn(FIGMA_THEME_FILES, slug) ? FIGMA_THEME_FILES[slug] : undefined;
  if (document === undefined) {
    return new Response(null, { status: 404 });
  }
  return new Response(JSON.stringify(document), {
    headers: {
      "content-type": "application/design-tokens+json; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}.tokens.json"`,
    },
  });
}
