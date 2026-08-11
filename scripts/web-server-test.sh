#!/usr/bin/env bash
# Prueba local del contenedor nginx de la pagina (ejecutar en WSL).
set -u
B="http://127.0.0.1:3037"
code() { curl -s -o /dev/null -w '%{http_code}' "$1"; }
hdr() { curl -sI "$1"; }

echo "=== Estado y salud ==="
printf 'health      %s  "%s"\n' "$(code "$B/health")" "$(curl -s "$B/health" | tr -d '\n')"
printf 'index       %s\n' "$(code "$B/")"

echo "=== Archivos de despliegue / internos (deben ser 404) ==="
for p in Dockerfile nginx.conf .dockerignore assets/raw/verify.json assets/raw/render-1440.png no-existe-xyz; do
  printf '%-28s %s\n' "$p" "$(code "$B/$p")"
done

echo "=== Estaticos reales (deben ser 200) ==="
for p in estilos.css app.js assets/logo.svg assets/rubik-latin.woff2 assets/rubik-latin-ext.woff2 assets/captura-principal-1440.webp assets/captura-principal-720.webp assets/captura-modal-1440.webp favicon.ico; do
  printf '%-40s %s\n' "$p" "$(code "$B/$p")"
done

echo "=== Descargas ==="
printf '%-28s %s\n' "installer" "$(code "$B/descargas/Spinup%20Setup%201.0.0.exe")"
printf '%-28s %s\n' "blockmap" "$(code "$B/descargas/Spinup%20Setup%201.0.0.exe.blockmap")"
printf '%-28s %s\n' "latest.yml" "$(code "$B/descargas/latest.yml")"

echo "=== Cabeceras clave ==="
echo "--- estilos.css ---"; hdr "$B/estilos.css" | grep -iE 'cache-control|content-type' | tr -d '\r'
echo "--- webp ---"; hdr "$B/assets/captura-principal-1440.webp" | grep -iE 'cache-control|content-type' | tr -d '\r'
echo "--- instalador ---"; hdr "$B/descargas/Spinup%20Setup%201.0.0.exe" | grep -iE 'content-disposition|cache-control|content-length|content-type' | tr -d '\r'
