import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { ProjectConfig } from '../shared/types';
import { ProcessManager } from './process-manager';
import * as store from './store';
import { downloadUpdate, quitAndInstallUpdate, setupUpdater } from './updater';

// Permite aislar la configuracion en pruebas E2E.
if (process.env.SPINUP_USER_DATA) {
  app.setPath('userData', process.env.SPINUP_USER_DATA);
}

// Modo oculto para pruebas: la ventana nunca se muestra ni roba el foco.
const HIDDEN_MODE = process.env.SPINUP_HIDDEN === '1';

// Modo capturas: ventana fuera de pantalla, sin foco ni taskbar, pero que
// sigue pintando frames (necesario para screenshot via CDP).
const OFFSCREEN_MODE = process.env.SPINUP_OFFSCREEN === '1';
if (OFFSCREEN_MODE) {
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
}

app.setAppUserModelId('com.spinup.app');

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
const processManager = new ProcessManager(() => mainWindow);

function createWindow(): void {
  // Empaquetado: el icono va a resources/ via extraResources. Desarrollo: build/.
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '..', '..', 'build', 'icon.ico');
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 740,
    minWidth: 780,
    minHeight: 520,
    frame: false,
    show: false,
    backgroundColor: '#0C0B10',
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    ...(OFFSCREEN_MODE ? { x: -12000, y: 100, focusable: false, skipTaskbar: true } : {}),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // La consola sigue pintando aunque la ventana este oculta o minimizada.
      backgroundThrottling: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (OFFSCREEN_MODE) {
      mainWindow?.showInactive();
    } else if (!HIDDEN_MODE) {
      mainWindow?.show();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }
}

function sanitizeProject(data: unknown): Omit<ProjectConfig, 'id'> {
  const d = (data ?? {}) as Record<string, unknown>;
  const name = String(d.name ?? '').trim();
  const dir = String(d.path ?? '').trim();
  const command = String(d.command ?? '').trim();
  const port = Number(d.port);
  if (!name || !dir || !command) {
    throw new Error('Datos del proyecto incompletos');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Puerto invalido (1-65535)');
  }
  return { name, path: dir, command, port };
}

// Dos proyectos no pueden compartir puerto.
function assertPortAvailable(port: number, excludeId?: string): void {
  const owner = store.getProjects().find((p) => p.port === port && p.id !== excludeId);
  if (owner) {
    throw new Error(`El puerto ${port} ya lo usa "${owner.name}"`);
  }
}

function registerIpcHandlers(): void {
  // Proyectos
  ipcMain.handle('projects:get', () => store.getProjects());

  ipcMain.handle('projects:add', (_event, data: unknown) => {
    const project = sanitizeProject(data);
    assertPortAvailable(project.port);
    return store.addProject(project);
  });

  ipcMain.handle('projects:update', (_event, id: string, data: unknown) => {
    const existing = store.getProject(id);
    if (!existing) {
      throw new Error('Proyecto no encontrado');
    }
    const merged = { ...existing, ...(data as Partial<ProjectConfig>) };
    const project = sanitizeProject(merged);
    assertPortAvailable(project.port, id);
    return store.updateProject(id, project);
  });

  ipcMain.handle('projects:delete', (_event, id: string) => {
    processManager.stop(id);
    store.deleteProject(id);
  });

  // Procesos
  ipcMain.handle('process:start', (_event, id: string) => {
    const project = store.getProject(id);
    if (!project) {
      throw new Error('Proyecto no encontrado');
    }
    return processManager.start(project);
  });

  ipcMain.handle('process:stop', (_event, id: string) => {
    processManager.stop(id);
  });

  ipcMain.handle('port:kill', (_event, id: string) => {
    const project = store.getProject(id);
    if (!project) {
      throw new Error('Proyecto no encontrado');
    }
    return processManager.killPort(project);
  });

  // Utilidades
  ipcMain.handle('dialog:selectDirectory', async () => {
    if (!mainWindow) {
      return null;
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecciona la carpeta del proyecto',
      properties: ['openDirectory'],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Solo se pueden abrir URLs http/https');
    }
    return shell.openExternal(url);
  });

  // Controles de ventana (frameless)
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (!mainWindow) {
      return;
    }
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  // Actualizaciones (la descarga y la instalacion solo a peticion del usuario).
  ipcMain.on('update:download', () => downloadUpdate());
  ipcMain.on('update:install', () => quitAndInstallUpdate());
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  // Solo en la app instalada y fuera de pruebas: comprobar actualizaciones.
  if (app.isPackaged && !HIDDEN_MODE && !OFFSCREEN_MODE) {
    setupUpdater(() => mainWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  processManager.stopAllSync();
});
