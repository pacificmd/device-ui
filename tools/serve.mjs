// A plain static server over one folder, for `look` on a page of anyone's: no build step, nothing to install.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
};

/** Serves `root` on a free port of localhost, and says where. Nothing outside it is served. */
export function serve(root, port = 0) {
  const top = resolve(root);
  const server = createServer((req, res) => {
    const path = normalize(join(top, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (path !== top && !path.startsWith(top + sep)) return void res.writeHead(403).end();
    let file = path;
    try {
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
      statSync(file);
    } catch {
      return void res.writeHead(404).end();
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  return new Promise(done => server.listen(port, '127.0.0.1', () => done({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}
