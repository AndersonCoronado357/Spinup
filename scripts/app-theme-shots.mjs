// Captura la app en tema oscuro y claro y mide el contraste AA de textos clave.
import { _electron } from 'playwright-core';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const OUT = path.join(process.cwd(), 'tests', 'shots');
mkdirSync(OUT, { recursive: true });

function isFree(port) {
  return new Promise((res) => {
    const s = net.createServer();
    s.once('error', () => res(false));
    s.once('listening', () => s.close(() => res(true)));
    s.listen(port, '0.0.0.0');
  });
}
let PORT = 0;
for (const c of [5188, 5189, 5321, 4319, 6120]) {
  if (await isFree(c)) {
    PORT = c;
    break;
  }
}

const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'spinup-theme-'));
const fxRoot = mkdtempSync(path.join(os.tmpdir(), 'spinup-themefx-'));
const fxDir = path.join(fxRoot, 'facturacion api');
mkdirSync(fxDir);
writeFileSync(
  path.join(fxDir, 'dev.mjs'),
  `import net from 'node:net';
const p = ${PORT};
const s = net.createServer((c)=>{c.on('error',()=>{});c.end('ok');});
s.listen(p,'0.0.0.0',()=>{console.log('Local: http://localhost:'+p+'/');});
setInterval(()=>console.log('GET /api/facturas 200 en 9ms'), 700);
`,
);

const CONTRAST = `(() => {
  const lum=(r,g,b)=>{const a=[r,g,b].map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2]};
  const parse=c=>(c.match(/\\d+(\\.\\d+)?/g)||[]).map(Number);
  const bgOf=el=>{let n=el;while(n){const p=parse(getComputedStyle(n).backgroundColor);if(p.length>=3&&!(p.length===4&&p[3]===0))return p;n=n.parentElement;}return [12,11,16]};
  const R=(el)=>{const f=parse(getComputedStyle(el).color),b=bgOf(el);const l1=lum(f[0],f[1],f[2]),l2=lum(b[0],b[1],b[2]);return Math.round((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)*100)/100};
  const sels=['.text-sm.font-medium','[data-testid="status-chip"]','[title^="Puerto esperado"]','[data-testid="btn-add-project"]','[data-testid="titlebar-stats"] span','[data-testid="console-output"]'];
  const out=[];
  document.querySelectorAll('[title^="Comando"]').forEach(()=>{});
  sels.forEach(s=>{const el=document.querySelector(s); if(el) out.push({s, r:R(el)});});
  return out;
})()`;

const app = await _electron.launch({
  executablePath: electronPath,
  args: ['.'],
  cwd: process.cwd(),
  env: { ...process.env, SPINUP_USER_DATA: userDataDir, SPINUP_OFFSCREEN: '1' },
});

async function shoot(name) {
  const win = await app.firstWindow();
  const dataUrl = await app.evaluate(async ({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    const img = await w.webContents.capturePage();
    return img.toDataURL();
  });
  writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
  return win;
}

try {
  const win = await app.firstWindow();
  await win.waitForSelector('[data-testid="empty-state"]', { timeout: 20000 });
  for (const p of [
    { name: 'API de facturación', path: fxDir, command: 'node dev.mjs', port: PORT },
    { name: 'Panel de administración', path: 'C:\\dev\\panel-admin', command: 'npm run dev', port: 5173 },
    { name: 'Worker de notificaciones', path: 'C:\\dev\\worker-correos', command: 'node worker.js', port: 6020 },
  ]) {
    await win.evaluate((proj) => window.api.addProject(proj), p);
  }
  await win.reload();
  await win.waitForSelector('[data-testid^="project-card-"]', { timeout: 15000 });
  const card = win.locator('[data-testid^="project-card-"]', { hasText: 'API de facturación' });
  await card.locator('[data-testid="btn-play"]').click();
  await card.locator('[data-testid="status-chip"][data-status="running"]').waitFor({ timeout: 15000 });
  await card.locator('[data-testid="btn-console"]').click();
  await new Promise((r) => setTimeout(r, 1500));

  // Oscuro (pulsando el icono luna)
  await win.click('[data-testid="theme-dark"]');
  await new Promise((r) => setTimeout(r, 450));
  const cDark = await win.evaluate(CONTRAST);
  await shoot('app-oscuro');

  // Claro (pulsando el icono sol)
  await win.click('[data-testid="theme-light"]');
  await new Promise((r) => setTimeout(r, 450));
  const cLight = await win.evaluate(CONTRAST);
  await shoot('app-claro');

  console.log('min oscuro', Math.min(...cDark.map((x) => x.r)), '| min claro', Math.min(...cLight.map((x) => x.r)));
} finally {
  await app.close().catch(() => {});
  rmSync(userDataDir, { recursive: true, force: true });
  rmSync(fxRoot, { recursive: true, force: true });
}
