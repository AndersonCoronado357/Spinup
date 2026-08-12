// Verifica la pagina de descarga midiendo (no mirando): sirve Spinup-web en
// localhost, la renderiza en un Chromium offscreen a 1440 y 390 y comprueba:
//  - scrollWidth == clientWidth (cero desbordamiento horizontal)
//  - distancia de cada imagen a los bordes de la ventana y de su seccion
//  - contraste AA de los textos sobre su fondo real
// La URL se pasa por variable de entorno (Electron muere con 255 si es argumento).
'use strict';
const { app, BrowserWindow, nativeTheme } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = 'C:\\Users\\ac357\\Desktop\\Spinup-web';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end('404');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const MEASURE = `(() => {
  const luminance = (r, g, b) => {
    const a = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  };
  const parse = (c) => (c.match(/\\d+(\\.\\d+)?/g) || []).map(Number);
  const bgOf = (el) => {
    let n = el;
    while (n) {
      const c = getComputedStyle(n).backgroundColor;
      const p = parse(c);
      if (p.length >= 3 && !(p.length === 4 && p[3] === 0)) return [p[0], p[1], p[2]];
      n = n.parentElement;
    }
    return [12, 11, 16];
  };
  const ratio = (fg, bg) => {
    const l1 = luminance(fg[0], fg[1], fg[2]);
    const l2 = luminance(bg[0], bg[1], bg[2]);
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  };
  const de = document.documentElement;
  const overflow = { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth };
  const vw = de.clientWidth;

  const images = [...document.querySelectorAll('img')].filter((im) => im.width > 40).map((im) => {
    const r = im.getBoundingClientRect();
    const sec = im.closest('section, header, footer');
    const sr = sec ? sec.getBoundingClientRect() : { left: 0, right: vw, top: 0, bottom: 0 };
    return {
      alt: (im.getAttribute('alt') || im.currentSrc || '').slice(0, 28),
      toWindowLeft: Math.round(r.left),
      toWindowRight: Math.round(vw - r.right),
      toSectionLeft: Math.round(r.left - sr.left),
      toSectionRight: Math.round(sr.right - r.right),
    };
  });

  const sels = ['.lead', '.band__col--text p', '.punto h3', '.punto p', '.hero__meta', '.ficha__row dt', '.ficha__row dd', '#sha', '.topnav a', '.btn--primary'];
  const contrast = [];
  sels.forEach((s) => {
    const el = document.querySelector(s);
    if (!el) return;
    const fg = parse(getComputedStyle(el).color);
    const bg = bgOf(el);
    contrast.push({ sel: s, ratio: Math.round(ratio(fg, bg) * 100) / 100 });
  });
  const hex = (a) => '#' + a.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
  const cta = document.querySelector('.topnav__cta');
  const ctaInfo = cta
    ? { color: hex(parse(getComputedStyle(cta).color)), bg: hex(bgOf(cta)), ratio: Math.round(ratio(parse(getComputedStyle(cta).color), bgOf(cta)) * 100) / 100 }
    : null;
  return { overflow, images, contrast, cta: ctaInfo };
})()`;

async function loadWithRetry(win, url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      await win.loadURL(url);
      return;
    } catch {
      await delay(300);
    }
  }
  throw new Error('no se pudo cargar ' + url);
}

// Evita que la app se cierre sola al quedar sin ventanas entre iteraciones.
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const url = process.env.PAGE_URL || base;

  const viewports = [
    { name: '1440', w: 1440, h: 900 },
    { name: '390', w: 390, h: 844 },
  ];
  const themes = ['dark', 'light']; // la web cambia sola por prefers-color-scheme
  const out = {};
  for (const theme of themes) {
    nativeTheme.themeSource = theme; // emula el prefers-color-scheme del sistema
    for (const vp of viewports) {
      const key = `${theme}-${vp.name}`;
      // Ventana oculta fuera de pantalla (no roba foco, no se ve): carga http de
      // forma fiable y permite capturePage, a diferencia del offscreen puro.
      const win = new BrowserWindow({
        width: vp.w,
        height: vp.h,
        show: false,
        frame: false,
        skipTaskbar: true,
        webPreferences: { offscreen: false },
      });
      win.setPosition(-6000, 0);
      win.setContentSize(vp.w, vp.h);
      await loadWithRetry(win, url);
      win.showInactive();
      await delay(1700); // deja correr el fallback del reveal
      out[key] = await win.webContents.executeJavaScript(MEASURE);
      // Captura a altura completa para revisar toda la pagina.
      const fullH = await win.webContents.executeJavaScript(
        'document.documentElement.scrollHeight',
      );
      win.setContentSize(vp.w, Math.min(fullH, 8000));
      await delay(500);
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(ROOT, `assets/raw/render-${key}.png`), img.toPNG());
      win.destroy();
    }
  }
  fs.writeFileSync(path.join(ROOT, 'assets/raw/verify.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  server.close();
  app.exit(0);
});
