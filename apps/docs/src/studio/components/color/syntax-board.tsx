import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Text } from "@elmeragroup/fuse/text";

import { DocsCodeBlock } from "../../../components/docs-code-block";
import { sectionTokens } from "../../lib/tokens";

const syntaxBoard = tv({
  slots: {
    root: "flex flex-col gap-4 p-8",
    code: "rounded-lg border",
    legend: "m-0 grid list-none grid-cols-3 gap-2 p-0",
    // Text sets relaxed leading; the entry keeps its size's own.
    entry: "font-mono leading-(--text-xs--line-height)",
  },
  variants: {
    token: {
      "sh-identifier": { entry: "text-sh-identifier" },
      "sh-keyword": { entry: "text-sh-keyword" },
      "sh-string": { entry: "text-sh-string" },
      "sh-class": { entry: "text-sh-class" },
      "sh-property": { entry: "text-sh-property" },
      "sh-entity": { entry: "text-sh-entity" },
      "sh-jsxliterals": { entry: "text-sh-jsxliterals" },
      "sh-sign": { entry: "text-sh-sign" },
      "sh-comment": { entry: "text-sh-comment" },
    },
  },
});

const styles = syntaxBoard();

type SyntaxToken = keyof typeof syntaxBoard.variants.token;

function isSyntaxToken(name: string): name is SyntaxToken {
  return Object.hasOwn(syntaxBoard.variants.token, name);
}

/** The contract's syntax roles, in its order. */
const SYNTAX_TOKENS = sectionTokens("syntax").filter(isSyntaxToken);

/** A sample that reaches every `--sh-*` role the highlighter paints. */
const SAMPLE = `import { Button } from "@elmeragroup/fuse/button";

// Shows the total once the meter has a reading.
export function Total({ reading }: { reading?: number }) {
  const label = reading === undefined ? "No reading" : \`\${reading} kWh\`;
  return (
    <Button variant="outline" onClick={() => console.log(label)}>
      Total: {label}
    </Button>
  );
}`;

/**
 * A code sample highlighted with the `--sh-*` roles, and a legend naming each one in its color.
 * The docs' highlighter runs here on the server; this module stays out of the client graph
 * (`test/client-graph.test.ts`), so the page hands the highlighted markup down.
 */
export function SyntaxBoard(): ReactElement {
  return (
    <div className={styles.root()}>
      <DocsCodeBlock source={SAMPLE} variant="embedded" className={styles.code()} />
      <ul className={styles.legend()} aria-label="Syntax roles">
        {SYNTAX_TOKENS.map((token) => (
          <Text key={token} elementType="li" size="xs" className={styles.entry({ token })}>
            {`--${token}`}
          </Text>
        ))}
      </ul>
    </div>
  );
}
