import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ProjectConfig } from '../../shared/types';
import { ChevronDownIcon, FolderIcon } from './icons';

interface AddProjectModalProps {
  initial: ProjectConfig | null;
  projects: ProjectConfig[];
  onClose: () => void;
  onSave: (data: Omit<ProjectConfig, 'id'>) => Promise<void>;
}

interface FieldErrors {
  name?: string;
  path?: string;
  command?: string;
  port?: string;
}

const COMMAND_PRESETS: { group: string; commands: string[] }[] = [
  {
    group: 'npm',
    commands: ['npm run dev', 'npm start', 'npm run start', 'npm run build', 'npm run preview', 'npm test'],
  },
  {
    group: 'pnpm',
    commands: ['pnpm dev', 'pnpm start', 'pnpm run build', 'pnpm run preview', 'pnpm test'],
  },
  { group: 'yarn', commands: ['yarn dev', 'yarn start', 'yarn build', 'yarn test'] },
  { group: 'bun', commands: ['bun run dev', 'bun start', 'bun run build'] },
  { group: 'node', commands: ['node server.js', 'node index.js', 'node --watch server.js'] },
  {
    group: 'php / laravel',
    commands: ['php artisan serve', 'composer run dev', 'php -S 0.0.0.0:{port}'],
  },
  {
    group: 'puerto forzado',
    commands: [
      'npm run dev -- --port {port} --strictPort',
      'pnpm dev --port {port} --strictPort',
      'yarn dev --port {port} --strictPort',
      'vite --port {port} --strictPort',
    ],
  },
];

const inputClass =
  'w-full rounded-md bg-bg px-3 py-2 text-[13px] text-text-primary placeholder:text-text-muted transition-colors duration-150 focus:ring-1 focus:ring-accent focus:outline-none';

export default function AddProjectModal({
  initial,
  projects,
  onClose,
  onSave,
}: AddProjectModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [dir, setDir] = useState(initial?.path ?? '');
  const [command, setCommand] = useState(initial?.command ?? '');
  const [port, setPort] = useState(initial ? String(initial.port) : '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const commandBoxRef = useRef<HTMLDivElement>(null);

  // Al abrir el selector, el buscador interno arranca limpio y con foco.
  useEffect(() => {
    if (presetsOpen) {
      setSearch('');
      searchRef.current?.focus();
    }
  }, [presetsOpen]);

  useEffect(() => {
    nameRef.current?.focus();
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!presetsOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (commandBoxRef.current && !commandBoxRef.current.contains(event.target as Node)) {
        setPresetsOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [presetsOpen]);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!name.trim()) {
      next.name = 'El nombre es obligatorio';
    }
    if (!dir.trim()) {
      next.path = 'La ruta es obligatoria';
    }
    if (!command.trim()) {
      next.command = 'El comando es obligatorio';
    }
    const portNumber = Number(port);
    if (!port.trim() || !Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
      next.port = 'Puerto inválido (1–65535)';
    } else {
      const owner = projects.find((p) => p.port === portNumber && p.id !== initial?.id);
      if (owner) {
        next.port = `El puerto ${portNumber} ya lo usa "${owner.name}"`;
      }
    }
    return next;
  }

  async function handleBrowse() {
    const selected = await window.api.selectDirectory();
    if (selected) {
      setDir(selected);
      setErrors((prev) => ({ ...prev, path: undefined }));
    }
  }

  function pickCommand(value: string) {
    setCommand(value);
    setPresetsOpen(false);
    setErrors((prev) => ({ ...prev, command: undefined }));
  }

  // Se escribe dentro del dropdown (estilo select2): filtra presets y permite
  // usar el texto tal cual como comando propio.
  const query = search.trim().toLowerCase();
  const visibleGroups = COMMAND_PRESETS.map((g) => ({
    group: g.group,
    commands: g.commands.filter((c) => c.toLowerCase().includes(query)),
  })).filter((g) => g.commands.length > 0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        path: dir.trim(),
        command: command.trim(),
        port: Number(port),
      });
    } catch (error) {
      setSaving(false);
      const message = error instanceof Error ? error.message : 'No se pudo guardar';
      setErrors({ port: message.replace(/^Error invoking remote method '[^']+': Error: /, '') });
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        data-testid="project-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-modal-title"
        className="z-50 w-[460px] max-w-[calc(100vw-48px)] rounded-xl bg-surface p-5 shadow-xl shadow-black/50"
      >
        <h2 id="project-modal-title" className="text-[15px] font-semibold">
          {initial ? 'Editar proyecto' : 'Agregar proyecto'}
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          {initial
            ? 'Cambia los datos del proyecto. Los cambios no afectan a un proceso en marcha.'
            : 'Registra una carpeta y el comando que la arranca.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3.5">
          <div>
            <label htmlFor="project-name" className="mb-1.5 block text-xs font-medium text-text-secondary">
              Nombre
            </label>
            <input
              id="project-name"
              ref={nameRef}
              data-testid="input-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Mi API"
              className={inputClass}
            />
            {errors.name && <p className="mt-1 text-[11px] text-danger">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="project-path" className="mb-1.5 block text-xs font-medium text-text-secondary">
              Ruta de la carpeta
            </label>
            <div className="flex gap-2">
              <input
                id="project-path"
                data-testid="input-path"
                type="text"
                value={dir}
                onChange={(event) => setDir(event.target.value)}
                placeholder="C:\dev\mi-api"
                className={`${inputClass} font-mono text-xs`}
              />
              <button
                type="button"
                data-testid="btn-browse"
                onClick={handleBrowse}
                className="flex shrink-0 items-center gap-1.5 rounded-md bg-accent-muted px-3 text-xs font-medium text-accent-ink transition-colors duration-150 hover:bg-accent hover:text-on-accent focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none"
              >
                <FolderIcon />
                Examinar
              </button>
            </div>
            {errors.path && <p className="mt-1 text-[11px] text-danger">{errors.path}</p>}
          </div>

          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <label htmlFor="project-command" className="mb-1.5 block text-xs font-medium text-text-secondary">
                Comando
              </label>
              <div ref={commandBoxRef} className="relative">
                <button
                  type="button"
                  id="project-command"
                  data-testid="command-select"
                  onClick={() => setPresetsOpen((open) => !open)}
                  role="combobox"
                  aria-expanded={presetsOpen}
                  aria-controls="command-presets"
                  aria-haspopup="listbox"
                  className={`${inputClass} flex items-center justify-between gap-2 text-left font-mono text-xs`}
                >
                  <span className={command ? 'truncate' : 'truncate text-text-muted'}>
                    {command || 'Selecciona o escribe un comando'}
                  </span>
                  <ChevronDownIcon
                    className={`shrink-0 text-text-secondary transition-transform duration-150 ${
                      presetsOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {presetsOpen && (
                  <div
                    id="command-presets"
                    data-testid="command-presets"
                    className="absolute top-full right-0 left-0 z-10 mt-1 rounded-md bg-surface-hover shadow-lg shadow-black/50"
                  >
                    <div className="p-1.5">
                      <input
                        ref={searchRef}
                        data-testid="command-search"
                        type="text"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.stopPropagation();
                            setPresetsOpen(false);
                          }
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            if (search.trim()) {
                              pickCommand(search.trim());
                            }
                          }
                        }}
                        placeholder="Escribe para filtrar o crear…"
                        autoComplete="off"
                        className="w-full rounded bg-bg px-2.5 py-1.5 font-mono text-xs text-text-primary placeholder:text-text-muted focus:ring-1 focus:ring-accent focus:outline-none"
                      />
                    </div>
                    <div role="listbox" className="max-h-44 overflow-y-auto pb-1">
                      {search.trim() && (
                        <button
                          type="button"
                          role="option"
                          aria-selected={false}
                          data-testid="command-custom"
                          onClick={() => pickCommand(search.trim())}
                          className="block w-full px-3 py-1.5 text-left font-mono text-xs text-accent-ink transition-colors duration-150 hover:bg-border/60 focus-visible:bg-border/60 focus-visible:outline-none"
                        >
                          Usar «{search.trim()}»
                        </button>
                      )}
                      {visibleGroups.map((group) => (
                        <div key={group.group}>
                          <div className="px-3 pt-2 pb-1 font-mono text-[10px] tracking-wide text-text-muted uppercase">
                            {group.group}
                          </div>
                          {group.commands.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              role="option"
                              aria-selected={command === preset}
                              data-testid="command-preset"
                              onClick={() => pickCommand(preset)}
                              className={`block w-full px-3 py-1.5 text-left font-mono text-xs transition-colors duration-150 hover:bg-border/60 focus-visible:bg-border/60 focus-visible:outline-none ${
                                command === preset ? 'text-accent-ink' : 'text-text-primary'
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      ))}
                      {visibleGroups.length === 0 && !search.trim() && (
                        <p className="px-3 py-2 text-xs text-text-muted">Sin resultados</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {errors.command ? (
                <p className="mt-1 text-[11px] text-danger">{errors.command}</p>
              ) : (
                <p className="mt-1 text-[11px] text-text-secondary">
                  <code className="font-mono">{'{port}'}</code> usa el puerto definido y el proceso
                  recibe <code className="font-mono">PORT</code>. Los dev servers se exponen en la
                  red para probar responsive (usa <code className="font-mono">--host localhost</code>{' '}
                  para evitarlo).
                </p>
              )}
            </div>
            <div className="w-28 shrink-0">
              <label htmlFor="project-port" className="mb-1.5 block text-xs font-medium text-text-secondary">
                Puerto
              </label>
              <input
                id="project-port"
                data-testid="input-port"
                type="text"
                inputMode="numeric"
                value={port}
                onChange={(event) => setPort(event.target.value.replace(/[^0-9]/g, ''))}
                placeholder="3000"
                className={`${inputClass} font-mono text-xs`}
              />
            </div>
          </div>
          {errors.port && (
            <p data-testid="error-port" className="-mt-2 text-[11px] text-danger">
              {errors.port}
            </p>
          )}

          <div className="mt-1.5 flex justify-end gap-2">
            <button
              type="button"
              data-testid="btn-cancel"
              onClick={onClose}
              className="rounded-md px-3.5 py-2 text-[13px] font-medium text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="btn-save"
              disabled={saving}
              className="rounded-md bg-accent px-3.5 py-2 text-[13px] font-semibold text-on-accent transition-colors duration-150 hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {initial ? 'Guardar cambios' : 'Agregar proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
