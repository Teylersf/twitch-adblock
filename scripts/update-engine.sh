#!/usr/bin/env bash
# Pull a newer vaft engine from ryanbr/TwitchAdSolutions into engine/vaft.js.
#
#   scripts/update-engine.sh            # latest commit that touched vaft/vaft.user.js
#   scripts/update-engine.sh <sha>      # a specific commit
#
# Shows the diff summary and asks before replacing anything. After updating,
# click the reload icon on the extension card in chrome://extensions and
# reload your Twitch tabs.
set -euo pipefail

REPO="ryanbr/TwitchAdSolutions"
FILE="vaft/vaft.user.js"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="$DIR/engine/vaft.js"
META="$DIR/engine/engine.json"

if [[ $# -ge 1 ]]; then
  SHA="$1"
else
  SHA="$(curl -sfL "https://api.github.com/repos/$REPO/commits?path=$FILE&per_page=1" \
    | grep -m1 '"sha"' | sed -E 's/.*"sha": *"([0-9a-f]{40})".*/\1/')"
fi
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "Could not resolve a commit SHA (got: '$SHA')" >&2; exit 1; }

CURRENT="$(sed -nE 's/.*"commit": *"([0-9a-f]{40})".*/\1/p' "$META")"
if [[ "$SHA" == "$CURRENT" ]]; then
  echo "Already on $SHA"; exit 0
fi

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
curl -sfL "https://raw.githubusercontent.com/$REPO/$SHA/$FILE" -o "$TMP/vaft.js"

VERSION="$(sed -nE 's#^// @version +([^ ]+).*#\1#p' "$TMP/vaft.js" | head -1)"
OLDVER="$(sed -nE 's/.*"version": *"([^"]+)".*/\1/p' "$META")"
echo "Current: $OLDVER ($CURRENT)"
echo "New:     $VERSION ($SHA)"
echo "Changes: https://github.com/$REPO/compare/$CURRENT...$SHA"
diff -u "$ENGINE" "$TMP/vaft.js" | diffstat 2>/dev/null || diff "$ENGINE" "$TMP/vaft.js" | grep -c '^[<>]' | xargs echo "changed lines:"

# Sanity checks: valid JS, still a page-context userscript, no new hosts.
if command -v node >/dev/null; then node --check "$TMP/vaft.js"; fi
grep -q '@grant *none' "$TMP/vaft.js" || { echo "New engine no longer '@grant none' — review by hand." >&2; exit 1; }
NEWHOSTS="$(comm -13 \
  <(grep -oE 'https?://[A-Za-z0-9.-]+' "$ENGINE" | sort -u) \
  <(grep -oE 'https?://[A-Za-z0-9.-]+' "$TMP/vaft.js" | sort -u))"
if [[ -n "$NEWHOSTS" ]]; then
  echo "New hosts referenced by the update (review these):"; echo "$NEWHOSTS"
fi

read -r -p "Replace engine/vaft.js with $VERSION? [y/N] " ok
[[ "$ok" =~ ^[Yy]$ ]] || { echo "Left unchanged."; exit 0; }

cp "$TMP/vaft.js" "$ENGINE"
cat > "$META" <<EOF
{
  "source": "$REPO",
  "path": "$FILE",
  "commit": "$SHA",
  "version": "$VERSION"
}
EOF
echo "Updated. Reload the extension in chrome://extensions, then reload Twitch tabs."
