export interface ProjectConfig {
  id: string;
  name: string;
  path: string;
  command: string;
  port: number;
}

export type ProjectStatus = 'running' | 'stopped' | 'error';

export interface ElectronAPI {
  // Proyectos
  getProjects(): Promise<ProjectConfig[]>;
  addProject(project: Omit<ProjectConfig, 'id'>): Promise<ProjectConfig>;
  updateProject(id: string, data: Partial<ProjectConfig>): Promise<ProjectConfig>;
  deleteProject(id: string): Promise<void>;

  // Procesos
  startProject(id: string): Promise<void>;
  stopProject(id: string): Promise<void>;
  // Mata los procesos ajenos que ocupen el puerto del proyecto.
  killPort(id: string): Promise<number>;

  // Eventos (main -> renderer). Devuelven una funcion para desuscribirse.
  onProcessOutput(callback: (id: string, data: string) => void): () => void;
  onProcessStatus(
    callback: (id: string, status: ProjectStatus, error?: string) => void,
  ): () => void;
  // URL local detectada del proceso (null cuando se detiene).
  onProcessUrl(callback: (id: string, url: string | null) => void): () => void;

  // Utilidades
  selectDirectory(): Promise<string | null>;
  openExternal(url: string): Promise<void>;

  // Controles de ventana (frameless)
  windowMinimize(): void;
  windowMaximize(): void;
  windowClose(): void;

  // Actualizaciones automáticas
  onUpdateAvailable(callback: (version: string) => void): () => void;
  onUpdateProgress(callback: (percent: number) => void): () => void;
  onUpdateDownloaded(callback: (version: string) => void): () => void;
  downloadUpdate(): void;
  installUpdate(): void;
}
