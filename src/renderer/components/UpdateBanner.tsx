import { useEffect, useState } from 'react';

type Phase = 'available' | 'downloading' | 'downloaded';

// Aviso de actualización: aparece solo cuando hay versión nueva. La descarga
// (100 MB) nunca ocurre sin que el usuario la pida; luego ofrece reiniciar.
export default function UpdateBanner() {
  const [version, setVersion] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('available');
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const offAvailable = window.api.onUpdateAvailable((v) => {
      setVersion(v);
      setPhase('available');
    });
    const offProgress = window.api.onUpdateProgress((p) => setPercent(p));
    const offDownloaded = window.api.onUpdateDownloaded((v) => {
      setVersion(v);
      setPhase('downloaded');
    });
    return () => {
      offAvailable();
      offProgress();
      offDownloaded();
    };
  }, []);

  if (!version) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 bg-accent-muted px-4 py-2 text-[12px]">
      <span className="text-text-primary">
        {phase === 'downloaded' ? (
          <>
            Versión <span className="font-semibold text-accent">{version}</span> lista para instalar.
          </>
        ) : phase === 'downloading' ? (
          <>Descargando la versión {version}… {percent}%</>
        ) : (
          <>
            Hay una versión nueva disponible:{' '}
            <span className="font-semibold text-accent">{version}</span>.
          </>
        )}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        {phase === 'available' && (
          <button
            type="button"
            data-testid="btn-update-download"
            onClick={() => {
              setPhase('downloading');
              window.api.downloadUpdate();
            }}
            className="rounded-md bg-accent px-3 py-1 font-semibold text-bg transition-colors duration-150 hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
          >
            Descargar
          </button>
        )}
        {phase === 'downloaded' && (
          <button
            type="button"
            data-testid="btn-update-install"
            onClick={() => window.api.installUpdate()}
            className="rounded-md bg-accent px-3 py-1 font-semibold text-bg transition-colors duration-150 hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
          >
            Reiniciar e instalar
          </button>
        )}
        <button
          type="button"
          data-testid="btn-update-dismiss"
          onClick={() => setVersion(null)}
          className="rounded-md px-2 py-1 text-text-secondary transition-colors duration-150 hover:text-text-primary focus-visible:outline-none"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
