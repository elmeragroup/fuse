#!/usr/bin/env bash
set -euo pipefail

# Decides whether the figma-compare job renders: writes `run=true` or `run=false` to
# GITHUB_OUTPUT. It renders on a manual dispatch, when there is no base to compare with, and when
# a path in .github/figma-compare-inputs.txt changed between BASE_SHA and HEAD. BASE_SHA is a
# pull request's base commit or the commit a push to main started from. A base this checkout
# lacks is fetched alone; a base that cannot be fetched, such as one a force push dropped,
# renders rather than guesses.
: "${GITHUB_OUTPUT:?Set GITHUB_OUTPUT}"
event="${EVENT_NAME:-}"
base="${BASE_SHA:-}"

decide() {
  echo "run=$1" >>"$GITHUB_OUTPUT"
  echo "$2"
  exit 0
}

if [[ "$event" == workflow_dispatch ]]; then decide true "A manual run always renders."; fi
if [[ -z "$base" || "$base" =~ ^0+$ ]]; then decide true "No base commit to compare with, so the job renders."; fi
if ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  git fetch --no-tags --depth=1 origin "$base" || decide true "Could not fetch base $base, so the job renders."
fi

pathspecs=()
while IFS= read -r line; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  pathspecs+=("$line")
done <.github/figma-compare-inputs.txt

changed="$(git diff --name-only "$base" HEAD -- "${pathspecs[@]}")"
if [[ -z "$changed" ]]; then
  decide false "Nothing the self-check reads changed since $base, so the job skips the render."
fi
decide true "The self-check's inputs changed since $base:
$changed"
