// Rasteriza build/icon.svg a un .ico multi-resolucion (16,32,48,64,128,256) y a
// build/icon.png (512), usando Chromium (Electron) para respetar las curvas del
// SVG con fondo transparente. Windows acepta entradas PNG dentro del .ico.
// Uso: electron scripts/render-icon.cjs
'use strict';
const { app, BrowserWindow } = require('electron');
const { readFileSync, writeFileSync, unlinkSync } = require('node:fs');
const path = require('node:path');

const buildDir = path.join(__dirname, '..', 'build');
const svg = readFileSync(path.join(buildDir, 'icon.svg'), 'utf8');
const SIZES = [16, 32, 48, 64, 128, 256];

// HTML temporal con el SVG a pantalla completa; el tamano de ventana define el
// tamano de salida. Cargar un archivo evita el limite de longitud de los data URL.
const htmlPath = path.join(buildDir, '_icon-render.html');
writeFileSync(
  htmlPath,
  `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:transparent;width:100%;height:100%;overflow:hidden}
    svg{display:block;width:100vw;height:100vh}
  </style>${svg}`,
);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const logPath = path.join(buildDir, 'render.log');
function log(msg) {
  writeFileSync(logPath, `${msg}\n`, { flag: 'a' });
}

app.disableHardwareAcceleration();

// Captura una sola vez a alta resolucion; de esa imagen se derivan los tamanos.
// (Crear un segundo BrowserWindow offscreen cuelga capturePage en Electron.)
async function captureBase() {
  const size = 512;
  const win = new BrowserWindow({
    width: size,
    height: size,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true, paintWhenInitiallyHidden: true },
  });
  win.webContents.setFrameRate(5);
  await win.loadFile(htmlPath).catch(() => {});
  await delay(600);
  const image = await win.webContents.capturePage();
  win.destroy();
  return image;
}

// Empaqueta varios PNG en un contenedor ICO multi-resolucion.
function packIco(entries) {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo icono
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  entries.forEach((e, i) => {
    const d = dir.subarray(i * 16, i * 16 + 16);
    d[0] = e.size >= 256 ? 0 : e.size; // ancho (0 = 256)
    d[1] = e.size >= 256 ? 0 : e.size; // alto
    d[2] = 0; // colores en paleta
    d[3] = 0; // reservado
    d.writeUInt16LE(1, 4); // planos
    d.writeUInt16LE(32, 6); // bits por pixel
    d.writeUInt32LE(e.png.length, 8); // bytes de la imagen
    d.writeUInt32LE(offset, 12); // offset
    offset += e.png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

app.whenReady().then(async () => {
  writeFileSync(logPath, '');
  try {
    log('capturando base 512...');
    const base = await captureBase();

    const png512 = base.resize({ width: 512, height: 512, quality: 'best' }).toPNG();
    writeFileSync(path.join(buildDir, 'icon.png'), png512);

    const entries = SIZES.map((size) => ({
      size,
      png: base.resize({ width: size, height: size, quality: 'best' }).toPNG(),
    }));
    writeFileSync(path.join(buildDir, 'icon.ico'), packIco(entries));
    log('sizes=' + entries.map((e) => `${e.size}:${e.png.length}`).join(' '));

    try {
      unlinkSync(htmlPath);
    } catch {
      /* noop */
    }
    log('OK');
    console.log(
      'icon.ico multi-res (' + SIZES.join(',') + ') y icon.png (512) generados desde icon.svg',
    );
    app.exit(0);
  } catch (error) {
    log('ERROR ' + (error && error.stack ? error.stack : error));
    console.error('Error al rasterizar el icono:', error);
    app.exit(1);
  }
});
