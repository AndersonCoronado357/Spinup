import { useEffect, useState } from 'react';
import { MonitorIcon, MoonIcon, SunIcon } from './icons';

type Choice = 'light' | 'dark' | 'system';

const OPTIONS: { id: Choice; label: string; Icon: typeof SunIcon }[] = [
  { id: 'light', label: 'Claro', Icon: SunIcon },
  { id: 'dark', label: 'Oscuro', Icon: MoonIcon },
  { id: 'system', label: 'Sistema', Icon: MonitorIcon },
];

// Estampa la elección en <html>: light/dark fijan data-theme; system lo quita
// para que mande el prefers-color-scheme del sistema.
function apply(choice: Choice) {
  const root = document.documentElement;
  if (choice === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', choice);
  }
}

// Conmutador de tema de tres iconos: Claro, Oscuro, Sistema.
export default function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>(() => {
    const saved = localStorage.getItem('spinup-theme');
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  });

  useEffect(() => {
    apply(choice);
    try {
      localStorage.setItem('spinup-theme', choice);
    } catch {
      /* sin persistencia si el almacenamiento falla */
    }
  }, [choice]);

  // En modo sistema, seguir en vivo los cambios del sistema operativo.
  useEffect(() => {
    if (choice !== 'system') {
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [choice]);

  return (
    <div className="theme-seg no-drag" role="radiogroup" aria-label="Tema">
      {OPTIONS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          data-testid={`theme-${id}`}
          role="radio"
          aria-checked={choice === id}
          data-on={choice === id}
          aria-label={label}
          title={label}
          onClick={() => setChoice(id)}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
