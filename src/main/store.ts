import Store from 'electron-store';
import { randomUUID } from 'node:crypto';
import type { ProjectConfig } from '../shared/types';

interface Schema {
  projects: ProjectConfig[];
}

// Persiste en %APPDATA%/spinup/config.json. Inicializacion perezosa para que
// respete cualquier app.setPath('userData') hecho durante el arranque.
let store: Store<Schema> | null = null;

function getStore(): Store<Schema> {
  if (!store) {
    store = new Store<Schema>({ defaults: { projects: [] } });
  }
  return store;
}

export function getProjects(): ProjectConfig[] {
  return getStore().get('projects');
}

export function getProject(id: string): ProjectConfig | undefined {
  return getProjects().find((p) => p.id === id);
}

export function addProject(data: Omit<ProjectConfig, 'id'>): ProjectConfig {
  const project: ProjectConfig = { ...data, id: randomUUID() };
  getStore().set('projects', [...getProjects(), project]);
  return project;
}

export function updateProject(id: string, data: Omit<ProjectConfig, 'id'>): ProjectConfig {
  const projects = getProjects();
  const index = projects.findIndex((p) => p.id === id);
  if (index === -1) {
    throw new Error('Proyecto no encontrado');
  }
  const updated: ProjectConfig = { ...data, id };
  projects[index] = updated;
  getStore().set('projects', projects);
  return updated;
}

export function deleteProject(id: string): void {
  getStore().set(
    'projects',
    getProjects().filter((p) => p.id !== id),
  );
}
