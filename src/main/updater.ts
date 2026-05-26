import type { BrowserWindow } from 'electron';
// Import nombrado: electron-updater expone `autoUpdater` con __esModule y sin
// default, asi que el import por defecto daria undefined en tiempo de ejecucion.
import { autoUpdater } from 'electron-updater';

// Comprobacion de actualizaciones con electron-updater (provider generic ->
// https://spinup.acmsy.com/descargas/). Reglas:
//  - No descarga por sorpresa: autoDownload = false; primero se avisa.
//  - Comprueba al arrancar pero con retraso y en silencio, sin competir con la
//    apertura de la ventana.
//  - La descarga y la instalacion solo ocurren cuando el usuario las pide.
export function setupUpdater(getWindow: () => BrowserWindow | null): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  // Silencioso: los fallos de red (sin servidor, sin internet) no molestan.
  autoUpdater.logger = null;

  const send = (channel: string, payload?: unknown) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  };

  autoUpdater.on('update-available', (info) => {
    send('update:available', { version: info.version });
  });
  autoUpdater.on('download-progress', (progress) => {
    send('update:progress', { percent: Math.round(progress.percent) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    send('update:downloaded', { version: info.version });
  });
  autoUpdater.on('error', () => {
    // Silencioso a proposito: una comprobacion fallida no debe alarmar.
  });

  // Retraso para no competir con el arranque de la ventana.
  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch(() => {});
  }, 8000);
}

export function downloadUpdate(): void {
  void autoUpdater.downloadUpdate().catch(() => {});
}

export function quitAndInstallUpdate(): void {
  autoUpdater.quitAndInstall();
}
