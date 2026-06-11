// Smoke test del ejecutable empaquetado (release/win-unpacked/Spinup.exe):
// arranca, crea un proyecto, lo inicia, ve salida en consola y lo detiene.
import { _electron } from 'playwright-core';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const exe = path.join(process.cwd(), 'release', 'win-unpacked', 'Spinup.exe');
if (!existsSync(exe)) {
  console.error('No existe release/win-unpacked/Spinup.exe — ejecuta npm run pack primero');
  process.exit(1);
}

const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'spinup-smoke-'));
const app = await _electron.launch({
  executablePath: exe,
  cwd: process.cwd(),
  env: { ...process.env, SPINUP_USER_DATA: userDataDir, SPINUP_HIDDEN: '1' },
});

try {
  const win = await app.firstWindow();
  await win.waitForSelector('[data-testid="empty-state"]', { timeout: 20000 });
  console.log('PASS  El ejecutable empaquetado arranca y renderiza');

  await win.click('[data-testid="btn-add-project"]');
  await win.fill('[data-testid="input-name"]', 'Smoke');
  await win.fill('[data-testid="input-path"]', 'C:\\Windows\\System32');
  await win.click('[data-testid="command-select"]');
  await win.fill('[data-testid="command-search"]', 'cmd /c echo hola-spinup && ping -n 60 127.0.0.1');
  await win.keyboard.press('Enter');
  await win.fill('[data-testid="input-port"]', '7999');
  await win.click('[data-testid="btn-save"]');
  const card = win.locator('[data-testid^="project-card-"]');
  await card.waitFor({ timeout: 10000 });
  await card.locator('[data-testid="btn-play"]').click();
  await card.locator('[data-testid="status-chip"][data-status="running"]').waitFor({ timeout: 15000 });
  console.log('PASS  El empaquetado inicia procesos');

  await card.locator('[data-testid="btn-console"]').click();
  await card.locator('[data-testid="console-output"]').waitFor({ timeout: 5000 });

  const deadline = Date.now() + 10000;
  let ok = false;
  while (Date.now() < deadline) {
    const text = await card.locator('[data-testid="console-output"]').innerText();
    if (text.includes('hola-spinup')) {
      ok = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ok) throw new Error('No aparecio la salida del proceso en la consola');
  console.log('PASS  La consola del empaquetado muestra stdout');

  await card.locator('[data-testid="btn-stop"]').click();
  await card.locator('[data-testid="status-chip"][data-status="stopped"]').waitFor({ timeout: 15000 });
  console.log('PASS  El empaquetado detiene procesos');
  console.log('SMOKE OK');
} catch (error) {
  console.error('FALLO:', error.message);
  process.exitCode = 1;
} finally {
  await app.close().catch(() => {});
  rmSync(userDataDir, { recursive: true, force: true });
}
