// Renderiza los diagramas Mermaid y los SVG propios a PNG con Chrome sin ventana.
// Uso: node render.mjs [nombre ...]   (sin argumentos renderiza todo)
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { diagramas } from './diagramas.mjs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const AQUI = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const OUT = path.join(AQUI, 'out');
mkdirSync(OUT, { recursive: true });

const MERMAID = pathToFileURL(path.join(AQUI, 'node_modules/mermaid/dist/mermaid.min.js')).href;
const tema = {
  theme: 'base',
  themeVariables: {
    fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '17px',
    primaryColor: '#e6f1f6', primaryBorderColor: '#004669', primaryTextColor: '#14181c',
    lineColor: '#1486ba', secondaryColor: '#e0f5f5', tertiaryColor: '#f2efe9',
    clusterBkg: '#fafaf8', clusterBorder: '#c3ced6', edgeLabelBackground: '#ffffff',
    noteBkgColor: '#fbf8cf', noteBorderColor: '#a9a71a', noteTextColor: '#14181c',
    actorBkg: '#004669', actorBorder: '#004669', actorTextColor: '#ffffff', actorLineColor: '#9db4c0',
    signalColor: '#14181c', signalTextColor: '#14181c',
    labelBoxBkgColor: '#f2efe9', labelBoxBorderColor: '#6b7580', labelTextColor: '#14181c', loopTextColor: '#14181c',
    activationBkgColor: '#e0f5f5', activationBorderColor: '#00a2b1', sequenceNumberColor: '#ffffff',
    classText: '#14181c', stateBkg: '#e6f1f6', stateLabelColor: '#14181c',
    attributeBackgroundColorOdd: '#ffffff', attributeBackgroundColorEven: '#f2f7fa'
  },
  flowchart: { curve: 'basis', htmlLabels: true, padding: 16, nodeSpacing: 42, rankSpacing: 58, useMaxWidth: false },
  sequence: { useMaxWidth: false, mirrorActors: false, actorMargin: 26, messageMargin: 32, noteMargin: 10, boxMargin: 8, wrap: true, width: 140, height: 46, messageFontSize: 14.5, actorFontSize: 14.5, noteFontSize: 13.5 },
  class: { useMaxWidth: false },
  er: { useMaxWidth: false, fontSize: 15 },
  state: { useMaxWidth: false }
};

const pedidos = process.argv.slice(2);
const quiere = (n) => pedidos.length === 0 || pedidos.includes(n);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1800, height: 1200, deviceScaleFactor: 2.4 });
await page.setContent(`<html><body style="margin:0;background:#fff"><div id="c" style="display:inline-block;padding:18px;background:#fff"></div></body></html>`);
await page.addScriptTag({ content: readFileSync(path.join(AQUI, 'node_modules/mermaid/dist/mermaid.min.js'), 'utf8') });
await page.evaluate((t) => window.mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', ...t }), tema);

async function capturar(nombre) {
  const escala = nombre === 'portada' ? 1.6 : 2.4;
  await page.evaluate((n) => { document.getElementById('c').style.padding = n === 'portada' ? '0' : '18px'; }, nombre);
  const el = await page.$('#c');
  const caja = await el.boundingBox();
  await page.setViewport({ width: Math.ceil(caja.width) + 4, height: Math.ceil(caja.height) + 4, deviceScaleFactor: escala });
  await el.screenshot({ path: path.join(OUT, `${nombre}.png`) });
  console.log('ok', nombre, Math.round(caja.width), 'x', Math.round(caja.height));
}

const MERMAID_OK = [];
for (const [nombre, fuente] of Object.entries(diagramas)) {
  if (!quiere(nombre) || !MERMAID_OK.includes(nombre)) continue;
  try {
    const { svg } = await page.evaluate(async (n, f) => window.mermaid.render('g_' + n, f), nombre, fuente);
    await page.evaluate((s) => { document.getElementById('c').innerHTML = s; }, svg);
    await capturar(nombre);
  } catch (e) {
    console.error('FALLA', nombre, String(e.message || e).slice(0, 300));
  }
}

// SVG propios (mapas mentales, gantt, riesgos, portada) en ./svg/*.svg
const dirSvg = path.join(AQUI, 'svg');
if (existsSync(dirSvg)) {
  for (const f of readdirSync(dirSvg).filter((x) => x.endsWith('.svg') || x.endsWith('.html'))) {
    const nombre = f.replace(/\.(svg|html)$/, '');
    if (!quiere(nombre)) continue;
    const contenido = readFileSync(path.join(dirSvg, f), 'utf8');
    await page.evaluate((s) => { document.getElementById('c').innerHTML = s; }, contenido);
    await capturar(nombre);
  }
}
await browser.close();
