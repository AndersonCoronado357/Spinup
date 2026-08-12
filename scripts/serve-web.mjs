// Sirve la pagina de descarga en localhost para verla en el navegador.
// Uso: node scripts/serve-web.mjs   ->   http://localhost:8890
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:\\Users\\ac357\\Desktop\\Spinup-web';
const PORT = 8890;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.yml': 'text/yaml; charset=utf-8',
  '.exe': 'application/octet-stream',
  '.blockmap': 'application/octet-stream',
};

http
  .createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }
    if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404');
      return;
    }
    const ext = path.extname(file);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (p.startsWith('/descargas/') && ext === '.exe') {
      headers['Content-Disposition'] = 'attachment';
    }
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`Spinup web en http://localhost:${PORT}`);
  });
