// Tailwind CSS 4: los tokens de diseño viven en src/renderer/index.css (@theme).
// Este archivo existe como referencia de la paleta y para herramientas que
// esperan un config clásico; no se carga vía @config.
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        bg: '#0C0B10',
        surface: '#15141B',
        'surface-hover': '#1E1D26',
        border: '#2A2833',
        accent: '#D4915C',
        'accent-muted': '#2E2118',
        success: '#6BCB77',
        'success-muted': '#1A2E1D',
        danger: '#E05252',
        'danger-muted': '#2E1818',
        warning: '#E0C556',
        'text-primary': '#E5E2EB',
        'text-secondary': '#908DA0',
        'text-muted': '#5A5768',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
} satisfies Config;
