// Local preview server for the chDB-wasm browser shell. Serves web/ as the site
// root and the engine (glue + wasm) from the installed chdb-wasm package under
// /dist, mirroring the deployed layout (index.html + /dist-<hash> as siblings).
// Sets the COOP/COEP headers required for SharedArrayBuffer (wasm threads).
//
//   npm install                      # pull the chdb-wasm engine into node_modules
//   node scripts/serve.mjs [port]    # http  on 0.0.0.0:<port>
//   SSL_CERT=cert.pem SSL_KEY=key.pem node scripts/serve.mjs [port]   # https
//
// SharedArrayBuffer (wasm threads) needs a SECURE CONTEXT: https:// or
// http://localhost. Plain http:// to a remote IP is NOT a secure context, so the
// multi-threaded build will not run there. For external access use HTTPS
// (SSL_CERT/SSL_KEY, a reverse proxy, or a tunnel), or reach it as localhost via
// an SSH port-forward.
import { createServer as createHttp } from 'node:http';
import { createServer as createHttps } from 'node:https';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const WEB = join(root, 'web');
const DIST = join(root, 'node_modules', 'chdb-wasm', 'dist');
const port = Number(process.argv[2] || 8099);
const host = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.map': 'application/json',
};

// /dist/* -> the installed chdb-wasm package; everything else -> web/
// (/ -> web/index.html). Leading separators and `..` segments are stripped so
// the resolved path stays under WEB or DIST.
function resolveFile(urlPath) {
  const clean = normalize(urlPath).replace(/^([/\\]|\.\.[/\\])+/, '');
  if (urlPath === '/' || clean === '') return join(WEB, 'index.html');
  if (clean === 'dist' || clean.startsWith('dist/')) {
    return join(DIST, clean.slice('dist'.length).replace(/^[/\\]/, ''));
  }
  return join(WEB, clean);
}

async function handle(req, res) {
  // Cross-origin isolation: required for SharedArrayBuffer / threads.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = resolveFile(urlPath);
    res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
    // Serve a precompressed sibling (file.br / file.gz) when the client accepts it.
    const accept = String(req.headers['accept-encoding'] || '');
    let served = file;
    if (accept.includes('br') && existsSync(file + '.br')) { served = file + '.br'; res.setHeader('Content-Encoding', 'br'); }
    else if (accept.includes('gzip') && existsSync(file + '.gz')) { served = file + '.gz'; res.setHeader('Content-Encoding', 'gzip'); }
    res.setHeader('Vary', 'Accept-Encoding');
    const body = await readFile(served);
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
}

const useHttps = !!(process.env.SSL_CERT && process.env.SSL_KEY);
const server = useHttps
  ? createHttps({ cert: readFileSync(process.env.SSL_CERT), key: readFileSync(process.env.SSL_KEY) }, handle)
  : createHttp(handle);

server.listen(port, host, () => {
  const scheme = useHttps ? 'https' : 'http';
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  console.log(`chdb-wasm shell (COOP/COEP) listening on ${host}:${port}`);
  console.log(`  local:    ${scheme}://localhost:${port}/`);
  for (const ip of lan) console.log(`  network:  ${scheme}://${ip}:${port}/`);
  if (!existsSync(DIST)) {
    console.log(`  WARNING: ${DIST} not found — run \`npm install\` (or symlink a local chdb-wasm build).`);
  }
  if (!useHttps) {
    console.log('  NOTE: remote http:// is not a secure context -> SharedArrayBuffer/threads');
    console.log('        unavailable. Use HTTPS (SSL_CERT/SSL_KEY) or a localhost tunnel for external access.');
  }
});
