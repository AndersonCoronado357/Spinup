import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import type { ProjectConfig, ProjectStatus } from '../shared/types';

interface RunningEntry {
  child: ChildProcess;
  stoppedByUser: boolean;
  portTimer: NodeJS.Timeout | null;
  mismatchTimer: NodeJS.Timeout | null;
  url: string | null;
  portMismatch: string | null;
}

// URL local anunciada por el proceso (Vite, Next, etc.) en su salida.
const URL_PATTERN = /(https?):\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):(\d{2,5})/gi;

// Secuencias ANSI CSI (colores, cursor) y OSC (titulos) que ensucian la consola.
const ANSI_PATTERN = new RegExp(
  '\\x1b\\[[0-9;?]*[A-Za-z]|\\x1b\\][^\\x07]*(?:\\x07|\\x1b\\\\)',
  'g',
);

function cleanOutput(raw: string): string {
  return raw.replace(ANSI_PATTERN, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

interface DevTool {
  name: string;
  pattern: RegExp;
  // Flag para forzar el puerto definido.
  portArg: (port: number) => string;
  // Flag para exponer el server en la red local (pruebas responsive).
  hostArg: string;
  // Detecta que el usuario ya fijo un host (para no duplicar / respetar opt-out).
  hostPresent: RegExp;
  // Solo mirar el comando literal, no los scripts resueltos (p. ej. composer
  // run dev no reenvia flags a los subprocesos de concurrently).
  commandOnly?: boolean;
}

// Dev servers conocidos: se les fuerza el puerto definido y, por defecto, se
// exponen en la red local (--host) para poder probar responsive desde el movil.
const DEV_TOOLS: DevTool[] = [
  {
    name: 'vite',
    pattern: /(^|[\s;&|("'])vite(?!\s+(build|preview|optimize))\b/,
    portArg: (p) => `--port ${p} --strictPort`,
    hostArg: '--host',
    hostPresent: /(^|\s)--host\b/,
  },
  {
    name: 'next',
    pattern: /(^|[\s;&|("'])next\s+(dev|start)\b/,
    portArg: (p) => `-p ${p}`,
    hostArg: '-H 0.0.0.0',
    hostPresent: /(^|\s)(-H|--hostname)\b/,
  },
  {
    name: 'astro',
    pattern: /(^|[\s;&|("'])astro\s+(dev|preview)\b/,
    portArg: (p) => `--port ${p}`,
    hostArg: '--host',
    hostPresent: /(^|\s)--host\b/,
  },
  {
    name: 'nuxt',
    pattern: /(^|[\s;&|("'])(nuxi|nuxt)\s+dev\b/,
    portArg: (p) => `--port ${p}`,
    hostArg: '--host',
    hostPresent: /(^|\s)--host\b/,
  },
  {
    name: 'angular',
    pattern: /(^|[\s;&|("'])ng\s+serve\b/,
    portArg: (p) => `--port ${p}`,
    hostArg: '--host 0.0.0.0',
    hostPresent: /(^|\s)--host\b/,
  },
  {
    name: 'webpack-dev-server',
    pattern: /(^|[\s;&|("'])(webpack\s+serve|webpack-dev-server)\b/,
    portArg: (p) => `--port ${p}`,
    hostArg: '--host 0.0.0.0',
    hostPresent: /(^|\s)--host\b/,
  },
  {
    name: 'laravel',
    pattern: /(^|[\s;&|("'])php\s+artisan\s+serve\b/,
    portArg: (p) => `--port=${p}`,
    hostArg: '--host=0.0.0.0',
    hostPresent: /(^|\s)--host[=\s]/,
    commandOnly: true,
  },
];

// Si el comando es "npm run X" / "pnpm X" / "yarn X" / "bun run X", devuelve
// el contenido del script X del package.json del proyecto.
function resolveScript(project: ProjectConfig): string | null {
  const tokens = project.command.trim().split(/\s+/);
  const pm = (tokens[0] ?? '').toLowerCase();
  if (!['npm', 'pnpm', 'yarn', 'bun'].includes(pm)) {
    return null;
  }
  let name: string | undefined;
  if (tokens[1] === 'run' || tokens[1] === 'run-script') {
    name = tokens[2];
  } else if (pm === 'npm' && tokens[1] === 'start') {
    name = 'start';
  } else if (pm !== 'npm' && tokens[1] && !tokens[1].startsWith('-')) {
    name = tokens[1];
  }
  if (!name) {
    return null;
  }
  try {
    const pkg = JSON.parse(readFileSync(path.join(project.path, 'package.json'), 'utf8')) as {
      scripts?: Record<string, unknown>;
    };
    const script = pkg.scripts?.[name];
    return typeof script === 'string' ? script : null;
  } catch {
    return null;
  }
}

// Detecta el dev server detras del comando (resolviendo el script de
// package.json si hace falta) y devuelve los flags automaticos: forzar el
// puerto definido y exponer en la red (--host) para pruebas responsive. No
// duplica flags que el usuario ya haya puesto (eso sirve tambien de opt-out:
// p. ej. "vite --host localhost" no se vuelve a exponer).
function resolveDevArgs(project: ProjectConfig): { tool: string; args: string } | null {
  const script = resolveScript(project);
  for (const tool of DEV_TOOLS) {
    const haystack = tool.commandOnly ? project.command : `${project.command}\n${script ?? ''}`;
    if (!tool.pattern.test(haystack)) {
      continue;
    }
    const hasPort =
      /\{port\}/i.test(project.command) || /(^|\s)(--port|-p)([\s=]|$)/.test(haystack);
    const hasHost = tool.hostPresent.test(haystack);
    const parts: string[] = [];
    if (!hasPort) {
      parts.push(tool.portArg(project.port));
    }
    if (!hasHost) {
      parts.push(tool.hostArg);
    }
    return parts.length > 0 ? { tool: tool.name, args: parts.join(' ') } : null;
  }
  return null;
}

// Intento de conexion a un host concreto; cierra con FIN para no provocar
// ECONNRESET en el servidor sondeado.
function probePort(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host, timeout: 600 });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

// true si algo acepta conexiones en el puerto. Prueba IPv4 e IPv6: en Windows
// "localhost" puede resolver a ::1 y servidores como Vite solo escuchan ahi.
async function isPortInUse(port: number): Promise<boolean> {
  const results = await Promise.all([probePort(port, '127.0.0.1'), probePort(port, '::1')]);
  return results.some(Boolean);
}

// PIDs con un socket LISTENING en el puerto (IPv4 e IPv6).
function findPidsOnPort(port: number): number[] {
  if (process.platform === 'win32') {
    const result = spawnSync('netstat', ['-ano', '-p', 'TCP'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    const pids = new Set<number>();
    for (const line of (result.stdout ?? '').split(/\r?\n/)) {
      const match = line.trim().match(/^TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)$/i);
      if (match && Number(match[2]) === port) {
        pids.add(Number(match[3]));
      }
    }
    return [...pids];
  }
  const result = spawnSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
  return (result.stdout ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map(Number);
}

function processName(pid: number): string {
  if (process.platform === 'win32') {
    const result = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    const firstLine = (result.stdout ?? '').trim().split(/\r?\n/)[0] ?? '';
    const name = firstLine.startsWith('"') ? firstLine.slice(1).split('"')[0] : '';
    return name || `pid ${pid}`;
  }
  const result = spawnSync('ps', ['-p', String(pid), '-o', 'comm='], { encoding: 'utf8' });
  return (result.stdout ?? '').trim() || `pid ${pid}`;
}

export class ProcessManager {
  private processes = new Map<string, RunningEntry>();
  private starting = new Set<string>();

  constructor(private getWindow: () => BrowserWindow | null) {}

  isRunning(id: string): boolean {
    return this.processes.has(id);
  }

  async start(project: ProjectConfig): Promise<void> {
    if (this.processes.has(project.id) || this.starting.has(project.id)) {
      return;
    }
    if (!existsSync(project.path)) {
      this.emitOutput(project.id, `[spinup] La ruta no existe: ${project.path}\n`);
      this.emitStatus(project.id, 'error', `La ruta no existe: ${project.path}`);
      return;
    }
    this.starting.add(project.id);
    try {
      if (await isPortInUse(project.port)) {
        this.emitOutput(
          project.id,
          `[spinup] El puerto ${project.port} ya está en uso por otro proceso. Libéralo o cambia el puerto del proyecto.\n`,
        );
        this.emitStatus(project.id, 'error', `El puerto ${project.port} ya está en uso`);
        return;
      }
      this.spawnProject(project);
    } finally {
      this.starting.delete(project.id);
    }
  }

  private spawnProject(project: ProjectConfig): void {
    // El puerto definido es obligatorio: {port} se sustituye en el comando y
    // ademas se inyecta la variable PORT para servidores que leen el entorno.
    let command = project.command.replace(/\{port\}/gi, String(project.port));

    // Dev servers (vite, next...): puerto forzado + exposicion en red automatica.
    const forced = resolveDevArgs(project);
    if (forced) {
      // npm no reenvia argumentos al script sin el separador --
      const separator = /^npm(\s|$)/i.test(command) && !/\s--(\s|$)/.test(command) ? ' -- ' : ' ';
      command = `${command}${separator}${forced.args}`;
    }

    // shell: true para que funcionen comandos como `npm run dev`.
    const child = spawn(command, {
      cwd: project.path,
      shell: true,
      windowsHide: true,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
        PORT: String(project.port),
        // Laravel (php artisan serve) lee el puerto de SERVER_PORT.
        SERVER_PORT: String(project.port),
      },
    });

    const entry: RunningEntry = {
      child,
      stoppedByUser: false,
      portTimer: null,
      mismatchTimer: null,
      url: null,
      portMismatch: null,
    };
    this.processes.set(project.id, entry);

    child.stdout?.on('data', (data: Buffer) => this.handleOutput(project, data.toString('utf8')));
    child.stderr?.on('data', (data: Buffer) => this.handleOutput(project, data.toString('utf8')));

    child.once('spawn', () => {
      this.emitOutput(project.id, `[spinup] $ ${command} (pid ${child.pid})\n`);
      if (forced) {
        this.emitOutput(
          project.id,
          `[spinup] ${forced.tool} detectado: argumentos automáticos "${forced.args}"\n`,
        );
        if (/--host/.test(forced.args)) {
          this.emitOutput(
            project.id,
            '[spinup] Expuesto en la red para pruebas responsive (usa la URL "Network" de arriba en tu móvil).\n',
          );
        }
      }
      this.emitStatus(project.id, 'running');
      if (project.port >= 1 && project.port <= 65535) {
        this.watchPort(project.id, project.port);
      }
    });

    child.on('error', (err) => {
      this.cleanup(project.id);
      this.emitStatus(project.id, 'error', err.message);
    });

    child.on('exit', (code) => {
      const wasStopped = entry.stoppedByUser;
      const portMismatch = entry.portMismatch;
      this.cleanup(project.id);
      if (portMismatch) {
        this.emitStatus(project.id, 'error', portMismatch);
      } else if (wasStopped || code === 0 || code === null) {
        this.emitOutput(project.id, '[spinup] Proceso detenido\n');
        this.emitStatus(project.id, 'stopped');
      } else {
        this.emitStatus(project.id, 'error', `El proceso termino con codigo ${code}`);
      }
    });
  }

  stop(id: string): void {
    const entry = this.processes.get(id);
    if (!entry || entry.child.pid == null) {
      return;
    }
    entry.stoppedByUser = true;
    this.killTree(entry.child.pid, false);
  }

  // Mata los procesos ajenos que esten escuchando en el puerto del proyecto,
  // para poder usarlo. El resultado se informa en la consola del proyecto.
  async killPort(project: ProjectConfig): Promise<number> {
    if (this.processes.has(project.id)) {
      this.emitOutput(
        project.id,
        '[spinup] Este proyecto está corriendo; usa el botón de detener.\n',
      );
      return 0;
    }
    const port = project.port;
    const pids = findPidsOnPort(port).filter((pid) => pid > 4 && pid !== process.pid);
    if (pids.length === 0) {
      this.emitOutput(project.id, `[spinup] No hay ningún proceso escuchando en el puerto ${port}\n`);
      return 0;
    }
    for (const pid of pids) {
      const name = processName(pid);
      this.killTree(pid, true);
      this.emitOutput(project.id, `[spinup] Proceso eliminado: ${name} (pid ${pid})\n`);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    const stillBusy = await isPortInUse(port);
    this.emitOutput(
      project.id,
      stillBusy
        ? `[spinup] El puerto ${port} sigue ocupado; puede que el proceso requiera permisos de administrador\n`
        : `[spinup] Puerto ${port} libre\n`,
    );
    return pids.length;
  }

  // Mata todo de forma sincrona; se usa en before-quit para no dejar zombies.
  stopAllSync(): void {
    for (const entry of this.processes.values()) {
      entry.stoppedByUser = true;
      if (entry.portTimer) {
        clearInterval(entry.portTimer);
      }
      if (entry.child.pid != null) {
        this.killTree(entry.child.pid, true);
      }
    }
    this.processes.clear();
  }

  // En Windows process.kill no mata a los hijos: taskkill /T /F mata el arbol.
  private killTree(pid: number, sync: boolean): void {
    if (process.platform === 'win32') {
      const args = ['/pid', String(pid), '/T', '/F'];
      if (sync) {
        spawnSync('taskkill', args, { windowsHide: true });
      } else {
        spawn('taskkill', args, { windowsHide: true });
      }
    } else {
      try {
        process.kill(-pid, 'SIGTERM');
      } catch {
        process.kill(pid, 'SIGTERM');
      }
    }
  }

  // Limpia la salida, la reenvia al renderer y busca la URL local anunciada.
  private handleOutput(project: ProjectConfig, raw: string): void {
    const text = cleanOutput(raw);
    this.send('process:output', project.id, text);
    this.detectUrl(project, text);
  }

  private static readonly MISMATCH_GRACE_MS = 6000;

  private detectUrl(project: ProjectConfig, text: string): void {
    const entry = this.processes.get(project.id);
    if (!entry || entry.url || entry.portMismatch) {
      return;
    }
    const matches = [...text.matchAll(URL_PATTERN)];
    if (matches.length === 0) {
      return;
    }
    // Si entre las URLs anunciadas esta la del puerto definido, esa gana.
    const exact = matches.find((m) => Number(m[2]) === project.port);
    if (exact) {
      this.confirmUrl(project.id, `${exact[1].toLowerCase()}://localhost:${project.port}/`);
      return;
    }
    // URL ajena (p. ej. el Vite de assets dentro de "composer run dev"):
    // dar un margen a que el puerto definido responda antes de decidir.
    if (entry.mismatchTimer) {
      return;
    }
    const first = matches[0];
    const foreignPort = Number(first[2]);
    const foreignUrl = `${first[1].toLowerCase()}://localhost:${foreignPort}/`;
    this.emitOutput(
      project.id,
      `[spinup] El proceso anunció ${foreignUrl} (distinto del puerto definido ${project.port}). Esperando ${ProcessManager.MISMATCH_GRACE_MS / 1000}s a que el ${project.port} responda...\n`,
    );
    entry.mismatchTimer = setTimeout(() => {
      void this.enforceDefinedPort(project, foreignUrl, foreignPort);
    }, ProcessManager.MISMATCH_GRACE_MS);
  }

  // Marca la URL local confirmada del proyecto y cancela cualquier decision
  // pendiente sobre URLs ajenas.
  private confirmUrl(id: string, url: string): void {
    const entry = this.processes.get(id);
    if (!entry || entry.url) {
      return;
    }
    if (entry.mismatchTimer) {
      clearTimeout(entry.mismatchTimer);
      entry.mismatchTimer = null;
    }
    entry.url = url;
    this.emitUrl(id, url);
  }

  // Vencio el margen: si el puerto definido no responde, el proceso salio por
  // otro puerto y se detiene (el puerto definido es obligatorio).
  private async enforceDefinedPort(
    project: ProjectConfig,
    foreignUrl: string,
    foreignPort: number,
  ): Promise<void> {
    const entry = this.processes.get(project.id);
    if (!entry || entry.url) {
      return;
    }
    entry.mismatchTimer = null;
    if (await isPortInUse(project.port)) {
      // El puerto definido respondio: la URL ajena era un servidor auxiliar.
      if (entry.portTimer) {
        clearInterval(entry.portTimer);
        entry.portTimer = null;
      }
      this.emitOutput(project.id, `[spinup] Puerto ${project.port} activo\n`);
      this.confirmUrl(project.id, `http://localhost:${project.port}/`);
      return;
    }
    entry.portMismatch = `Arrancó en el puerto ${foreignPort} en lugar del ${project.port} definido`;
    if (entry.portTimer) {
      clearInterval(entry.portTimer);
      entry.portTimer = null;
    }
    this.emitOutput(
      project.id,
      `[spinup] El proceso arrancó en ${foreignUrl} pero el puerto definido es ${project.port}. Proceso detenido.\n` +
        `[spinup] Sugerencia: usa {port} en el comando (ej: pnpm dev --port {port} --strictPort) o haz que tu servidor lea la variable de entorno PORT (SERVER_PORT en Laravel).\n`,
    );
    if (entry.child.pid != null) {
      this.killTree(entry.child.pid, false);
    }
  }

  private watchPort(id: string, port: number): void {
    const entry = this.processes.get(id);
    if (!entry) {
      return;
    }
    entry.portTimer = setInterval(() => {
      void isPortInUse(port).then((active) => {
        if (!active) {
          return;
        }
        const current = this.processes.get(id);
        if (!current || current.portTimer === null) {
          return;
        }
        clearInterval(current.portTimer);
        current.portTimer = null;
        this.emitOutput(id, `[spinup] Puerto ${port} activo\n`);
        this.confirmUrl(id, `http://localhost:${port}/`);
      });
    }, 1000);
  }

  private cleanup(id: string): void {
    const entry = this.processes.get(id);
    if (entry?.portTimer) {
      clearInterval(entry.portTimer);
    }
    if (entry?.mismatchTimer) {
      clearTimeout(entry.mismatchTimer);
    }
    this.processes.delete(id);
    this.emitUrl(id, null);
  }

  private emitOutput(id: string, raw: string): void {
    this.send('process:output', id, cleanOutput(raw));
  }

  private emitUrl(id: string, url: string | null): void {
    this.send('process:url', id, url);
  }

  private emitStatus(id: string, status: ProjectStatus, error?: string): void {
    this.send('process:status', id, status, error);
  }

  private send(channel: string, ...args: unknown[]): void {
    const win = this.getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}
