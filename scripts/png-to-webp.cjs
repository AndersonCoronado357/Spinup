// Convierte los PNG crudos (2x) a WebP en dos anchos para srcset, recortando el
// fondo vacio del borde inferior. Usa el canvas de Chromium (Electron) para
// codificar WebP y para medir el contenido. Uso: electron scripts/png-to-webp.cjs
'use strict';
const { app, BrowserWindow } = require('electron');
const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const WEB = 'C:\\Users\\ac357\\Desktop\\Spinup-web';
const RAW = path.join(WEB, 'assets', 'raw');
const OUT = path.join(WEB, 'assets');
const WIDTHS = [1440, 720];
const JOBS = [
  { name: 'captura-principal', trim: true },
  { name: 'captura-modal', trim: false },
];

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 400,
    height: 400,
    show: false,
    webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: true },
  });
  await win.loadURL('data:text/html,<body>');
  await delay(200);

  const results = [];
  for (const job of JOBS) {
    const b64 = readFileSync(path.join(RAW, `${job.name}.png`)).toString('base64');
    const out = await win.webContents.executeJavaScript(`(async () => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,${b64}'; });
      const W = img.naturalWidth, H = img.naturalHeight;
      const src = document.createElement('canvas'); src.width = W; src.height = H;
      const sx = src.getContext('2d'); sx.drawImage(img, 0, 0);
      let bottom = H;
      if (${job.trim}) {
        const data = sx.getImageData(0, 0, W, H).data;
        const bg = [12, 11, 16];
        for (let y = H - 1; y >= 0; y--) {
          let content = false;
          for (let x = 0; x < W; x += 4) {
            const i = (y * W + x) * 4;
            if (Math.abs(data[i]-bg[0]) > 14 || Math.abs(data[i+1]-bg[1]) > 14 || Math.abs(data[i+2]-bg[2]) > 14) { content = true; break; }
          }
          if (content) { bottom = Math.min(H, y + 48); break; }
        }
      }
      const widths = ${JSON.stringify(WIDTHS)};
      const files = {};
      for (const w of widths) {
        const h = Math.round(bottom * w / W);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high';
        cx.drawImage(src, 0, 0, W, bottom, 0, 0, w, h);
        files[w] = { data: c.toDataURL('image/webp', 0.9).split(',')[1], w, h };
      }
      return { intrinsic: { w: W, h: bottom }, files };
    })()`);

    for (const w of WIDTHS) {
      const f = out.files[w];
      writeFileSync(path.join(OUT, `${job.name}-${w}.webp`), Buffer.from(f.data, 'base64'));
    }
    results.push(`${job.name}: ${WIDTHS.map((w) => `${w}x${out.files[w].h}`).join(', ')}`);
  }
  console.log(results.join(' | '));
  win.destroy();
  app.exit(0);
});
