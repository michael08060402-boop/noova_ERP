# Fuentes del documento (Word)

El documento se genera con scripts:

1. Diagramas: `dib1.py` a `dib7.py` (usan `kit.py`). `python dib1.py && ... && python dib7.py`
2. `node render.mjs` los convierte a PNG con Chrome y `python recortar.py` les quita el margen.
3. `node build3.mjs salida.docx` arma el Word (usa `lib2.mjs`).

Necesita Python con Pillow, Node con `docx` y `puppeteer-core`, Chrome y la fuente Segoe UI.
`dib3.py` toma el logo de `src/assets/logo-blanco.png`; `build3.mjs`, de `src/assets/noova-logo.png`.
Los scripts esperan una carpeta `out/` junto a ellos; los PNG ya recortados están en `../diagramas/`.

## harness-visual/
Página de prueba para ver el tablero de Marketing sin iniciar sesión. Copiar a `.harness/` en la raíz del ERP, correr `npx vite --port 5199 --strictPort` y, con `puppeteer-core` instalado, `node captura.mjs <nombre> "?datos=1&estado=ok"`.
Parámetros: `datos=1` (lecturas de ejemplo), `estado=ok|pendiente` (conexiones), `piezas=0`, `periodo`, `red`, `filtro`, `v=modal` (Generar pieza). Al terminar, detener el servidor y borrar `.harness/`.
