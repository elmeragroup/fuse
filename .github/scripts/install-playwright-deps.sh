#!/usr/bin/env bash
set -euo pipefail

# Installs the system packages Playwright's browsers need, from the restored .deb cache on a
# hit and from the Ubuntu mirror otherwise. After a download it copies the .debs into the
# cache directory and writes `save=true` to GITHUB_OUTPUT, so the workflow saves them.
: "${DEBS:?Set DEBS to the .deb cache directory}"
: "${GITHUB_OUTPUT:?Set GITHUB_OUTPUT}"
cache_hit="${CACHE_HIT:-false}"
playwright="$PWD/packages/fuse/node_modules/.bin/playwright"
# apt's archive directory, where it keeps the .debs it downloads (/var/cache/apt/archives/).
archive=""
eval "$(apt-config shell archive Dir::Cache::archives/d)"
if [[ -z "$archive" ]]; then
  echo "apt-config reported no archive directory." >&2
  exit 1
fi
archive="${archive%/}"
shopt -s nullglob

# Both paths install from apt's own archive directory with --no-download, so the install is
# offline: it needs no index refresh and has no mirror to wait on, and a set apt finds
# incomplete fails here instead of being fetched. apt takes a .deb passed by path from the
# archive as it is; from anywhere else it must fetch the file in, which --no-download refuses.
install_from_archive() {
  local debs=("$archive"/*.deb)
  if ((${#debs[@]} == 0)); then return 0; fi
  sudo apt-get install -y --no-install-recommends --no-download "${debs[@]}"
}

# The mirror is only read here, and only to download: APT_CONFIG makes Playwright's
# `apt-get update && apt-get install` download-only, so stopping it never interrupts dpkg.
# Playwright owns the package list, and apt resolves it against this image. apt's own
# timeout only notices a silent connection, not one trickling at 130 kB/s, so each attempt is
# bounded and retried once: apt keeps the .debs it finished, and a new connection can reach
# a faster backend. `timeout` runs as root because apt does and a user cannot signal it.
download() {
  local config
  config="$(mktemp)"
  echo 'APT::Get::Download-Only "true";' >"$config"
  local attempt
  for attempt in 1 2; do
    if sudo env "PATH=$PATH" "APT_CONFIG=$config" timeout --kill-after=30s 5m \
      "$playwright" install-deps chromium firefox webkit; then
      return 0
    fi
    echo "::warning::Downloading Playwright system packages failed or timed out (attempt $attempt)"
  done
  return 1
}

# The image ships an empty archive (runner-images cleanup.sh runs apt-get clean); cleaning
# again keeps the archive, and so the cache, to this install's .debs.
sudo apt-get clean

if [[ "$cache_hit" == true ]]; then
  sudo cp "$DEBS"/*.deb "$archive"/
  if install_from_archive; then exit 0; fi
  echo "::warning::The cached system packages did not install; downloading them instead"
  sudo apt-get clean
fi

download
install_from_archive

debs=("$archive"/*.deb)
if ((${#debs[@]} == 0)); then
  echo "Every Playwright system package was already installed; there is nothing to cache."
  exit 0
fi
mkdir -p "$DEBS"
cp "${debs[@]}" "$DEBS"/
echo "save=true" >>"$GITHUB_OUTPUT"
