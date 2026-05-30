import { CloseIcon, MaximizeIcon, MinusIcon, SpinupLogo } from './icons';

interface TitleBarProps {
  total: number;
  running: number;
}

export default function TitleBar({ total, running }: TitleBarProps) {
  return (
    <header className="drag flex h-10 shrink-0 items-center justify-between pl-4">
      <div className="flex items-center gap-2">
        <SpinupLogo size={19} />
        <span className="text-[13px] font-semibold text-text-secondary">Spinup</span>
      </div>
      <div className="flex h-full items-center">
        <div data-testid="titlebar-stats" className="mr-4 flex items-center gap-3 text-[11px]">
          <span className="text-text-secondary">
            {total} {total === 1 ? 'proyecto' : 'proyectos'}
          </span>
          <span
            className={`flex items-center gap-1.5 ${running > 0 ? 'text-success' : 'text-text-muted'}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                running > 0 ? 'status-pulse bg-success' : 'bg-text-muted'
              }`}
            />
            {running} corriendo
          </span>
        </div>
        <div className="no-drag flex h-full">
          <button
            type="button"
            onClick={() => window.api.windowMinimize()}
            title="Minimizar"
            aria-label="Minimizar ventana"
            className="flex h-full w-[46px] items-center justify-center text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary focus-visible:bg-surface-hover focus-visible:outline-none"
          >
            <MinusIcon />
          </button>
          <button
            type="button"
            onClick={() => window.api.windowMaximize()}
            title="Maximizar"
            aria-label="Maximizar o restaurar ventana"
            className="flex h-full w-[46px] items-center justify-center text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary focus-visible:bg-surface-hover focus-visible:outline-none"
          >
            <MaximizeIcon />
          </button>
          <button
            type="button"
            onClick={() => window.api.windowClose()}
            title="Cerrar"
            aria-label="Cerrar ventana"
            className="flex h-full w-[46px] items-center justify-center text-text-secondary transition-colors duration-150 hover:bg-danger hover:text-white focus-visible:bg-danger focus-visible:text-white focus-visible:outline-none"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    </header>
  );
}
