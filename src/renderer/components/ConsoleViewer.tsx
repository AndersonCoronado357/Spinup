import { useEffect, useRef } from 'react';

interface ConsoleViewerProps {
  logs: string;
  onClear: () => void;
}

export default function ConsoleViewer({ logs, onClear }: ConsoleViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Pegado al fondo mientras el usuario no haya scrolleado hacia arriba.
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-1.5">
        <span className="text-[11px] font-medium tracking-wide text-text-muted uppercase">
          Consola
        </span>
        <button
          type="button"
          data-testid="btn-clear"
          onClick={onClear}
          className="rounded px-2 py-0.5 text-[11px] text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          Limpiar consola
        </button>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        data-testid="console-output"
        className="h-52 overflow-y-auto rounded-b-[10px] bg-bg px-4 py-2 font-mono text-[11px] leading-[1.7] whitespace-pre-wrap break-all text-text-secondary select-text"
      >
        {logs.length > 0 ? (
          logs
        ) : (
          <span className="text-text-muted">
            Sin salida todavía. Pulsa play para iniciar el proceso.
          </span>
        )}
      </div>
    </div>
  );
}
