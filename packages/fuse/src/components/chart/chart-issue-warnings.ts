"use client";

/**
 * The warnings of a chart Root: its data rules' production fallbacks and its parts' development
 * hints. Every Root but Gauge's, with its parts and readout, warns through it, so each rule and
 * subject warns once per Root, and a render that repeats a problem stays quiet.
 */
import { useCallback, useEffect, useRef } from "react";

import { issueKey } from "./layout/errors";
import type { IssueRecord, WarnOnce } from "./layout/errors";

/**
 * The Root's `warnOnce`, a stable function for its parts and readout, which warns once per rule and
 * subject. The Root's own data-issue records warn through it after each commit that changes them.
 *
 * @param records - The Root's data-issue records, built in a render memo.
 * @returns The Root's `warnOnce`.
 */
export function useIssueWarnings(records: readonly IssueRecord[]): WarnOnce {
  const warned = useRef(new Set<string>());
  const warnOnce = useCallback<WarnOnce>((rule, subject, message) => {
    const key = issueKey(rule, subject);
    if (warned.current.has(key)) return;
    warned.current.add(key);
    console.warn(message);
  }, []);
  useEffect(() => {
    for (const { rule, subject, message } of records) warnOnce(rule, subject, message);
  }, [records, warnOnce]);
  return warnOnce;
}
