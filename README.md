# chdb-wasm browser shell

The browser SQL shell behind **[wasm.chdb.io](https://wasm.chdb.io)** — chDB (ClickHouse
compiled to WebAssembly) running fully in the browser. SQL executes on the client, with
no backend.

This repo is just the **web page + its Cloudflare deploy**. The engine itself (the
WebAssembly build, the glue JS, and the `.wasm`) lives in the
[`chdb-wasm` npm package](https://www.npmjs.com/package/chdb-wasm) (built from
[`chdb-io/chdb-core`](https://github.com/chdb-io/chdb-core)); this shell only *consumes*
it.

## Layout

- `web/` — the static site: `index.html` (the shell), `_headers` (COOP/COEP + cache
  rules), `_routes.json`, and `functions/[[path]].js` (a Pages Function that streams the
  `.wasm` from R2). See `web/README.md`.
- `scripts/build-cf-bundle.sh` — assembles the Cloudflare deploy bundle (`pages/` +
  `r2/`) from an engine `dist/` and `web/`, content-hashing the engine dir for immutable
  caching.
- `scripts/serve.mjs` — local preview server (sets COOP/COEP).
- `.github/workflows/deploy.yml` — manual-only (`workflow_dispatch`) deploy to Cloudflare.

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

## Deploy

Manual only, via the **Deploy wasm shell to Cloudflare** workflow (Actions → Run
workflow). It pulls a published `chdb-wasm` version from npm, assembles the bundle, puts
the `.wasm` in R2, and deploys the rest to Pages. Inputs: `chdb_wasm_version`,
`pages_project`, `r2_bucket`.

One-time prerequisites (by the Cloudflare account owner):

- Repo secrets `CLOUDFLARE_API_TOKEN` (Cloudflare Pages — Edit, Workers R2 Storage —
  Edit) and `CLOUDFLARE_ACCOUNT_ID`.
- An R2 bucket bound to the Pages project as `WASM_BUCKET`, and the `wasm.chdb.io`
  custom domain.
