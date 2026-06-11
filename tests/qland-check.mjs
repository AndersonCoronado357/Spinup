// Verificacion con el proyecto real Qland: "pnpm dev" + puerto 5180 debe
// salir OBLIGATORIAMENTE en 5180 gracias a la deteccion automatica de vite.
import { _electron } from 'playwright-core';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const electronPath = require('electron');

const QLAND_DIR = 'C:\\Users\\ac357\\Desktop\\Qland';
// Puerto libre para la prueba (evita chocar con otros servicios locales, p. ej.
// Dbridge.Relay que ocupa el 5180). Se puede sobrescribir con QLAND_PORT.
const QLAND_PORT = Number(process.env.QLAND_PORT) || 5191;

if (!existsSync(path.join(QLAND_DIR, 'package.json'))) {
  console.error('No se encontro el proyecto Qland en ' + QLAND_DIR);
  process.exit(1);
}

function probe(port, host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host, timeout: 1000 });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

// Vite en Windows puede escuchar solo en ::1: probar ambas familias.
async function checkPort(port) {
  const results = await Promise.all([probe(port, '127.0.0.1'), probe(port, '::1')]);
  return results.some(Boolean);
}

if (await checkPort(QLAND_PORT)) {
  console.error(`El puerto ${QLAND_PORT} ya esta ocupado; libera el puerto y reintenta.`);
  process.exit(1);
}

const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'spinup-qland-'));
const app = await _electron.launch({
  executablePath: electronPath,
  args: ['.'],
  cwd: process.cwd(),
  env: { ...process.env, SPINUP_USER_DATA: userDataDir, SPINUP_HIDDEN: '1' },
});

try {
  const win = await app.firstWindow();
  await win.waitForSelector('[data-testid="empty-state"]', { timeout: 20000 });
  await win.click('[data-testid="btn-add-project"]');
  await win.fill('[data-testid="input-name"]', 'Qland');
  await win.fill('[data-testid="input-path"]', QLAND_DIR);
  await win.click('[data-testid="command-select"]');
  await win.fill('[data-testid="command-search"]', 'pnpm dev');
  await win.keyboard.press('Enter');
  await win.fill('[data-testid="input-port"]', String(QLAND_PORT));
  await win.click('[data-testid="btn-save"]');

  const card = win.locator('[data-testid^="project-card-"]');
  await card.locator('[data-testid="btn-play"]').click();
  await card
    .locator('[data-testid="status-chip"][data-status="running"]')
    .waitFor({ timeout: 30000 });
  console.log('PASS  Qland arranca con "pnpm dev"');

  await card.locator('[data-testid="btn-console"]').click();
  const consoleOutput = card.locator('[data-testid="console-output"]');
  const deadline = Date.now() + 30000;
  let text = '';
  let ready = false;
  while (Date.now() < deadline) {
    text = await consoleOutput.innerText();
    if (text.includes(`localhost:${QLAND_PORT}`)) {
      ready = true;
      break;
    }
    if (text.includes('Error') || text.includes('error')) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log('--- consola ---');
  console.log(text.split('\n').slice(0, 12).join('\n'));
  console.log('---------------');
  if (!ready) {
    throw new Error(`Vite no anuncio localhost:${QLAND_PORT}`);
  }
  console.log(`PASS  Vite anuncia http://localhost:${QLAND_PORT}/ (el puerto definido)`);

  if (!text.includes('vite detectado')) {
    throw new Error('No aparecio el mensaje de deteccion automatica');
  }
  console.log('PASS  Spinup detecto vite y forzo el puerto automaticamente');

  if (!text.includes('--host')) {
    throw new Error('No se inyecto --host para responsive');
  }
  console.log('PASS  Spinup expone el server en la red (--host) para responsive');

  const networkLine = text.split('\n').find((l) => l.includes('Network'));
  console.log('       ' + (networkLine ? networkLine.trim() : '(sin linea Network)'));

  if (!(await checkPort(QLAND_PORT))) {
    throw new Error(`El puerto ${QLAND_PORT} no responde`);
  }
  console.log(`PASS  http://localhost:${QLAND_PORT}/ responde de verdad`);

  const urlButton = await card.locator('[data-testid="btn-open-url"]').innerText();
  if (!urlButton.includes(`:${QLAND_PORT}`)) {
    throw new Error('El boton de abrir no muestra el puerto definido');
  }
  console.log(`PASS  El boton de abrir apunta a :${QLAND_PORT}`);

  await card.locator('[data-testid="btn-stop"]').click();
  await card
    .locator('[data-testid="status-chip"][data-status="stopped"]')
    .waitFor({ timeout: 20000 });
  const stopDeadline = Date.now() + 15000;
  let closed = false;
  while (Date.now() < stopDeadline) {
    if (!(await checkPort(QLAND_PORT))) {
      closed = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!closed) {
    throw new Error('El puerto sigue abierto tras detener');
  }
  console.log('PASS  Detenido y puerto liberado');
  console.log(`\nQLAND OK — pnpm dev sale obligatoriamente por el puerto ${QLAND_PORT}`);
} catch (error) {
  console.error('FALLO:', error.message);
  process.exitCode = 1;
} finally {
  await app.close().catch(() => {});
  rmSync(userDataDir, { recursive: true, force: true });
}
