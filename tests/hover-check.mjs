// Verifica visualmente el hover del boton detener (captura offscreen).
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

const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'spinup-hover-'));
const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), 'spinup-hoverfx-'));
const fixtureDir = path.join(fixtureRoot, 'demo');
mkdirSync(fixtureDir);
writeFileSync(
  path.join(fixtureDir, 'server.mjs'),
  `import net from 'node:net';
const server = net.createServer((s) => { s.on('error', () => {}); s.end('ok\\n'); });
server.listen(${PORT}, '127.0.0.1', () => console.log('listening'));
setInterval(() => {}, 1000);
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
  await win.click('[data-testid="btn-add-project"]');
  await win.fill('[data-testid="input-name"]', 'Demo');
  await win.fill('[data-testid="input-path"]', fixtureDir);
  await win.click('[data-testid="command-select"]');
  await win.fill('[data-testid="command-search"]', 'node server.mjs');
  await win.keyboard.press('Enter');
  await win.fill('[data-testid="input-port"]', String(PORT));
  await win.click('[data-testid="btn-save"]');

  const card = win.locator('[data-testid^="project-card-"]');
  await card.locator('[data-testid="btn-play"]').click();
  await card.locator('[data-testid="status-chip"][data-status="running"]').waitFor({ timeout: 15000 });

  await card.locator('[data-testid="btn-stop"]').hover();
  await new Promise((r) => setTimeout(r, 300));
  await win.screenshot({ path: path.join(outDir, 'hover-stop.png') });

  await card.locator('[data-testid="btn-stop"]').click();
  await card.locator('[data-testid="status-chip"][data-status="stopped"]').waitFor({ timeout: 15000 });
  console.log('Captura en tests/shots/hover-stop.png');
} finally {
  await app.close().catch(() => {});
  rmSync(userDataDir, { recursive: true, force: true });
  rmSync(fixtureRoot, { recursive: true, force: true });
}
