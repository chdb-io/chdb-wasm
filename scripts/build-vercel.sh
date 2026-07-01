#!/usr/bin/env bash
# Assemble the Vercel static deploy from the chdb-wasm engine + web/.
#
#   build-vercel.sh [dist-dir] [web-dir] [out-dir]     (defaults shown below)
#
# Vercel runs the install step first (installs `chdb-wasm` from package.json deps), then
# runs this as the buildCommand. The ~100 MB mt .wasm is emitted as a static asset under
# <out>/ and served straight from Vercel's CDN. Vercel has no per-file size limit (unlike
# Cloudflare Pages' 25 MB), so there is no R2 bucket and no streaming Function: the wasm is
# just a same-origin static file, which also satisfies the COOP/COEP cross-origin isolation
# the multi-threaded build needs.
#
# Only the multi-threaded (mt) bundle ships. The page is always cross-origin isolated
# (COOP/COEP in vercel.json), so selectBundle always picks mt; the single-threaded (st)
# fallback would only be used in a non-isolated context (e.g. embedded cross-origin), which
# this standalone site doesn't target — shipping it would just double the deploy for nothing.
#
# The engine dir is content-hashed (dist-<hash>/) so it can be cached immutably: a new
# engine build => new hash => new URL => fresh fetch, with no stale-cache risk. The COOP/COEP
# and Cache-Control headers live in vercel.json.
set -euo pipefail

DIST="${1:-node_modules/chdb-wasm/dist}"
WEB="${2:-web}"
OUT="${3:-out}"
JS="index.js worker.js async.js bindings.js protocol.js status.js platform.js"

# Cache-busting dir name = the installed engine's version. npm versions are immutable, so
# the version fully identifies the engine bytes: a new engine => new version => new dir =>
# fresh fetch, with no stale-cache risk. Computed with node (always present in a Vercel
# build) rather than md5sum, which the build image does not ship.
VER="dist-$(node -pe "JSON.parse(require('fs').readFileSync('$(dirname "$DIST")/package.json','utf8')).version")"

rm -rf "$OUT"
mkdir -p "$OUT/$VER"
for f in $JS; do cp "$DIST/$f" "$OUT/$VER/$f"; done
cp "$DIST/chdb.mjs"  "$OUT/$VER/chdb.mjs"
cp "$DIST/chdb.wasm" "$OUT/$VER/chdb.wasm"

# Point the page at the hashed engine dir (source keeps ./dist).
sed "s#\./dist#./$VER#g" "$WEB/index.html" > "$OUT/index.html"

echo "Built $OUT/ (engine dir: $VER)" >&2
echo "$VER"
