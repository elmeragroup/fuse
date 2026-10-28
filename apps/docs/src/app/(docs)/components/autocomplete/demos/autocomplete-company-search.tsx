"use client";

import { useRef, useState, useTransition } from "react";
import type { FormEvent, ReactNode } from "react";

import { Autocomplete } from "@elmeragroup/fuse/autocomplete";
import { Button } from "@elmeragroup/fuse/button";
import { Field } from "@elmeragroup/fuse/field";
import { SpinnerGap } from "@elmeragroup/fuse/icons";
import { loaderVariants } from "@elmeragroup/fuse/loader";
import { TextField } from "@elmeragroup/fuse/text-field";

type Company = { readonly name: string; readonly orgNumber: string };

const REGISTER: readonly Company[] = [
  { name: "Nordlys Energi AS", orgNumber: "912345670" },
  { name: "Nordlys Eiendom AS", orgNumber: "913456781" },
  { name: "Fjellkraft AS", orgNumber: "998877665" },
  { name: "Fjellkraft Nett AS", orgNumber: "998877666" },
  { name: "Havbris Strøm AS", orgNumber: "987654321" },
  { name: "Kystlys Bakeri AS", orgNumber: "921098765" },
];

const spinner = loaderVariants({ size: "small" }).icon();

/**
 * Stands in for the company register. It answers after `delay` milliseconds, unless the request
 * is aborted first.
 */
function respond<T>(value: T, delay: number, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(value);
    }, delay);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true }
    );
  });
}

/** Matches the query against names and organization numbers, as the register would. */
function searchRegister(query: string, signal: AbortSignal): Promise<readonly Company[]> {
  const needle = query.trim().toLocaleLowerCase("nb-NO");
  const digits = query.replace(/\s/g, "");
  const found = REGISTER.filter(
    (company) =>
      company.name.toLocaleLowerCase("nb-NO").includes(needle) ||
      (/^\d+$/.test(digits) && company.orgNumber.startsWith(digits))
  );
  return respond(found, 400, signal);
}

/** A text field's entry. Both fields submit text; `File` is possible in the type only. */
function textOf(entry: FormDataEntryValue | null): string {
  return entry instanceof File ? "" : (entry ?? "");
}

/**
 * The company name searches the register as the user types. Picking a company fills in its
 * organization number. A company the search does not find is typed in full, and its number
 * entered by hand.
 */
export function AutocompleteCompanySearch() {
  const [name, setName] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [results, setResults] = useState<readonly Company[]>([]);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const request = useRef<AbortController | null>(null);
  const [submitted, setSubmitted] = useState("");

  function search(next: string) {
    setName(next);
    // Abort the request before, so its results can't replace this one's.
    request.current?.abort();
    request.current = null;
    if (next.trim() === "") {
      setResults([]);
      setFailed(false);
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    startTransition(async () => {
      try {
        const found = await searchRegister(next, controller.signal);
        // React joins state set after an await to the transition only inside startTransition.
        startTransition(() => {
          setResults(found);
          setFailed(false);
        });
      } catch {
        if (!controller.signal.aborted) {
          startTransition(() => {
            setResults([]);
            setFailed(true);
          });
        }
      }
    });
  }

  /** What the popup shows while the list is empty. */
  function emptyState(): ReactNode {
    if (pending) {
      return (
        <>
          <SpinnerGap aria-hidden className={spinner} />
          Searching the register…
        </>
      );
    }
    if (failed) {
      return "The register did not answer. Type the name in full and enter the number below.";
    }
    return "No company found. Type the name in full and enter the number below.";
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitted(`company: ${textOf(data.get("company"))}, orgNumber: ${textOf(data.get("orgNumber"))}`);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm flex w-full flex-col gap-4">
      <Field.Root name="company">
        <Field.Label>Company name</Field.Label>
        <Autocomplete.Root
          id="company"
          items={results}
          filter={null}
          value={name}
          onValueChange={search}
          itemToStringValue={(company) => company.name}>
          <Autocomplete.Input placeholder="Name or organization number…" />
          <Autocomplete.Status>
            {!pending && results.length > 0
              ? `${String(results.length)} ${results.length === 1 ? "company" : "companies"} found`
              : null}
          </Autocomplete.Status>
          <Autocomplete.Content aria-busy={pending || undefined}>
            <Autocomplete.Empty>{emptyState()}</Autocomplete.Empty>
            <Autocomplete.List>
              {(company: Company) => (
                <Autocomplete.Item
                  key={company.orgNumber}
                  value={company}
                  onClick={() => {
                    setOrgNumber(company.orgNumber);
                  }}>
                  <span className="flex flex-col">
                    <span>{company.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Org. no. {company.orgNumber}
                    </span>
                  </span>
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Content>
        </Autocomplete.Root>
      </Field.Root>
      <TextField
        name="orgNumber"
        label="Organization number"
        description="Filled in when you pick a company."
        filter="numeric"
        maxLength={9}
        value={orgNumber}
        onChange={setOrgNumber}
      />
      <Button type="submit" className="self-start">
        Continue
      </Button>
      <p role="status" className="text-sm text-muted-foreground">
        {submitted === "" ? "Nothing submitted yet." : `Submitted ${submitted}`}
      </p>
    </form>
  );
}
