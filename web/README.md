# chDB-wasm browser shell (Vercel deploy)

A static web page that runs the chDB WebAssembly engine fully in the browser — SQL
executes on the client, with no backend. Hosted on Vercel and served entirely from the
CDN as static assets.

## Files

- `index.html` — the shell page. It references `./dist/...`; the build
  (`scripts/build-vercel.sh`) rewrites `./dist` to a content-hashed `./dist-<hash>/`
  directory so it can be cached forever.

The engine files (the glue JS and the `.wasm`) are NOT committed here. They come from the
`chdb-wasm` npm package and are assembled into the deploy at build time. Only the
multi-threaded (mt) bundle ships — the page is always cross-origin isolated, so the
single-threaded fallback is never requested.

Cross-origin isolation (COOP/COEP) and caching (immutable engine dir + `no-cache` page)
are configured in the repo-root `vercel.json`. Unlike the previous Cloudflare setup, the
wasm is a plain **same-origin static file** — no R2 bucket and no streaming function,
because Vercel has no 25 MB/file limit.

## Deploy

See the repo-root [`README.md`](../README.md) — hosted on Vercel via Git integration.
