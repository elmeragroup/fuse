---
id: 004
title: Brand–segment matrix gaps
type: grilling
status: open
assignee: null
blocked-by: [001, 003]
---

## Question

For every one of the 16 theme permutations, what are the **final token values** — and for the permutations that don't exist in the reference code, what is the policy?

Decisions to make (with the extraction matrix from *Token value extraction* in hand and the contract from *Canonical token contract* fixed):

1. Fallback/aliasing policy: does `external-tkas-company` share values with `external-tkas-private` until design provides a distinct palette? Expressed how (same file, CSS aliasing, generator-level inheritance)?
2. Pinned brands: `fkab` = company-only, `fkse` = private-only — does the system hard-error on invalid permutations (`external-fkab-private`) or silently coerce?
3. `fkab` external palette does not exist anywhere — source real values (design team?) or launch aliased to `fkas`?
4. `fkse`/Telinet: confirm palette and naming (code `fkse`, renders Telinet).
5. Internal themes: exact brand-accent values per brand on the grayscale base (`--brand-*` vars exist internally today).
6. Value-level output: the API-complete spec requires the full value table per theme — produce it.
