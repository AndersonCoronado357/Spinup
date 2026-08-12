import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import './index.css';
import App from './App';

// Tema inicial antes de pintar (evita parpadeo). light/dark fijan data-theme;
// system (por defecto) lo deja sin poner para que mande el prefers-color-scheme.
(() => {
  const saved = localStorage.getItem('spinup-theme');
  const choice = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  if (choice === 'light' || choice === 'dark') {
    document.documentElement.dataset.theme = choice;
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
