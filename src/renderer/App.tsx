import { useCallback, useEffect, useState } from 'react';
import type { ProjectConfig, ProjectStatus } from '../shared/types';
import AddProjectModal from './components/AddProjectModal';
import { PlusIcon, TerminalIcon } from './components/icons';
import ProjectCard from './components/ProjectCard';
import TitleBar from './components/TitleBar';
import UpdateBanner from './components/UpdateBanner';

const MAX_LOG_CHARS = 200_000;
const TRIMMED_LOG_CHARS = 150_000;

type ModalState = { mode: 'add' } | { mode: 'edit'; project: ProjectConfig } | null;

interface StatusEntry {
  status: ProjectStatus;
  error?: string;
}

export default function App() {
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [statuses, setStatuses] = useState<Record<string, StatusEntry>>({});
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [logs, setLogs] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<ModalState>(null);

  useEffect(() => {
    void window.api.getProjects().then(setProjects);

    const unsubscribeOutput = window.api.onProcessOutput((id, data) => {
      setLogs((prev) => {
        let next = (prev[id] ?? '') + data;
        if (next.length > MAX_LOG_CHARS) {
          next = next.slice(-TRIMMED_LOG_CHARS);
        }
        return { ...prev, [id]: next };
      });
    });

    const unsubscribeStatus = window.api.onProcessStatus((id, status, error) => {
      setStatuses((prev) => ({ ...prev, [id]: { status, error } }));
      if (status === 'error' && error) {
        setLogs((prev) => ({ ...prev, [id]: `${prev[id] ?? ''}[spinup] Error: ${error}\n` }));
      }
    });

    const unsubscribeUrl = window.api.onProcessUrl((id, url) => {
      setUrls((prev) => ({ ...prev, [id]: url }));
    });

    return () => {
      unsubscribeOutput();
      unsubscribeStatus();
      unsubscribeUrl();
    };
  }, []);

  const handleStart = useCallback((id: string) => {
    void window.api.startProject(id).catch((error: unknown) => {
      setStatuses((prev) => ({
        ...prev,
        [id]: { status: 'error', error: error instanceof Error ? error.message : String(error) },
      }));
    });
  }, []);

  const handleStop = useCallback((id: string) => {
    void window.api.stopProject(id);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await window.api.deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setStatuses((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
    setLogs((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
    setExpanded((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
    setUrls((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  async function handleSave(data: Omit<ProjectConfig, 'id'>) {
    if (modal?.mode === 'edit') {
      const updated = await window.api.updateProject(modal.project.id, data);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } else {
      const created = await window.api.addProject(data);
      setProjects((prev) => [...prev, created]);
    }
    setModal(null);
  }

  const runningCount = projects.filter((p) => statuses[p.id]?.status === 'running').length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-text-primary">
      <TitleBar total={projects.length} running={runningCount} />
      <UpdateBanner />

      <main className="flex-1 overflow-y-auto">
        <div className="w-full px-4 pt-2 pb-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-semibold">Proyectos</h1>
              <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                {projects.length}
              </span>
            </div>
            <button
              type="button"
              data-testid="btn-add-project"
              onClick={() => setModal({ mode: 'add' })}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-[13px] font-semibold text-on-accent transition-colors duration-150 hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
            >
              <PlusIcon />
              Agregar proyecto
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-3 pb-6">
            {projects.length === 0 ? (
              <EmptyState onAdd={() => setModal({ mode: 'add' })} />
            ) : (
              projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  status={statuses[project.id]?.status ?? 'stopped'}
                  url={urls[project.id] ?? null}
                  logs={logs[project.id] ?? ''}
                  expanded={expanded[project.id] ?? false}
                  onStart={() => handleStart(project.id)}
                  onStop={() => handleStop(project.id)}
                  onEdit={() => setModal({ mode: 'edit', project })}
                  onDelete={() => void handleDelete(project.id)}
                  onKillPort={() => {
                    // Accion explicita del usuario: la consola se abre para
                    // mostrar el resultado.
                    setExpanded((prev) => ({ ...prev, [project.id]: true }));
                    void window.api.killPort(project.id);
                  }}
                  onToggleConsole={() =>
                    setExpanded((prev) => ({ ...prev, [project.id]: !prev[project.id] }))
                  }
                  onClearLogs={() => setLogs((prev) => ({ ...prev, [project.id]: '' }))}
                />
              ))
            )}
          </div>
        </div>
      </main>

      {modal && (
        <AddProjectModal
          initial={modal.mode === 'edit' ? modal.project : null}
          projects={projects}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      data-testid="empty-state"
      className="flex flex-col items-center rounded-[10px] bg-surface px-6 py-14 text-center"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-muted text-accent-ink">
        <TerminalIcon size={20} />
      </div>
      <p className="mt-4 text-sm font-medium">Aún no hay proyectos</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-text-secondary">
        Un proyecto es una carpeta, el comando que la arranca (como{' '}
        <code className="font-mono text-[11px] text-text-primary">npm run dev</code>) y el puerto
        donde escucha.
      </p>
      <button
        type="button"
        data-testid="btn-add-first"
        onClick={onAdd}
        className="mt-5 flex items-center gap-1.5 rounded-md bg-accent-muted px-3.5 py-2 text-[13px] font-medium text-accent-ink transition-colors duration-150 hover:bg-accent hover:text-on-accent focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none"
      >
        <PlusIcon />
        Agregar tu primer proyecto
      </button>
    </div>
  );
}
