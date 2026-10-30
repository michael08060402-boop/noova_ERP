// Capturas de pantalla del harness: node captura.mjs nombre "?query" [ancho] [alto]
import puppeteer from 'puppeteer-core';
const [, , nombre, consulta = '', ancho = '1280', alto = '900'] = process.argv;
const navegador = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
const pagina = await navegador.newPage();
const errores = [];
pagina.on('pageerror', (e) => errores.push(String(e.message).slice(0, 200)));
pagina.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 200)); });
await pagina.setViewport({ width: Number(ancho), height: Number(alto), deviceScaleFactor: 1 });
await pagina.goto(`http://localhost:5199/.harness/index.html${consulta}`, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2200));
const salida = `C:/Users/Hostos/AppData/Local/Temp/claude/C--Users-Hostos-Desktop-noova-erp---copia/205e43c0-e244-4d7d-85dd-f70548552bdb/scratchpad/cap-${nombre}.png`;
await pagina.screenshot({ path: salida, fullPage: true });
console.log(salida, errores.length ? 'ERRORES: ' + errores.join(' | ') : 'sin errores');
await navegador.close();
