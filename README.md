# chdb-wasm browser shell

The browser SQL shell behind **[wasm.chdb.io](https://wasm.chdb.io)** — chDB (ClickHouse
compiled to WebAssembly) running fully in the browser. SQL executes on the client, with
no backend.

This repo is just the **web page + its Vercel deploy**. The engine itself (the
WebAssembly build, the glue JS, and the `.wasm`) lives in the
[`chdb-wasm` npm package](https://www.npmjs.com/package/chdb-wasm) (built from
[`chdb-io/chdb-core`](https://github.com/chdb-io/chdb-core)); this shell only *consumes*
it.

## Layout

- `web/index.html` — the shell. It references `./dist/...`; the build rewrites `./dist`
  to a content-hashed `./dist-<hash>/` directory so the engine can be cached forever.
- `vercel.json` — deploy config: COOP/COEP cross-origin-isolation headers (needed by the
  multi-threaded build), immutable caching for the hashed engine dir, `no-cache` for the
  page, plus the build command and output directory.
- `scripts/build-vercel.sh` — assembles the deploy output (`out/`) from the installed
  `chdb-wasm` engine + `web/`, content-hashing the engine dir.
- `scripts/serve.mjs` — local preview server (sets COOP/COEP).

## Local preview

```sh
npm install                 # pulls the chdb-wasm engine into node_modules/
npm run serve               # http://localhost:8099  (use localhost for SharedArrayBuffer)
```

`index.html` loads the engine from `./dist`; the preview server maps `/dist/*` to the
installed `chdb-wasm` package. To preview an unpublished local build instead, symlink it:

```sh
mkdir -p node_modules && ln -s /path/to/chdb-core/packages/chdb-wasm node_modules/chdb-wasm
```

## Deploy (Vercel)

Hosted on **Vercel** as a static site — no backend. Everything, including the ~100 MB
`.wasm`, is served as a **same-origin static asset** straight from Vercel's CDN; Vercel has
no per-file size limit, so there is no external object store or streaming function (unlike
the old Cloudflare Pages + R2 setup). Serving the wasm same-origin also satisfies the
COOP/COEP cross-origin isolation the multi-threaded build requires.

Deploys use Vercel's **Git integration**: pushes to `main` publish production, pull
requests get preview URLs. On each build Vercel installs `chdb-wasm` (a dependency), then
runs `scripts/build-vercel.sh` (the `buildCommand` in `vercel.json`) to emit `out/`.

One-time setup (Vercel dashboard, on the **clickhouse** team):

- Import this repo. Framework preset **Other**; the build command and output directory are
  read from `vercel.json` (`bash scripts/build-vercel.sh` → `out/`).
- Add the custom domain **`wasm.chdb.io`** and point its DNS at Vercel.
- Plan: only the multi-threaded (mt) engine ships (~95 MB) — the page is always
  cross-origin isolated, so the single-threaded fallback is never used. That fits Vercel's
  static-upload limit on any plan. Serving the wasm counts toward Fast Data Transfer;
  `immutable` caching means repeat visitors re-use the browser copy.
