import { useEffect, useRef, useState } from 'react';
import type { ProjectConfig, ProjectStatus } from '../../shared/types';
import ConsoleViewer from './ConsoleViewer';
import {
  ExternalLinkIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlayIcon,
  StopIcon,
  TerminalIcon,
  TrashIcon,
  ZapIcon,
} from './icons';

const STATUS_LABEL: Record<ProjectStatus, string> = {
  stopped: 'Detenido',
  running: 'Corriendo',
  error: 'Error',
};

const STATUS_CHIP: Record<ProjectStatus, string> = {
  stopped: 'bg-surface-hover text-text-secondary',
  running: 'bg-success-muted text-success',
  error: 'bg-danger-muted text-danger',
};

const STATUS_DOT: Record<ProjectStatus, string> = {
  stopped: 'bg-text-muted',
  running: 'bg-success status-pulse',
  error: 'bg-danger',
};

interface ProjectCardProps {
  project: ProjectConfig;
  status: ProjectStatus;
  url: string | null;
  logs: string;
  expanded: boolean;
  onStart: () => void;
  onStop: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onKillPort: () => void;
  onToggleConsole: () => void;
  onClearLogs: () => void;
}

export default function ProjectCard({
  project,
  status,
  url,
  logs,
  expanded,
  onStart,
  onStop,
  onEdit,
  onDelete,
  onKillPort,
  onToggleConsole,
  onClearLogs,
}: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      setConfirmDelete(false);
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div
      data-testid={`project-card-${project.id}`}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
      className="rounded-[10px] bg-surface"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span className="truncate text-sm font-medium" title={project.name}>
              {project.name}
            </span>
            <span
              data-testid="status-chip"
              data-status={status}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CHIP[status]}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
              {STATUS_LABEL[status]}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2 font-mono text-[11px] text-text-muted">
            <span className="truncate text-text-secondary" title={project.path}>
              {project.path}
            </span>
            <span aria-hidden>·</span>
            <span
              className="shrink-0 rounded bg-bg px-1.5 py-0.5 text-text-secondary"
              title={`Comando: ${project.command}`}
            >
              {project.command}
            </span>
            <span className="shrink-0 text-accent-ink" title={`Puerto esperado: ${project.port}`}>
              :{project.port}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {status === 'running' && url && (
            <button
              type="button"
              data-testid="btn-open-url"
              onClick={() => void window.api.openExternal(url)}
              title={`Abrir ${url} en el navegador`}
              aria-label={`Abrir ${url} en el navegador`}
              className="flex h-8 items-center gap-1.5 rounded-md bg-accent-muted px-2.5 font-mono text-[11px] text-accent-ink transition-colors duration-150 hover:bg-accent hover:text-on-accent focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none"
            >
              <ExternalLinkIcon />:{new URL(url).port}
            </button>
          )}
          <button
            type="button"
            data-testid="btn-console"
            onClick={onToggleConsole}
            title={expanded ? 'Ocultar consola' : 'Mostrar consola'}
            aria-label={expanded ? 'Ocultar consola' : 'Mostrar consola'}
            aria-expanded={expanded}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none ${
              expanded
                ? 'bg-accent-muted text-accent-ink'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            <TerminalIcon />
          </button>

          {status === 'running' ? (
            <button
              type="button"
              data-testid="btn-stop"
              onClick={onStop}
              title="Detener proyecto"
              aria-label="Detener proyecto"
              className="flex h-8 w-8 items-center justify-center rounded-md bg-danger-muted text-danger transition-colors duration-150 hover:bg-danger hover:text-white focus-visible:ring-1 focus-visible:ring-danger focus-visible:outline-none"
            >
              <StopIcon />
            </button>
          ) : (
            <button
              type="button"
              data-testid="btn-play"
              onClick={onStart}
              title="Iniciar proyecto"
              aria-label="Iniciar proyecto"
              className="flex h-8 w-8 items-center justify-center rounded-md bg-success-muted text-success transition-colors duration-150 hover:bg-success hover:text-bg focus-visible:ring-1 focus-visible:ring-success focus-visible:outline-none"
            >
              <PlayIcon />
            </button>
          )}

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              data-testid="btn-options"
              onClick={() => setMenuOpen((open) => !open)}
              title="Opciones"
              aria-label="Opciones del proyecto"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none ${
                menuOpen
                  ? 'bg-surface-hover text-text-primary'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`}
            >
              <MoreVerticalIcon />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute top-9 right-0 z-20 w-48 overflow-hidden rounded-md bg-surface-hover py-1"
              >
                <button
                  type="button"
                  role="menuitem"
                  data-testid="btn-edit"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text-primary transition-colors duration-150 hover:bg-border/60 focus-visible:bg-border/60 focus-visible:outline-none"
                >
                  <PencilIcon className="text-text-secondary" />
                  Editar proyecto
                </button>
                {status !== 'running' && (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="btn-kill-port"
                    title={`Matar lo que esté escuchando en el puerto ${project.port}`}
                    onClick={() => {
                      setMenuOpen(false);
                      onKillPort();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-warning transition-colors duration-150 hover:bg-border/60 focus-visible:bg-border/60 focus-visible:outline-none"
                  >
                    <ZapIcon />
                    Liberar puerto :{project.port}
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  data-testid="btn-delete"
                  onClick={() => {
                    if (confirmDelete) {
                      setMenuOpen(false);
                      onDelete();
                    } else {
                      setConfirmDelete(true);
                    }
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-danger transition-colors duration-150 hover:bg-danger-muted focus-visible:bg-danger-muted focus-visible:outline-none"
                >
                  <TrashIcon />
                  {confirmDelete ? 'Confirmar eliminación' : 'Eliminar proyecto'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {expanded && <ConsoleViewer logs={logs} onClear={onClearLogs} />}
    </div>
  );
}
