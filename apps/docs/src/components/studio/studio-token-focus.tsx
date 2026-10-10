"use client";

import { createContext, use, useCallback, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import type { ArtboardScheme } from "../../lib/studio/documents";
import type { TokenName } from "../../lib/studio/tokens";

/** A request to show one token's knob: each call is a new request, even for the same token. */
export type TokenFocusRequest = {
  readonly name: TokenName;
  readonly scheme: ArtboardScheme;
  readonly serial: number;
};

type TokenFocusValue = {
  /** The latest request while no visible token panel has answered it. */
  request: TokenFocusRequest | undefined;
  /** Opens `name`'s section in the inspector, edits `scheme`, and focuses the token's knob. */
  focusToken: (name: TokenName, scheme: ArtboardScheme) => void;
  /** Settles request `serial` once a visible panel has focused its knob. */
  answer: (serial: number) => void;
};

const TokenFocusContext = createContext<TokenFocusValue | undefined>(undefined);

/**
 * Carries a canvas click on a token, such as a role tile on the Color page, to the inspector's
 * token panel, which opens the token's section and focuses its knob. The request stays open
 * until a panel the visitor can see answers it: the desktop panel, hidden on a phone, leaves it
 * to the panel in the inspector Sheet, which the shell opens for it.
 */
export function TokenFocusProvider({ children }: { children: ReactNode }): ReactElement {
  const [request, setRequest] = useState<TokenFocusRequest | undefined>(undefined);
  const serial = useRef(0);
  const focusToken = useCallback((name: TokenName, scheme: ArtboardScheme) => {
    serial.current += 1;
    setRequest({ name, scheme, serial: serial.current });
  }, []);
  const answer = useCallback((answered: number) => {
    setRequest((current) => (current?.serial === answered ? undefined : current));
  }, []);
  const value = useMemo(() => ({ request, focusToken, answer }), [request, focusToken, answer]);
  return <TokenFocusContext value={value}>{children}</TokenFocusContext>;
}

export function useTokenFocus(): TokenFocusValue {
  const value = use(TokenFocusContext);
  if (value === undefined) {
    throw new Error("useTokenFocus must be used within TokenFocusProvider");
  }
  return value;
}
