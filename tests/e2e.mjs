// E2E de Spinup: lanza la app Electron real (build de produccion) y verifica
// el ciclo completo: crear (con dropdown de comandos) -> puertos duplicados
// -> iniciar -> consola bajo demanda -> puerto ocupado -> detener -> editar
// -> error -> persistencia -> eliminar. Sale con codigo 1 si algo falla.
import { _electron } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const electronPath = require('electron');

const PORT = 7345;
const BUSY_PORT = 7411;
const ANNOUNCED_PORT = 7456;
const REGISTERED_PORT = 7457;
const ENV_PORT = 7458;
const ARGS_PORT = 7459;
const VITE_PORT = 7460;
const SERVER_ENV_PORT = 7461;
const GRACE_PORT = 7462;
const FOREIGN_PORT = 7463;
const KILL_PORT = 7464;
let passed = 0;

function pass(message) {
  passed++;
  console.log(`  PASS  ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FALLO: ${message}`);
  }
  pass(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, message, timeout = 20000, interval = 250) {
  const deadline = Date.now() + timeout;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      if (await fn()) {
        pass(message);
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(interval);
  }
  throw new Error(`TIMEOUT: ${message}${lastError ? ` (${lastError.message})` : ''}`);
}

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1', timeout: 1000 });
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

// Selector estilo select2: se abre el dropdown y se escribe dentro.
async function setCommand(win, command) {
  await win.click('[data-testid="command-select"]');
  await win.waitForSelector('[data-testid="command-search"]');
  await win.fill('[data-testid="command-search"]', command);
  await win.keyboard.press('Enter');
  await win.waitForSelector('[data-testid="command-presets"]', { state: 'detached' });
}

async function fillProjectModal(win, { name, dir, command, port }) {
  await win.waitForSelector('[data-testid="project-modal"]');
  await win.fill('[data-testid="input-name"]', name);
  await win.fill('[data-testid="input-path"]', dir);
  await setCommand(win, command);
  await win.fill('[data-testid="input-port"]', port);
}

async function deleteProject(win, projectName, { expectConfirm = false } = {}) {
  const target = win.locator('[data-testid^="project-card-"]', { hasText: projectName });
  await target.locator('[data-testid="btn-options"]').click();
  await target.locator('[data-testid="btn-delete"]').click();
  if (expectConfirm) {
    assert(
      (await target.locator('[data-testid="btn-delete"]').innerText()).includes('Confirmar'),
      `Eliminar "${projectName}" pide confirmacion`,
    );
  }
  await target.locator('[data-testid="btn-delete"]').click();
  await target.waitFor({ state: 'detached', timeout: 10000 });
  pass(`"${projectName}" eliminado`);
}

// --- Preparacion: userData aislado y proyecto de prueba con espacio en la ruta ---
const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'spinup-e2e-config-'));
const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), 'spinup-e2e-'));
const fixtureDir = path.join(fixtureRoot, 'demo server');
mkdirSync(fixtureDir);
writeFileSync(
  path.join(fixtureDir, 'server.mjs'),
  `import net from 'node:net';
const port = ${PORT};
const server = net.createServer((socket) => {
  socket.on('error', () => {});
  socket.end('ok\\n');
});
server.listen(port, '127.0.0.1', () => console.log('listening on ' + port));
setInterval(() => console.log('tick ' + Date.now()), 500);
`,
);
// Simula Vite saltando de puerto: anuncia una URL distinta a la registrada.
writeFileSync(
  path.join(fixtureDir, 'announce.mjs'),
  `import net from 'node:net';
const server = net.createServer((socket) => {
  socket.on('error', () => {});
  socket.end('ok\\n');
});
server.listen(${ANNOUNCED_PORT}, '127.0.0.1', () => {
  console.log('Port ${REGISTERED_PORT} is in use, trying another one...');
  console.log('  ->  Local:   http://localhost:${ANNOUNCED_PORT}/');
});
setInterval(() => {}, 1000);
`,
);
// Servidor que obedece la variable de entorno PORT inyectada por Spinup.
writeFileSync(
  path.join(fixtureDir, 'env-port.mjs'),
  `import net from 'node:net';
const port = Number(process.env.PORT);
const server = net.createServer((socket) => {
  socket.on('error', () => {});
  socket.end('ok\\n');
});
server.listen(port, '127.0.0.1', () => {
  console.log('Local: http://localhost:' + port + '/');
});
setInterval(() => {}, 1000);
`,
);
// Servidor que recibe el puerto como argumento (placeholder {port}).
writeFileSync(
  path.join(fixtureDir, 'args-port.mjs'),
  `import net from 'node:net';
const port = Number(process.argv[2]);
const server = net.createServer((socket) => {
  socket.on('error', () => {});
  socket.end('ok\\n');
});
server.listen(port, '127.0.0.1', () => {
  console.log('Local: http://localhost:' + port + '/');
});
setInterval(() => {}, 1000);
`,
);

// Servidor que lee SERVER_PORT (como php artisan serve en Laravel).
writeFileSync(
  path.join(fixtureDir, 'server-port-env.mjs'),
  `import net from 'node:net';
const port = Number(process.env.SERVER_PORT);
const server = net.createServer((socket) => {
  socket.on('error', () => {});
  socket.end('ok\\n');
});
server.listen(port, '127.0.0.1', () => {
  console.log('Server running on [http://127.0.0.1:' + port + ']');
});
setInterval(() => {}, 1000);
`,
);
// Simula "composer run dev" de Laravel: un servidor auxiliar (Vite assets)
// anuncia su URL primero, y la app abre el puerto definido un poco despues.
writeFileSync(
  path.join(fixtureDir, 'multi-url.mjs'),
  `import net from 'node:net';
console.log('  -> Local: http://localhost:${FOREIGN_PORT}/');
setTimeout(() => {
  const server = net.createServer((socket) => {
    socket.on('error', () => {});
    socket.end('ok\\n');
  });
  server.listen(${GRACE_PORT}, '127.0.0.1', () => console.log('app ready'));
}, 1200);
setInterval(() => {}, 1000);
`,
);

// Proyecto que simula el caso real: script "dev": "vite" que ignora PORT y
// arranca en su puerto por defecto salvo que reciba --port. El binario vite
// es un shim local en node_modules/.bin que npm pone en el PATH del script.
const viteDir = path.join(fixtureRoot, 'vite like');
mkdirSync(path.join(viteDir, 'node_modules', '.bin'), { recursive: true });
writeFileSync(
  path.join(viteDir, 'package.json'),
  JSON.stringify({ name: 'fake-vite-app', private: true, scripts: { dev: 'vite' } }, null, 2),
);
writeFileSync(
  path.join(viteDir, 'vite-impl.mjs'),
  `import net from 'node:net';
const portIndex = process.argv.indexOf('--port');
const port = portIndex === -1 ? 5173 : Number(process.argv[portIndex + 1]);
const strict = process.argv.includes('--strictPort');
const host = process.argv.includes('--host');
console.log('FAKE VITE strict=' + strict + ' host=' + host + ' port=' + port);
const server = net.createServer((socket) => {
  socket.on('error', () => {});
  socket.end('ok\\n');
});
server.listen(port, host ? '0.0.0.0' : '127.0.0.1', () => {
  console.log('  -> Local: http://localhost:' + port + '/');
  if (host) console.log('  -> Network: http://192.168.1.50:' + port + '/');
});
setInterval(() => {}, 1000);
`,
);
writeFileSync(
  path.join(viteDir, 'node_modules', '.bin', 'vite.cmd'),
  '@ECHO off\r\nnode "%~dp0..\\..\\vite-impl.mjs" %*\r\n',
);

function launchApp() {
  return _electron.launch({
    executablePath: electronPath,
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, SPINUP_USER_DATA: userDataDir, SPINUP_HIDDEN: '1' },
  });
}

let app = null;
let busyServer = null;
let occupier = null;

try {
  // --- Arranque y estado vacio ---
  console.log('\n[1] Arranque de la app');
  app = await launchApp();
  let win = await app.firstWindow();
  await win.waitForSelector('[data-testid="empty-state"]', { timeout: 20000 });
  pass('La app arranca y muestra el estado vacio');
  assert((await win.title()) === 'Spinup', 'El titulo de la ventana es "Spinup"');
  const apiOk = await win.evaluate(
    () =>
      typeof window.api?.getProjects === 'function' &&
      typeof window.api?.startProject === 'function' &&
      typeof window.api?.selectDirectory === 'function',
  );
  assert(apiOk, 'window.api expuesta via contextBridge');
  const nodeLeak = await win.evaluate(() => typeof window.require !== 'undefined');
  assert(!nodeLeak, 'El renderer no tiene acceso a require (aislamiento correcto)');
  const emptyStats = await win.locator('[data-testid="titlebar-stats"]').innerText();
  assert(
    emptyStats.includes('0 proyectos') && emptyStats.includes('0 corriendo'),
    'La titlebar muestra 0 proyectos y 0 corriendo al inicio',
  );

  // --- Crear proyecto (con dropdown de comandos) ---
  console.log('\n[2] Crear proyecto');
  await win.click('[data-testid="btn-add-project"]');
  await win.waitForSelector('[data-testid="project-modal"]');
  // Validacion: guardar vacio no debe crear nada
  await win.click('[data-testid="btn-save"]');
  assert(
    (await win.locator('[data-testid="project-modal"]').count()) === 1,
    'La validacion impide guardar un formulario vacio',
  );
  // Selector de comandos estilo select2: se escribe dentro del dropdown
  await win.click('[data-testid="command-select"]');
  await win.waitForSelector('[data-testid="command-presets"]');
  const searchFocused = await win.evaluate(
    () => document.activeElement?.dataset?.testid === 'command-search',
  );
  assert(searchFocused, 'Al abrir el selector el buscador interno recibe el foco');
  const presetCount = await win.locator('[data-testid="command-preset"]').count();
  assert(presetCount >= 15, `El selector lista comandos npm/pnpm/yarn/bun/node (${presetCount})`);
  await win.fill('[data-testid="command-search"]', 'pnpm');
  const filteredCount = await win.locator('[data-testid="command-preset"]').count();
  assert(
    filteredCount > 0 && filteredCount < presetCount,
    `Escribir dentro del dropdown filtra los presets (${presetCount} -> ${filteredCount})`,
  );
  await win.locator('[data-testid="command-preset"]', { hasText: 'pnpm dev' }).first().click();
  assert(
    (await win.locator('[data-testid="command-select"]').innerText()).includes('pnpm dev'),
    'Elegir un preset lo deja seleccionado en el selector',
  );
  assert(
    (await win.locator('[data-testid="command-presets"]').count()) === 0,
    'El dropdown se cierra al elegir',
  );
  // Comando libre: escribir algo que no es preset y confirmarlo
  await win.click('[data-testid="command-select"]');
  await win.fill('[data-testid="command-search"]', 'deno task start');
  await win.click('[data-testid="command-custom"]');
  assert(
    (await win.locator('[data-testid="command-select"]').innerText()).includes('deno task start'),
    'El selector acepta comandos personalizados escritos dentro',
  );
  await fillProjectModal(win, {
    name: 'Servidor demo',
    dir: fixtureDir,
    command: 'node server.mjs',
    port: String(PORT),
  });
  await win.click('[data-testid="btn-save"]');
  const card = win.locator('[data-testid^="project-card-"]', { hasText: 'Servidor demo' });
  await card.waitFor({ timeout: 10000 });
  pass('El proyecto aparece en la lista');
  assert((await card.innerText()).includes('node server.mjs'), 'La tarjeta muestra el comando');
  assert((await card.innerText()).includes(`:${PORT}`), 'La tarjeta muestra el puerto');
  await card.locator('[data-testid="status-chip"][data-status="stopped"]').waitFor();
  pass('El proyecto nuevo esta detenido');

  // --- Puerto duplicado rechazado al registrar ---
  console.log('\n[3] Puerto duplicado');
  await win.click('[data-testid="btn-add-project"]');
  await fillProjectModal(win, {
    name: 'Duplicado',
    dir: fixtureDir,
    command: 'node server.mjs',
    port: String(PORT),
  });
  await win.click('[data-testid="btn-save"]');
  await win.waitForSelector('[data-testid="error-port"]');
  assert(
    (await win.locator('[data-testid="error-port"]').innerText()).includes('ya lo usa'),
    'No deja registrar dos proyectos con el mismo puerto',
  );
  await win.click('[data-testid="btn-cancel"]');
  await win.waitForSelector('[data-testid="project-modal"]', { state: 'detached' });

  // --- Iniciar ---
  console.log('\n[4] Iniciar proyecto');
  await card.locator('[data-testid="btn-play"]').click();
  await card
    .locator('[data-testid="status-chip"][data-status="running"]')
    .waitFor({ timeout: 15000 });
  pass('El estado cambia a "Corriendo"');
  const runningStats = await win.locator('[data-testid="titlebar-stats"]').innerText();
  assert(
    runningStats.includes('1 proyecto') && runningStats.includes('1 corriendo'),
    'La titlebar refleja 1 proyecto y 1 corriendo',
  );
  assert(
    (await card.locator('[data-testid="console-output"]').count()) === 0,
    'La consola NO se abre sola al iniciar',
  );
  await card.locator('[data-testid="btn-console"]').click();
  const consoleOutput = card.locator('[data-testid="console-output"]');
  await consoleOutput.waitFor({ timeout: 5000 });
  pass('La consola se abre bajo demanda');
  await waitFor(
    async () => (await consoleOutput.innerText()).includes(`listening on ${PORT}`),
    'La consola muestra stdout del proceso en tiempo real',
  );
  await waitFor(
    async () => (await consoleOutput.innerText()).includes(`Puerto ${PORT} activo`),
    'Spinup detecta el puerto activo',
  );
  await waitFor(() => checkPort(PORT), 'El puerto del servidor responde de verdad');
  await card.locator('[data-testid="btn-open-url"]').waitFor({ timeout: 5000 });
  assert(
    (await card.locator('[data-testid="btn-open-url"]').innerText()).includes(`:${PORT}`),
    'Aparece el boton para abrir el localhost con el puerto detectado',
  );

  // --- Limpiar consola ---
  console.log('\n[5] Limpiar consola');
  await win.click('[data-testid="btn-clear"]');
  await waitFor(
    async () => !(await consoleOutput.innerText()).includes('listening on'),
    'El boton Limpiar vacia la consola',
    5000,
  );
  await waitFor(
    async () => (await consoleOutput.innerText()).includes('tick'),
    'La consola sigue recibiendo salida tras limpiar',
  );

  // --- Detener ---
  console.log('\n[6] Detener proyecto');
  await card.locator('[data-testid="btn-stop"]').click();
  await card
    .locator('[data-testid="status-chip"][data-status="stopped"]')
    .waitFor({ timeout: 15000 });
  pass('El estado vuelve a "Detenido"');
  assert(
    (await card.locator('[data-testid="btn-open-url"]').count()) === 0,
    'El boton de abrir localhost desaparece al detener',
  );
  assert(
    (await win.locator('[data-testid="titlebar-stats"]').innerText()).includes('0 corriendo'),
    'La titlebar vuelve a 0 corriendo al detener',
  );
  await waitFor(
    async () => !(await checkPort(PORT)),
    'taskkill mato el arbol completo: el puerto ya no responde',
    15000,
  );

  // --- Puerto ocupado: no debe iniciar ---
  console.log('\n[7] Puerto ocupado por otro proceso');
  busyServer = net.createServer((socket) => {
    socket.on('error', () => {});
    socket.end();
  });
  await new Promise((resolve) => busyServer.listen(BUSY_PORT, '127.0.0.1', resolve));
  await win.click('[data-testid="btn-add-project"]');
  await fillProjectModal(win, {
    name: 'Puerto ocupado',
    dir: fixtureDir,
    command: 'node server.mjs',
    port: String(BUSY_PORT),
  });
  await win.click('[data-testid="btn-save"]');
  const busyCard = win.locator('[data-testid^="project-card-"]', { hasText: 'Puerto ocupado' });
  await busyCard.waitFor({ timeout: 10000 });
  await busyCard.locator('[data-testid="btn-play"]').click();
  await busyCard
    .locator('[data-testid="status-chip"][data-status="error"]')
    .waitFor({ timeout: 15000 });
  pass('Iniciar con el puerto ocupado termina en estado "Error" sin arrancar');
  await busyCard.locator('[data-testid="btn-console"]').click();
  await waitFor(
    async () =>
      (await busyCard.locator('[data-testid="console-output"]').innerText()).includes('en uso'),
    'La consola explica que el puerto ya esta en uso',
  );
  busyServer.close();
  busyServer = null;
  await deleteProject(win, 'Puerto ocupado');

  // Boton "Liberar puerto": mata el proceso ajeno que ocupa el puerto del
  // proyecto. El ocupante es un proceso externo real (hijo del test).
  occupier = spawn(
    'node',
    [
      '-e',
      `const net=require('net');net.createServer((s)=>{s.on('error',()=>{});s.end('ok')}).listen(${KILL_PORT},'127.0.0.1',()=>console.log('up'));setInterval(()=>{},1000);`,
    ],
    { stdio: 'ignore', windowsHide: true },
  );
  await waitFor(() => checkPort(KILL_PORT), 'Un proceso externo ocupa el puerto del proyecto');
  await win.click('[data-testid="btn-add-project"]');
  await fillProjectModal(win, {
    name: 'Puerto secuestrado',
    dir: fixtureDir,
    command: 'node args-port.mjs {port}',
    port: String(KILL_PORT),
  });
  await win.click('[data-testid="btn-save"]');
  const killCard = win.locator('[data-testid^="project-card-"]', {
    hasText: 'Puerto secuestrado',
  });
  await killCard.waitFor({ timeout: 10000 });
  await killCard.locator('[data-testid="btn-options"]').click();
  const killButton = killCard.locator('[data-testid="btn-kill-port"]');
  await killButton.waitFor({ timeout: 5000 });
  assert(
    (await killButton.innerText()).includes(`:${KILL_PORT}`),
    'El menu ofrece "Liberar puerto" con el puerto del proyecto',
  );
  await killButton.click();
  await killCard.locator('[data-testid="console-output"]').waitFor({ timeout: 5000 });
  pass('La consola se abre para mostrar el resultado de liberar el puerto');
  await waitFor(
    async () =>
      (await killCard.locator('[data-testid="console-output"]').innerText()).includes(
        'Proceso eliminado',
      ),
    'Spinup mata el proceso ocupante e informa cual era',
  );
  await waitFor(
    async () =>
      (await killCard.locator('[data-testid="console-output"]').innerText()).includes(
        `Puerto ${KILL_PORT} libre`,
      ),
    'Spinup confirma que el puerto quedo libre',
  );
  await waitFor(() => checkPort(KILL_PORT).then((r) => !r), 'El puerto realmente ya no responde');
  occupier = null;
  // Y ahora el proyecto puede usar su puerto
  await killCard.locator('[data-testid="btn-play"]').click();
  await killCard
    .locator('[data-testid="status-chip"][data-status="running"]')
    .waitFor({ timeout: 15000 });
  await killCard.locator('[data-testid="btn-open-url"]').waitFor({ timeout: 10000 });
  assert(
    (await killCard.locator('[data-testid="btn-open-url"]').innerText()).includes(`:${KILL_PORT}`),
    'Tras liberar el puerto, el proyecto arranca y lo usa',
  );
  await killCard.locator('[data-testid="btn-stop"]').click();
  await killCard
    .locator('[data-testid="status-chip"][data-status="stopped"]')
    .waitFor({ timeout: 15000 });
  await deleteProject(win, 'Puerto secuestrado');

  // --- Puerto obligatorio: si el proceso sale por otro puerto, se detiene ---
  console.log('\n[8] Puerto obligatorio');
  await win.click('[data-testid="btn-add-project"]');
  await fillProjectModal(win, {
    name: 'Rebelde',
    dir: fixtureDir,
    command: 'node announce.mjs',
    port: String(REGISTERED_PORT),
  });
  await win.click('[data-testid="btn-save"]');
  const rebelCard = win.locator('[data-testid^="project-card-"]', { hasText: 'Rebelde' });
  await rebelCard.waitFor({ timeout: 10000 });
  await rebelCard.locator('[data-testid="btn-play"]').click();
  await rebelCard
    .locator('[data-testid="status-chip"][data-status="error"]')
    .waitFor({ timeout: 20000 });
  pass('Un proceso que sale por otro puerto es detenido y marcado como error');
  assert(
    (await rebelCard.locator('[data-testid="btn-open-url"]').count()) === 0,
    'No se ofrece abrir una URL en el puerto equivocado',
  );
  await rebelCard.locator('[data-testid="btn-console"]').click();
  const rebelConsole = await rebelCard.locator('[data-testid="console-output"]').innerText();
  assert(
    rebelConsole.includes('puerto definido') && rebelConsole.includes('{port}'),
    'La consola explica el conflicto y sugiere {port} / variable PORT',
  );
  await waitFor(
    async () => !(await checkPort(ANNOUNCED_PORT)),
    'El proceso rebelde fue eliminado: su puerto ya no responde',
    15000,
  );
  await deleteProject(win, 'Rebelde');

  // Margen de gracia: una URL auxiliar (Vite assets en "composer run dev")
  // no mata el proceso si el puerto definido responde a tiempo.
  await win.click('[data-testid="btn-add-project"]');
  await fillProjectModal(win, {
    name: 'Composer like',
    dir: fixtureDir,
    command: 'node multi-url.mjs',
    port: String(GRACE_PORT),
  });
  await win.click('[data-testid="btn-save"]');
  const graceCard = win.locator('[data-testid^="project-card-"]', { hasText: 'Composer like' });
  await graceCard.waitFor({ timeout: 10000 });
  await graceCard.locator('[data-testid="btn-play"]').click();
  await graceCard
    .locator('[data-testid="status-chip"][data-status="running"]')
    .waitFor({ timeout: 15000 });
  await graceCard.locator('[data-testid="btn-console"]').click();
  await waitFor(
    async () =>
      (await graceCard.locator('[data-testid="console-output"]').innerText()).includes(
        'Esperando',
      ),
    'Una URL auxiliar ajena no mata el proceso de inmediato (margen de gracia)',
  );
  await graceCard.locator('[data-testid="btn-open-url"]').waitFor({ timeout: 15000 });
  assert(
    (await graceCard.locator('[data-testid="btn-open-url"]').innerText()).includes(
      `:${GRACE_PORT}`,
    ),
    'El puerto definido respondio dentro del margen y queda confirmado',
  );
  await sleep(7000);
  assert(
    (await graceCard.locator('[data-testid="status-chip"]').getAttribute('data-status')) ===
      'running',
    'Pasado el margen el proceso sigue corriendo (sin falso positivo)',
  );
  await graceCard.locator('[data-testid="btn-stop"]').click();
  await graceCard
    .locator('[data-testid="status-chip"][data-status="stopped"]')
    .waitFor({ timeout: 15000 });
  await deleteProject(win, 'Composer like');

  // --- El puerto definido llega al proceso: variable PORT y placeholder {port} ---
  console.log('\n[9] PORT inyectado y placeholder {port}');
  await win.click('[data-testid="btn-add-project"]');
  await fillProjectModal(win, {
    name: 'Via PORT',
    dir: fixtureDir,
    command: 'node env-port.mjs',
    port: String(ENV_PORT),
  });
  await win.click('[data-testid="btn-save"]');
  const envCard = win.locator('[data-testid^="project-card-"]', { hasText: 'Via PORT' });
  await envCard.waitFor({ timeout: 10000 });
  await envCard.locator('[data-testid="btn-play"]').click();
  await envCard
    .locator('[data-testid="status-chip"][data-status="running"]')
    .waitFor({ timeout: 15000 });
  await envCard.locator('[data-testid="btn-open-url"]').waitFor({ timeout: 10000 });
  assert(
    (await envCard.locator('[data-testid="btn-open-url"]').innerText()).includes(`:${ENV_PORT}`),
    'El servidor leyó la variable PORT y corre en el puerto definido',
  );
  await envCard.locator('[data-testid="btn-stop"]').click();
  await envCard
    .locator('[data-testid="status-chip"][data-status="stopped"]')
    .waitFor({ timeout: 15000 });
  await deleteProject(win, 'Via PORT');

  await win.click('[data-testid="btn-add-project"]');
  await fillProjectModal(win, {
    name: 'Via placeholder',
    dir: fixtureDir,
    command: 'node args-port.mjs {port}',
    port: String(ARGS_PORT),
  });
  await win.click('[data-testid="btn-save"]');
  const argsCard = win.locator('[data-testid^="project-card-"]', { hasText: 'Via placeholder' });
  await argsCard.waitFor({ timeout: 10000 });
  await argsCard.locator('[data-testid="btn-play"]').click();
  await argsCard
    .locator('[data-testid="status-chip"][data-status="running"]')
    .waitFor({ timeout: 15000 });
  await argsCard.locator('[data-testid="btn-console"]').click();
  await waitFor(
    async () =>
      (await argsCard.locator('[data-testid="console-output"]').innerText()).includes(
        `args-port.mjs ${ARGS_PORT}`,
      ),
    'El comando se ejecuta con {port} sustituido por el puerto definido',
  );
  await argsCard.locator('[data-testid="btn-open-url"]').waitFor({ timeout: 10000 });
  assert(
    (await argsCard.locator('[data-testid="btn-open-url"]').innerText()).includes(`:${ARGS_PORT}`),
    'El servidor corre en el puerto pasado via {port}',
  );
  await argsCard.locator('[data-testid="btn-stop"]').click();
  await argsCard
    .locator('[data-testid="status-chip"][data-status="stopped"]')
    .waitFor({ timeout: 15000 });
  await deleteProject(win, 'Via placeholder');

  // SERVER_PORT (Laravel): php artisan serve lee el puerto de esta variable
  await win.click('[data-testid="btn-add-project"]');
  await fillProjectModal(win, {
    name: 'Via SERVER_PORT',
    dir: fixtureDir,
    command: 'node server-port-env.mjs',
    port: String(SERVER_ENV_PORT),
  });
  await win.click('[data-testid="btn-save"]');
  const laravelCard = win.locator('[data-testid^="project-card-"]', { hasText: 'Via SERVER_PORT' });
  await laravelCard.waitFor({ timeout: 10000 });
  await laravelCard.locator('[data-testid="btn-play"]').click();
  await laravelCard
    .locator('[data-testid="status-chip"][data-status="running"]')
    .waitFor({ timeout: 15000 });
  await laravelCard.locator('[data-testid="btn-open-url"]').waitFor({ timeout: 10000 });
  assert(
    (await laravelCard.locator('[data-testid="btn-open-url"]').innerText()).includes(
      `:${SERVER_ENV_PORT}`,
    ),
    'El servidor leyo SERVER_PORT (estilo Laravel) y corre en el puerto definido',
  );
  await laravelCard.locator('[data-testid="btn-stop"]').click();
  await laravelCard
    .locator('[data-testid="status-chip"][data-status="stopped"]')
    .waitFor({ timeout: 15000 });
  await deleteProject(win, 'Via SERVER_PORT');

  // --- Deteccion automatica del dev server (caso real: "pnpm dev" -> vite) ---
  console.log('\n[10] Deteccion automatica de vite');
  await win.click('[data-testid="btn-add-project"]');
  await fillProjectModal(win, {
    name: 'Fake Vite',
    dir: viteDir,
    command: 'npm run dev',
    port: String(VITE_PORT),
  });
  await win.click('[data-testid="btn-save"]');
  const viteCard = win.locator('[data-testid^="project-card-"]', { hasText: 'Fake Vite' });
  await viteCard.waitFor({ timeout: 10000 });
  await viteCard.locator('[data-testid="btn-play"]').click();
  await viteCard
    .locator('[data-testid="status-chip"][data-status="running"]')
    .waitFor({ timeout: 20000 });
  await viteCard.locator('[data-testid="btn-console"]').click();
  await waitFor(
    async () =>
      (await viteCard.locator('[data-testid="console-output"]').innerText()).includes(
        'vite detectado',
      ),
    'Spinup resuelve el script de package.json y detecta vite',
  );
  await waitFor(
    async () =>
      (await viteCard.locator('[data-testid="console-output"]').innerText()).includes(
        `strict=true host=true port=${VITE_PORT}`,
      ),
    'El dev server recibe --port, --strictPort y --host automaticamente',
  );
  await waitFor(
    async () =>
      (await viteCard.locator('[data-testid="console-output"]').innerText()).includes(
        'pruebas responsive',
      ),
    'Spinup avisa que el server quedo expuesto en la red (responsive)',
  );
  assert(
    (await viteCard.locator('[data-testid="console-output"]').innerText()).includes(
      `Network: http://192.168.1.50:${VITE_PORT}/`,
    ),
    'El dev server anuncia la URL de red para abrir desde el movil',
  );
  await viteCard.locator('[data-testid="btn-open-url"]').waitFor({ timeout: 10000 });
  assert(
    (await viteCard.locator('[data-testid="btn-open-url"]').innerText()).includes(`:${VITE_PORT}`),
    'El proyecto corre en el puerto definido sin tocar el comando',
  );
  await viteCard.locator('[data-testid="btn-stop"]').click();
  await viteCard
    .locator('[data-testid="status-chip"][data-status="stopped"]')
    .waitFor({ timeout: 15000 });
  await deleteProject(win, 'Fake Vite');

  // --- Editar ---
  console.log('\n[11] Editar proyecto');
  await card.locator('[data-testid="btn-options"]').click();
  await card.locator('[data-testid="btn-edit"]').click();
  await win.waitForSelector('[data-testid="project-modal"]');
  assert(
    (await win.inputValue('[data-testid="input-name"]')) === 'Servidor demo',
    'El modal de edicion precarga los datos',
  );
  await win.fill('[data-testid="input-name"]', 'Servidor demo v2');
  await win.click('[data-testid="btn-save"]');
  await win
    .locator('[data-testid^="project-card-"]', { hasText: 'Servidor demo v2' })
    .waitFor({ timeout: 10000 });
  pass('El nombre editado se refleja en la tarjeta');

  // --- Estado de error ---
  console.log('\n[12] Estado de error');
  await win.click('[data-testid="btn-add-project"]');
  await fillProjectModal(win, {
    name: 'Proyecto roto',
    dir: fixtureDir,
    command: 'node no-existe.js',
    port: '7399',
  });
  await win.click('[data-testid="btn-save"]');
  const brokenCard = win.locator('[data-testid^="project-card-"]', { hasText: 'Proyecto roto' });
  await brokenCard.waitFor({ timeout: 10000 });
  await brokenCard.locator('[data-testid="btn-play"]').click();
  await brokenCard
    .locator('[data-testid="status-chip"][data-status="error"]')
    .waitFor({ timeout: 15000 });
  pass('Un comando que falla termina en estado "Error"');
  await brokenCard.locator('[data-testid="btn-console"]').click();
  await waitFor(
    async () =>
      (await brokenCard.locator('[data-testid="console-output"]').innerText()).includes('Error'),
    'El ultimo error se muestra en la consola',
  );

  // --- Persistencia (reinicio de la app) ---
  console.log('\n[13] Persistencia tras reiniciar');
  await app.close();
  app = await launchApp();
  win = await app.firstWindow();
  const persistedCard = win.locator('[data-testid^="project-card-"]', {
    hasText: 'Servidor demo v2',
  });
  await persistedCard.waitFor({ timeout: 20000 });
  pass('Los proyectos persisten en electron-store tras reiniciar');
  await persistedCard.locator('[data-testid="status-chip"][data-status="stopped"]').waitFor();
  pass('Tras reiniciar todo arranca detenido (sin auto-start)');

  // --- Eliminar (con confirmacion en dos pasos) ---
  console.log('\n[14] Eliminar proyectos');
  await deleteProject(win, 'Servidor demo v2', { expectConfirm: true });
  await deleteProject(win, 'Proyecto roto', { expectConfirm: true });
  await win.waitForSelector('[data-testid="empty-state"]', { timeout: 10000 });
  pass('Al eliminar todo vuelve el estado vacio');

  await app.close();
  app = null;

  console.log(`\nTODO OK — ${passed} verificaciones superadas`);
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
} finally {
  if (busyServer) {
    busyServer.close();
  }
  if (occupier) {
    occupier.kill();
  }
  if (app) {
    await app.close().catch(() => {});
  }
  rmSync(userDataDir, { recursive: true, force: true });
  rmSync(fixtureRoot, { recursive: true, force: true });
}
