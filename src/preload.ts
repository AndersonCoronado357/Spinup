import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { ElectronAPI, ProjectConfig, ProjectStatus } from './shared/types';

const api: ElectronAPI = {
  // Proyectos
  getProjects: () => ipcRenderer.invoke('projects:get'),
  addProject: (project: Omit<ProjectConfig, 'id'>) => ipcRenderer.invoke('projects:add', project),
  updateProject: (id: string, data: Partial<ProjectConfig>) =>
    ipcRenderer.invoke('projects:update', id, data),
  deleteProject: (id: string) => ipcRenderer.invoke('projects:delete', id),

  // Procesos
  startProject: (id: string) => ipcRenderer.invoke('process:start', id),
  stopProject: (id: string) => ipcRenderer.invoke('process:stop', id),
  killPort: (id: string) => ipcRenderer.invoke('port:kill', id),

  // Eventos (main -> renderer)
  onProcessOutput: (callback: (id: string, data: string) => void) => {
    const listener = (_event: IpcRendererEvent, id: string, data: string) => callback(id, data);
    ipcRenderer.on('process:output', listener);
    return () => ipcRenderer.removeListener('process:output', listener);
  },
  onProcessStatus: (callback: (id: string, status: ProjectStatus, error?: string) => void) => {
    const listener = (
      _event: IpcRendererEvent,
      id: string,
      status: ProjectStatus,
      error?: string,
    ) => callback(id, status, error);
    ipcRenderer.on('process:status', listener);
    return () => ipcRenderer.removeListener('process:status', listener);
  },

  onProcessUrl: (callback: (id: string, url: string | null) => void) => {
    const listener = (_event: IpcRendererEvent, id: string, url: string | null) =>
      callback(id, url);
    ipcRenderer.on('process:url', listener);
    return () => ipcRenderer.removeListener('process:url', listener);
  },

  // Utilidades
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // Controles de ventana
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),

  // Actualizaciones
  onUpdateAvailable: (callback: (version: string) => void) => {
    const listener = (_event: IpcRendererEvent, payload: { version: string }) =>
      callback(payload.version);
    ipcRenderer.on('update:available', listener);
    return () => ipcRenderer.removeListener('update:available', listener);
  },
  onUpdateProgress: (callback: (percent: number) => void) => {
    const listener = (_event: IpcRendererEvent, payload: { percent: number }) =>
      callback(payload.percent);
    ipcRenderer.on('update:progress', listener);
    return () => ipcRenderer.removeListener('update:progress', listener);
  },
  onUpdateDownloaded: (callback: (version: string) => void) => {
    const listener = (_event: IpcRendererEvent, payload: { version: string }) =>
      callback(payload.version);
    ipcRenderer.on('update:downloaded', listener);
    return () => ipcRenderer.removeListener('update:downloaded', listener);
  },
  downloadUpdate: () => ipcRenderer.send('update:download'),
  installUpdate: () => ipcRenderer.send('update:install'),
};

contextBridge.exposeInMainWorld('api', api);
