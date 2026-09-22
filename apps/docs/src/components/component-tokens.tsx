import type { ReactElement } from "react";

import { requireComponent } from "../lib/component-page";
import { TOKENS_SECTION_ID } from "../lib/nav";
import { TokensConsumed } from "./tokens-consumed";

export type ComponentTokensProps = {
  slug: string;
};

/**
 * The generated Tokens-consumed section of a component page.
 * The page names the slug; the token list itself is never hand-authored.
 */
export function ComponentTokens({ slug }: ComponentTokensProps): ReactElement | null {
  const component = requireComponent(slug);
  return <TokensConsumed id={TOKENS_SECTION_ID} tokens={component.tokens} />;
}
