// Captura pantallas REALES de la app para la pagina de descarga.
//  - Perfil temporal desechable (jamas los datos reales del usuario).
//  - Siembra proyectos de ejemplo por los canales IPC de verdad (español + tildes).
//  - Un proyecto corriendo de verdad (fixture que emite salida de dev server).
//  - Captura a 1440x900 con deviceScaleFactor 2 (emulacion CDP) via capturePage.
//  - Guarda PNG crudos en Spinup-web/assets/raw/. La conversion a WebP va aparte.
import { _electron } from 'playwright-core';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const electronPath = require('electron');

const WEB = 'C:\\Users\\ac357\\Desktop\\Spinup-web';
const RAW = path.join(WEB, 'assets', 'raw');
mkdirSync(RAW, { recursive: true });

// Puerto libre de aspecto de dev (evita chocar con servicios locales como Dbridge).
function isFree(port) {
  return new Promise((res) => {
    const s = net.createServer();
    s.once('error', () => res(false));
    s.once('listening', () => s.close(() => res(true)));
    s.listen(port, '0.0.0.0');
  });
}
let PORT = 0;
for (const cand of [5188, 5189, 5177, 5178, 5321, 4319]) {
  if (await isFree(cand)) {
    PORT = cand;
    break;
  }
}
if (!PORT) {
  PORT = 5399;
}
const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'spinup-web-'));
const fxRoot = mkdtempSync(path.join(os.tmpdir(), 'spinup-webfx-'));
const fxDir = path.join(fxRoot, 'facturacion api');
mkdirSync(fxDir);
writeFileSync(
  path.join(fxDir, 'dev.mjs'),
  `import net from 'node:net';
const port = Number(process.argv[process.argv.indexOf('--port') + 1]) || ${PORT};
const server = net.createServer((s) => { s.on('error', () => {}); s.end('ok\\n'); });
server.listen(port, '0.0.0.0', () => {
  console.log('VITE v7.3.5  listo en 512 ms');
  console.log('  Local:   http://localhost:' + port + '/');
  console.log('  Network: http://192.168.1.4:' + port + '/');
});
let n = 0;
setInterval(() => { const rutas = ['/api/facturas','/api/clientes','/api/salud']; console.log('GET ' + rutas[n++ % 3] + ' 200 en ' + (8 + (n % 7)) + 'ms'); }, 650);
`,
);

const app = await _electron.launch({
  executablePath: electronPath,
  args: ['.'],
  cwd: process.cwd(),
  env: { ...process.env, SPINUP_USER_DATA: userDataDir, SPINUP_OFFSCREEN: '1' },
});

// Captura la ventana a 1440x900 con deviceScaleFactor 2 (2880x1800 reales) via
// CDP Page.captureScreenshot, que si respeta el DPR emulado.
async function shoot(name) {
  const dataUrl = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setContentSize(1440, 900);
    const dbg = win.webContents.debugger;
    try {
      if (!dbg.isAttached()) dbg.attach('1.3');
    } catch {
      /* ya adjunto */
    }
    await dbg.sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await new Promise((r) => setTimeout(r, 500));
    const res = await dbg.sendCommand('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await dbg.sendCommand('Emulation.clearDeviceMetricsOverride');
    return res.data;
  });
  const buf = Buffer.from(dataUrl, 'base64');
  writeFileSync(path.join(RAW, `${name}.png`), buf);
  return buf.length;
}

try {
  const win = await app.firstWindow();
  await win.waitForSelector('[data-testid="empty-state"]', { timeout: 20000 });

  // Sembrar por IPC de verdad (window.api), textos en español con tildes.
  const seed = [
    { name: 'API de facturación', path: fxDir, command: 'node dev.mjs', port: PORT },
    { name: 'Panel de administración', path: 'C:\\dev\\panel-admin', command: 'npm run dev', port: 5173 },
    { name: 'Worker de notificaciones', path: 'C:\\dev\\worker-correos', command: 'node worker.js', port: 6020 },
  ];
  for (const p of seed) {
    await win.evaluate((proj) => window.api.addProject(proj), p);
  }
  // Recargar para que la UI lea los proyectos sembrados (App los carga al montar).
  await win.reload();
  await win.waitForSelector('[data-testid^="project-card-"]', { timeout: 15000 });

  // Arrancar el primero de verdad y abrir su consola.
  const card = win.locator('[data-testid^="project-card-"]', { hasText: 'API de facturación' });
  await card.locator('[data-testid="btn-play"]').click();
  await card.locator('[data-testid="status-chip"][data-status="running"]').waitFor({ timeout: 15000 });
  await card.locator('[data-testid="btn-console"]').click();
  await card.locator('[data-testid="btn-open-url"]').waitFor({ timeout: 15000 });
  await new Promise((r) => setTimeout(r, 2200));
  const a = await shoot('captura-principal');

  // Segunda toma: modal de alta con el selector de comandos abierto.
  await win.click('[data-testid="btn-add-project"]');
  await win.waitForSelector('[data-testid="project-modal"]');
  await win.fill('[data-testid="input-name"]', 'Tienda en línea');
  await win.fill('[data-testid="input-path"]', 'C:\\dev\\tienda');
  await win.fill('[data-testid="input-port"]', '4321');
  await win.click('[data-testid="command-select"]');
  await win.fill('[data-testid="command-search"]', 'pnpm');
  await new Promise((r) => setTimeout(r, 400));
  const b = await shoot('captura-modal');

  console.log(`PNG crudos: captura-principal (${a} B), captura-modal (${b} B) en assets/raw/`);
} finally {
  await app.close().catch(() => {});
  rmSync(userDataDir, { recursive: true, force: true });
  rmSync(fxRoot, { recursive: true, force: true });
}
