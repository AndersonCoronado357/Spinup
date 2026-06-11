// Captura pantallas de la app real para revision visual de diseno.
import { _electron } from 'playwright-core';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const PORT = 7345;

const outDir = path.join(process.cwd(), 'tests', 'shots');
mkdirSync(outDir, { recursive: true });

const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'spinup-shots-'));
const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), 'spinup-shotsfx-'));
const fixtureDir = path.join(fixtureRoot, 'demo server');
mkdirSync(fixtureDir);
writeFileSync(
  path.join(fixtureDir, 'server.mjs'),
  `import net from 'node:net';
const server = net.createServer((socket) => {
  socket.on('error', () => {});
  socket.end('ok\\n');
});
server.listen(${PORT}, '127.0.0.1', () => console.log('listening on ${PORT}'));
console.log('VITE v6.4.3  ready in 320 ms');
console.log('Local: http://localhost:${PORT}/');
setInterval(() => console.log('GET /api/health 200 in 12ms'), 700);
`,
);

const app = await _electron.launch({
  executablePath: electronPath,
  args: ['.'],
  cwd: process.cwd(),
  env: { ...process.env, SPINUP_USER_DATA: userDataDir, SPINUP_OFFSCREEN: '1' },
});

try {
  const win = await app.firstWindow();
  await win.waitForSelector('[data-testid="empty-state"]', { timeout: 20000 });
  await win.screenshot({ path: path.join(outDir, '1-empty.png') });

  // Modal de alta
  await win.click('[data-testid="btn-add-project"]');
  await win.waitForSelector('[data-testid="project-modal"]');
  await win.fill('[data-testid="input-name"]', 'API Facturas');
  await win.fill('[data-testid="input-path"]', fixtureDir);
  await win.fill('[data-testid="input-port"]', String(PORT));
  await win.click('[data-testid="command-select"]');
  await win.fill('[data-testid="command-search"]', 'node');
  await win.screenshot({ path: path.join(outDir, '2-modal.png') });
  await win.fill('[data-testid="command-search"]', 'node server.mjs');
  await win.keyboard.press('Enter');
  await win.click('[data-testid="btn-save"]');

  // Segundo y tercer proyecto para la lista
  for (const [name, dir, cmd, port] of [
    ['Frontend tienda', 'C:\\dev\\tienda-web', 'npm run dev', '5173'],
    ['Worker colas', 'C:\\dev\\worker', 'node queue.js', '6020'],
  ]) {
    await win.click('[data-testid="btn-add-project"]');
    await win.waitForSelector('[data-testid="project-modal"]');
    await win.fill('[data-testid="input-name"]', name);
    await win.fill('[data-testid="input-path"]', dir);
    await win.click('[data-testid="command-select"]');
    await win.fill('[data-testid="command-search"]', cmd);
    await win.keyboard.press('Enter');
    await win.fill('[data-testid="input-port"]', port);
    await win.click('[data-testid="btn-save"]');
  }
  await win.waitForSelector('[data-testid="project-modal"]', { state: 'detached' });

  // Arranca el primero y deja que la consola se llene
  const card = win.locator('[data-testid^="project-card-"]', { hasText: 'API Facturas' });
  await card.locator('[data-testid="btn-play"]').click();
  await card.locator('[data-testid="status-chip"][data-status="running"]').waitFor({ timeout: 15000 });
  await card.locator('[data-testid="btn-console"]').click();
  await new Promise((r) => setTimeout(r, 2500));
  await win.screenshot({ path: path.join(outDir, '3-running.png') });

  // Menu contextual
  const second = win.locator('[data-testid^="project-card-"]', { hasText: 'Frontend tienda' });
  await second.locator('[data-testid="btn-options"]').click();
  await new Promise((r) => setTimeout(r, 300));
  await win.screenshot({ path: path.join(outDir, '4-menu.png') });

  // Detener para no dejar procesos vivos
  await win.keyboard.press('Escape');
  await card.locator('[data-testid="btn-stop"]').click();
  await card.locator('[data-testid="status-chip"][data-status="stopped"]').waitFor({ timeout: 15000 });

  console.log('Capturas guardadas en tests/shots/');
} finally {
  await app.close().catch(() => {});
  rmSync(userDataDir, { recursive: true, force: true });
  rmSync(fixtureRoot, { recursive: true, force: true });
}
