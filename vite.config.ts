import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// CSP only on build: the dev server needs inline scripts for react-refresh.
function injectCsp(): Plugin {
  return {
    name: 'spinup:inject-csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content:
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self'",
          },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react(), tailwindcss(), injectCsp()],
  build: {
    outDir: fileURLToPath(new URL('./dist/renderer', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5183,
    strictPort: true,
  },
});
