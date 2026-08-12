// Verifica el canal de actualizaciones contra un servidor local que sirve la
// carpeta descargas/ (misma estructura que la pagina publicada). Finge una
// version instalada anterior y confirma que electron-updater encuentra la nueva
// y que el sha512 del latest.yml coincide con el del instalador real.
'use strict';
const { app } = require('electron');
const { autoUpdater } = require('electron-updater');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DESC = 'C:\\Users\\ac357\\Desktop\\Spinup-web\\descargas';
const OUT = path.join(__dirname, '..', 'build', 'updater-result.txt');

const server = http.createServer((req, res) => {
  const file = path.join(DESC, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(DESC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end('404');
    return;
  }
  res.writeHead(200);
  fs.createReadStream(file).pipe(res);
});

function realSha512() {
  const exe = path.join(DESC, 'Spinup-1.0.0.exe');
  return crypto.createHash('sha512').update(fs.readFileSync(exe)).digest('base64');
}

app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  // Contra el servidor ya publicado si se pasa FEED_URL; si no, servidor local.
  let feed = process.env.FEED_URL;
  if (!feed) {
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    feed = `http://127.0.0.1:${server.address().port}/`;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.forceDevUpdateConfig = true; // permitir en modo no empaquetado
  autoUpdater.currentVersion = '0.9.0'; // finge una version anterior instalada
  autoUpdater.setFeedURL({ provider: 'generic', url: feed });

  const lines = [];
  try {
    const r = await autoUpdater.checkForUpdates();
    const info = r && r.updateInfo;
    const announced = info && info.files && info.files[0] ? info.files[0].sha512 : info.sha512;
    const real = realSha512();
    lines.push('feed: ' + feed);
    lines.push('version instalada (fingida): 0.9.0');
    lines.push('version encontrada: ' + (info ? info.version : '(ninguna)'));
    lines.push('sha512 en latest.yml: ' + announced);
    lines.push('sha512 del .exe real: ' + real);
    lines.push('coinciden: ' + (announced === real ? 'SI' : 'NO'));
    lines.push(
      'RESULTADO: ' +
        (info && info.version === '1.0.0' && announced === real ? 'OK' : 'FALLO'),
    );
  } catch (e) {
    lines.push('ERROR: ' + (e && e.message ? e.message : String(e)));
    lines.push('RESULTADO: FALLO');
  }
  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(lines.join('\n'));
  server.close();
  app.exit(0);
});
