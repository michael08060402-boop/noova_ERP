import { Document, Packer, Paragraph, TextRun, AlignmentType, LevelFormat, ImageRun } from 'docx';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { F, K, GEO, P, H1, H2, bullets, tbl, caja, imagen, cabeceras, propsSeccion, runs } from './lib2.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const OUT = (n) => path.join(AQUI, 'out', n + '.png');
const LOGO = 'C:/Users/Hostos/Desktop/noova-erp - copia/src/assets/noova-logo.png';
const mapas = JSON.parse(readFileSync(path.join(AQUI, 'mapas.json'), 'utf8'));
const SALIDA = process.argv[2] || path.join(AQUI, 'Noova-Marketing-Documentacion.docx');

// ---------- secciones ----------
const secciones = [];
let actual = null;
let fresco = false;
function ir(geo) { if (!actual || actual.geo !== geo) { actual = { geo, children: [] }; secciones.push(actual); fresco = true; } }
function add(...els) { for (const e of els.flat()) actual.children.push(e); fresco = false; }
const nuevaHoja = () => !fresco;

let nDiag = 0;
function fig(nombre, titulo, { maxH, tope = 1.1, antes = 60 } = {}) {
  nDiag += 1;
  const g = GEO[actual.geo];
  const mh = maxH ?? (actual.geo === 'landscape' ? 540 : 700);
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: antes, after: 60 }, children: [imagen(OUT(nombre), g.px, mh, { tope, alt: titulo })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 140 }, children: [new TextRun({ text: `Diagrama ${nDiag}. ${titulo}`, font: F, size: 17, italics: true, color: K.gris })] }),
  ];
}
function seccion(num, titulo, { salto = true } = {}) {
  const corta = salto && nuevaHoja();
  return H1(`${num}. ${titulo}`, { pageBreakBefore: corta, before: salto ? 0 : 320 });
}

const AZ = '8DB9D3', AM = 'FFD84D';
const fila = (nombre, azul, estado, amarillo = []) => [nombre, ...Array.from({ length: 9 }, (_, i) => ({ t: '', fill: amarillo.includes(i) ? AM : (azul.includes(i) ? AZ : 'FFFFFF') })), estado];

// ================== PORTADA ==================
const portada = { geo: 'portada', children: [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 700, after: 360 }, children: [new ImageRun({ type: 'png', data: readFileSync(LOGO), transformation: { width: 205, height: 145 }, altText: { title: 'Noova Consulting', description: 'Logo', name: 'logo' } })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: 'CONTRATISTAS GENERALES NOOVA S.A.C.', font: F, bold: true, size: 19 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 280 }, children: [new TextRun({ text: 'ÁREA DE SISTEMAS', font: F, bold: true, size: 23 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'PLANIFICACIÓN Y DOCUMENTACIÓN DEL PROYECTO', font: F, italics: true, size: 17, color: K.gris })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120, line: 360 }, children: [new TextRun({ text: 'MARKETING AUTOMATIZADO DE NOOVA', font: F, bold: true, size: 44 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [new TextRun({ text: 'Un equipo de marketing automatizado que reemplaza al personal de marketing', font: F, size: 23 })] }),
  tbl({ cols: [2600, 5600], size: 18, rows: [
    [{ t: 'Empresa', bold: true, fill: 'F2F2F2' }, 'Contratistas Generales Noova S.A.C.'],
    [{ t: 'Responsable(s)', bold: true, fill: 'F2F2F2' }, 'Michael Guido Roman Lugo\nLuis Angel Hostos Hostos'],
    [{ t: 'Solicitante / líder', bold: true, fill: 'F2F2F2' }, 'Ing. Alfredo León Landeo\nIng. Elena Mendoza'],
    [{ t: 'Fecha de inicio', bold: true, fill: 'F2F2F2' }, '30/10/2026'],
    [{ t: 'Versión del documento', bold: true, fill: 'F2F2F2' }, '1.1'],
    [{ t: 'Estado', bold: true, fill: 'F2F2F2' }, 'Primera versión hecha · Segunda versión en planificación'],
  ] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 500, after: 40 }, children: [new TextRun({ text: 'Lima - Perú', font: F, size: 19, color: K.gris })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '2026', font: F, size: 19, color: K.gris })] }),
] };
secciones.push(portada);

// ================== CONTENIDO ==================
ir('portrait');
add(
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 300 }, children: [new TextRun({ text: 'TABLA DE CONTENIDO', font: F, bold: true, size: 26 })] }),
  ...['1. DEFINICIÓN DEL PROYECTO', '2. PLAZO Y CRONOGRAMA', '3. QUÉ SE HA HECHO Y QUÉ FALTA', '4. CÓMO FUNCIONA', '5. DISEÑOS QUE MEJORAN SOLOS',
    '6. IMÁGENES Y VIDEOS HECHOS A MANO', '7. ESTUDIO SEMANAL Y MONITOREO DE REDES', '8. NOOVA HOY EN REDES Y CRECIMIENTO ESPERADO', '9. DECISIONES', '10. RIESGOS', '11. PRÓXIMOS PASOS',
    '', 'ANEXO A. DIAGRAMAS DE APOYO', 'ANEXO B. DIAGRAMAS TÉCNICOS', 'ANEXO C. GLOSARIO Y FUENTES'].map((t) => new Paragraph({ spacing: { before: 0, after: 110 }, children: [new TextRun({ text: t, font: F, size: 20 })] })),
);

// ================== 1. DEFINICIÓN ==================
add(seccion('1', 'Definición del proyecto'));
add(
  H2('1.1 Qué necesitamos'),
  P('Noova no tiene a nadie dedicado al marketing. Las redes casi no se mueven: la cuenta de LinkedIn con más actividad publica de 1 a 3 veces al mes. Ya hay una primera versión hecha: reglas de marca, banco de fotos, 19 diseños y un módulo en el ERP donde se revisan los borradores. Falta lo que viene después de revisar: aprobar, publicar, vigilar las redes y medir.'),
  H2('1.2 Objetivo final'),
  caja(null, ['**Un equipo de marketing automatizado que reemplace al personal de marketing.**', 'El sistema planifica, crea, publica, vigila las redes, mide y aprende. Una persona supervisa unas pocas horas por semana. Todo se aprueba y se ve dentro de una sola sección del ERP: Marketing.']),
  H2('1.3 Niveles de automatización'),
  tbl({ cols: [2300, 4000, 3338], head: ['Nivel', 'Qué hace el sistema', 'Qué hace una persona'], size: 17, rows: [
    [{ t: '**0 · Hoy**', align: AlignmentType.CENTER }, 'Redacta borradores y los muestra en el ERP.', 'Aprobar, publicar y medir, a mano.'],
    [{ t: '**1 · Versión final**\n31/12/2026', align: AlignmentType.CENTER }, 'Prepara, programa, vigila las redes y mide.', 'Aprueba en el ERP y edita a mano.'],
    [{ t: '**2 · Automatizado con supervisión**\nDesde marzo 2027', align: AlignmentType.CENTER, fill: 'E7F3F7' }, { t: 'Propone el plan, crea el lote de la semana, publica lo aprobado y mejora con los resultados.', fill: 'E7F3F7' }, { t: 'Revisa y aprueba el lote. Graba en campo.', fill: 'E7F3F7' }],
  ] }),
  H2('1.4 Alcance'),
  P('**Incluye**', { after: 40 }),
  ...bullets([
    'Piezas para LinkedIn, Facebook, Instagram, TikTok y YouTube: imagen, carrusel y video corto.',
    'Aprobación dentro del ERP, con registro de quién aprobó, qué texto y cuándo.',
    'Biblioteca de diseños que crece con los diseños que sube el equipo.',
    'Monitoreo de redes con números reales, estudio semanal del sector y balance mensual.',
  ], { after: 60 }),
  P('**Queda fuera**', { after: 40 }),
  ...bullets(['Anuncios pagados.', 'La página web y su posicionamiento en buscadores.'], { after: 60 }),
  P('**Sigue en manos de personas**', { after: 40 }),
  ...bullets(['Grabar y fotografiar en campo.', 'Responder comentarios y mensajes.', 'Aprobar lo que se publica.'], { after: 80 }),
  H2('1.5 Quiénes participan'),
  tbl({ cols: [3100, 2700, 3838], head: ['Persona', 'Papel', 'Qué hace'], size: 17, rows: [
    ['Alfredo León Landeo, Elena Mendoza', 'Gerencia', 'Solicitan el proyecto. Elena puede ayudar si el sistema es intuitivo.'],
    ['Michael Roman, Luis Hostos', 'Sistemas y marketing', 'Construyen el sistema y hoy llevan el marketing, incluida la edición a mano.'],
    ['Christian Pimentel', 'Operador de marketing', 'Apoya de forma intermitente.'],
    ['Lesli', 'Posible apoyo', 'Sin estimar todavía.'],
    ['Por definir', 'Aprobador', 'Aprueba cada pieza dentro del ERP.'],
    ['Claude', 'Asistente de IA', 'Redacta, estudia el sector y propone. No decide por su cuenta.'],
  ] }),
);

// ================== 2. PLAZO ==================
add(seccion('2', 'Plazo y cronograma'));
add(
  caja(null, ['**Construcción: 2 meses, del 30/10/2026 al 31/12/2026.**', 'Balance de crecimiento: 31/01/2027, a 30 días de la versión final.']),
  H2('2.1 Hitos'),
  tbl({ cols: [4700, 1500, 2000, 1438], head: ['Hito', 'Fecha', 'Responsable', 'Estado'], size: 17, rows: [
    ['Marketing en una sola sección con Publicaciones y Monitoreo (falta desplegar)', '30/10/2026', 'Michael / Luis', 'Parcial'],
    ['Se aprueba dentro del ERP (listo en el código, falta desplegar)', '13/11/2026', 'Michael / Luis', 'Parcial'],
    ['Se suben versiones hechas a mano (imágenes y PDF listos; videos pendientes)', '27/11/2026', 'Michael / Luis', 'Parcial'],
    ['Se elige y previsualiza el diseño, y se sube uno nuevo (elegir y otro boceto listos)', '11/12/2026', 'Michael / Luis', 'Parcial'],
    ['Se programa y publica desde el ERP (copiar texto y marcar publicada listos; «Programar» solo diseño)', '24/12/2026', 'Michael / Luis', 'Parcial'],
    ['Versión final probada', '31/12/2026', 'Michael / Luis', 'Pendiente'],
    ['Balance: cuánto creció cada cuenta en 30 días', '31/01/2027', 'Michael / Luis', 'Pendiente'],
  ] }),
  H2('2.2 Cronograma'),
  tbl({ cols: [3340, 560, 560, 560, 560, 560, 560, 560, 560, 718, 1000], size: 15,
    head: ['Actividad', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'Ene', 'Estado'],
    rows: [
      fila('Monitoreo de redes en Marketing', [1, 2], 'Parcial', [0]),
      fila('Aprobar dentro del ERP', [0, 1, 2], 'Pendiente'),
      fila('Hacer piezas a mano: subir versión y video', [2, 3, 4], 'Pendiente'),
      fila('Diseños: previsualizar, otro boceto, subir uno nuevo', [4, 5, 6], 'Pendiente'),
      fila('Programar y publicar', [5, 6, 7], 'Pendiente'),
      fila('Estudio semanal del sector', [1, 2, 3, 4, 5, 6, 7], 'Pendiente'),
      fila('Pruebas y ajustes', [6, 7], 'Pendiente'),
      fila('Balance de crecimiento', [8], 'Pendiente'),
    ] }),
  P('S1 empieza el 2 de noviembre; cada columna es una semana. Azul: planificado. Amarillo: en curso.', { size: 17, color: K.gris, before: 40 }),
);

// ================== 3. QUÉ SE HA HECHO ==================
add(seccion('3', 'Qué se ha hecho y qué falta'));
add(
  H2('3.1 Resumen'),
  tbl({ cols: [2100, 4500, 1300, 1738], head: ['Área', 'Qué hay', 'Estado', 'Falta'], size: 16, rows: [
    ['**Planificar**', '7 temas con fuente, calendario de noviembre y 14 borradores.', 'Completado', 'Plan según resultados'],
    ['**Primera versión**', 'Fábrica de piezas y módulo Publicaciones del ERP.', 'Completado', '—'],
    ['**Crear piezas**', '135 fotos con permiso aceptado y textos con datos aprobados.', 'Parcial', 'Banco de frases'],
    ['**Biblioteca de diseños**', '19 diseños de prueba con rotación (no son los finales), manual de marca y un video corporativo de referencia hecho por marketing hace un mes.', 'Parcial', 'Subir, previsualizar, elegir por resultados'],
    ['**Piezas a mano**', 'Reglas de estilo, guía de video, descargar paquete y subir versión editada.', 'Parcial', 'Videos'],
    ['**Aprobar**', 'Vista previa por red, edición, comentarios, botón Aprobar y Devolver con historial.', 'Parcial', 'Desplegar y probar'],
    ['**Programar y publicar**', 'Acceso a LinkedIn y Facebook. Panel «Próximas a publicar», copiar texto y marcar publicada.', 'Parcial', 'Buffer o API, Instagram, TikTok, YouTube'],
    ['**Monitoreo de redes**', 'Pestaña nueva en Marketing con los números reales del 30/10 y actualización en vivo.', 'Parcial', 'Desplegar y conectar cuentas'],
    ['**Estudio semanal**', 'Prompt listo.', 'Pendiente', 'Crear la rutina'],
    ['**Medir y aprender**', 'Enlaces con etiquetas previstos.', 'Pendiente', 'Balance mensual'],
  ] }),
  H2('3.2 Pendientes de construcción'),
  tbl({ cols: [450, 3600, 3588, 2000], head: ['N.°', 'Qué hay que hacer', 'Dónde', 'Estado'], size: 16, rows: [
    ['1', 'Botón Aprobar y Devolver con historial: hecho. Falta desplegar y probar con una pieza real.', 'marketingAprobar, marketingDevolver, ModalAprobar', 'Parcial'],
    ['2', 'TikTok en el botón Generar: hecho. El folleto no se puede pedir desde el ERP: su red es «impreso».', 'ModalGenerarPieza, marketingPiezas.js', 'Parcial'],
    ['3', 'Previsualizar el diseño y generar otro boceto: hecho, con la entrada `variante` en el workflow. Falta probarlo.', 'Modal Generar y generar-pieza.yml', 'Parcial'],
    ['4', 'Descargar el paquete y subir la versión editada: hecho para imagen y PDF. Los videos serán piezas nuevas.', 'ModalTaller y funciones del taller', 'Parcial'],
    ['5', 'Subir un diseño nuevo y convertirlo en plantilla.', 'Pestaña Diseños y catálogo de variantes', 'Pendiente'],
    ['6', 'Publicar con ayuda (copiar texto y marcar publicada): hecho. «Programar» está como diseño. Falta conectar Buffer o las redes por API.', 'VistaPreviaPost, ModalPublicada', 'Parcial'],
    ['7', 'Desplegar monitoreo y aprobación: funciones, reglas de Firestore y hosting.', 'firebase deploy', 'Parcial'],
    ['8', 'Cargar los secretos de YouTube y Meta (y el id de Instagram) para el monitoreo automático.', 'firebase functions:secrets:set', 'Pendiente'],
    ['9', 'Dar a Michael y Luis un rol que permita operar Marketing (soporte TI solo lee).', 'Usuarios del ERP', 'Pendiente'],
    ['10', 'Guardar el historial de rotación fuera de la caché de GitHub Actions.', 'Repositorio de marketing', 'Pendiente'],
  ] }),
);

// ================== 4. CÓMO FUNCIONA ==================
ir('landscape');
add(
  H1('4. Cómo funciona', { pageBreakBefore: false }),
  ...fig('flujo_simple', 'Los seis pasos de una pieza. Lo que aprendemos mejora la siguiente.', { maxH: 500 }),
);
add(
  H2('4.1 Mapa mental: lo que tenemos hoy', { before: 0, pageBreakBefore: true }),
  ...fig('mapa_hoy', 'Azul: ya existe. Amarillo: a medias. Coral punteado: falta.', { maxH: 545, tope: 1.0 }),
);
add(
  H2('4.2 Mapa mental: lo que tendremos', { before: 0, pageBreakBefore: true }),
  ...fig('mapa_futuro', 'Las mismas ramas con el proyecto cumplido.', { maxH: 545, tope: 1.0 }),
);

// ================== 5. DISEÑOS ==================
add(
  H1('5. Diseños que mejoran solos', { pageBreakBefore: true }),
  ...fig('flujo_disenos', 'De un diseño subido por el equipo a la rotación, con los resultados como guía.', { maxH: 500 }),
);
add(
  H2('5.1 Elegir el diseño y generar otro boceto', { before: 0, pageBreakBefore: true }),
  ...fig('pantalla_boceto', 'Propuesta para el botón Generar: previsualizar el diseño elegido y pedir otro boceto.', { maxH: 420, antes: 20 }),
  ...bullets([
    '**Previsualizar:** antes de generar se ve una imagen real del diseño, a la derecha del formulario.',
    '**Los diseños actuales son de prueba.** Sirven para validar la interfaz; los finales los hará el equipo y se subirán con «Subir un diseño nuevo».',
    '**Otro boceto:** cambia el diseño y las fotos; el tema y el texto base se conservan.',
    '**Plantilla desde un diseño subido:** copia la estructura y el estilo, no el archivo punto por punto. Con un archivo editable queda más fiel que con un JPG.',
  ], { after: 40 }),
);

// ================== 6. A MANO ==================
ir('portrait');
add(seccion('6', 'Imágenes y videos hechos a mano'));
add(
  P('Las piezas deben verse hechas por personas de Noova. El sistema entrega la materia prima y las manos dan el criterio.', { after: 100 }),
  tbl({ cols: [1300, 4169, 4169], head: ['', 'El sistema entrega', 'La persona aporta'], size: 17, rows: [
    [{ t: '**Imagen**', fill: 'F2F2F2' }, 'Foto autorizada, diseño, texto base y el archivo editable.', 'Recorte, luz, grano y composición.'],
    [{ t: '**Video**', fill: 'F2F2F2' }, 'Guion de 30 a 40 s, lista de tomas y música sin derechos.', 'Grabación, ritmo y versiones horizontal y vertical.'],
    [{ t: '**Texto**', fill: 'F2F2F2' }, 'Tres variantes con datos aprobados.', 'Elegir una y pasarla a voz de campo.'],
  ] }),
  H2('6.1 Seis preguntas antes de subir una pieza'),
  tbl({ cols: [450, 4400, 4788], size: 17, rows: [
    ['1', '**¿La foto cuenta algo que pasó de verdad?**', 'Si no, lleva «Imagen ilustrativa».'],
    ['2', '**¿Se ve distinta a las últimas tres?**', 'Repetir el esquema la vuelve de plantilla.'],
    ['3', '**¿Se entiende de una mirada en el celular?**', 'Una foto, un titular, un dato.'],
    ['4', '**¿Sobra algo?**', 'Barras, líneas, pastillas, íconos de relleno.'],
    ['5', '**¿Suena a una persona de campo?**', 'Sin adjetivos vacíos.'],
    ['6', '**¿Se usó una foto con permiso?**', 'Los permisos del banco están aceptados.'],
  ] }),
  ...fig('taller_imagen', 'Taller de imagen.', { maxH: 230, tope: 1.0, antes: 140 }),
  ...fig('taller_video', 'Taller de video.', { maxH: 330, tope: 1.0, antes: 20 }),
);

// ================== 7. ESTUDIO Y MONITOREO ==================
add(seccion('7', 'Estudio semanal y monitoreo de redes', { salto: false }));
add(
  H2('7.1 Estudio semanal del sector minero'),
  P('Cada lunes, una rutina de Claude deja un informe de una página: cifras de la semana, noticias del sector, qué formatos funcionan en 2026 y cómo redactar para empresas mineras, con 3 temas propuestos. El prompt está en `docs/marketing/investigacion-noova-actual.md` y corre con la cuenta de Claude que ya tiene Noova.'.replace(/`/g, ''), { after: 80 }),
  H2('7.2 Monitoreo de redes dentro de Marketing'),
  ...bullets([
    '**Una sola pantalla, sin pestañas:** el tablero de las redes va arriba, con los borradores por revisar, y debajo están todas las piezas.',
    '**Automático:** una función lee las cuentas cada día a las 7:00 con las APIs oficiales de cada red. El botón «Actualizar redes» hace la misma lectura a pedido. No se escribe ningún número a mano.',
    '**Con números reales:** parte de las cifras leídas el 30/10/2026 y compara cada cuenta con su meta a 30 días; el gráfico se mueve en el tiempo hasta el 31/01/2027.',
    '**Estado de cada conexión:** cada cuenta dice si está Automática, con Conexión pendiente, Sin API o con Error de lectura.',
    '**Límites de hoy:** YouTube, Facebook e Instagram dependen de una clave o token (y del id de Instagram). El perfil de LinkedIn no tiene API, la página de empresa de LinkedIn y TikTok exigen acceso aprobado; esas tres se quedan en el punto de partida hasta tenerlo. No se leen páginas públicas ni se simula un navegador.',
  ], { after: 60 }),
);
ir('landscape');
add(
  H2('7.3 La pantalla de Marketing', { before: 0 }),
  ...fig('pantalla_marketing', 'El tablero de Marketing: cuentas, indicadores, evolución y audiencia (datos de ejemplo).', { maxH: 500 }),
);
add(
  H2('7.4 Cómo se junta el monitoreo', { before: 0, pageBreakBefore: true }),
  ...fig('monitoreo', 'Datos de las cuentas propias y del sector que mejoran el plan y los diseños.', { maxH: 530 }),
);

// ================== 8. NOOVA HOY ==================
ir('portrait');
add(seccion('8', 'Noova hoy en redes y crecimiento esperado'));
add(
  P('Números leídos el 30/10/2026 de forma pública. Hay dos LinkedIn: el **perfil** (`/in/`) tiene movimiento y la **página** de empresa está detenida desde hace 10 meses.'.replace(/`/g, ''), { after: 100 }),
  H2('8.1 Punto de partida'),
  tbl({ cols: [3200, 1500, 3238, 1700], head: ['Cuenta', 'Seguidores', 'Movimiento', 'Acceso'], size: 16, rows: [
    ['**LinkedIn · perfil**', '5.308', 'Última publicación hace 1 semana', 'Sí'],
    ['LinkedIn · página', '3.700', 'Última publicación hace 10 meses', 'Sí'],
    ['**Facebook**', '7.600', 'Convocatorias de personal', 'Sí'],
    ['Instagram', '552', '244 publicaciones', 'No'],
    ['TikTok', '1.279', '16 videos, hasta 1.175 vistas', 'No'],
    ['YouTube', '159', '35 videos de hace 2 a 3 años', 'No'],
    [{ t: '**Total**', fill: 'F2F2F2' }, { t: '**18.598**', fill: 'F2F2F2' }, { t: '16.608 en las cuentas con acceso', fill: 'F2F2F2' }, { t: '', fill: 'F2F2F2' }],
  ] }),
  H2('8.2 Crecimiento esperado a 30 días de la versión final'),
  P('Estimación propia, suponiendo el ritmo acordado de publicación y la cuenta conectada. No es una medición.', { after: 80 }),
  tbl({ cols: [2800, 1500, 1500, 1500, 2338], head: ['Cuenta', 'Conservador', 'Esperado', 'Optimista', 'Seguidores esperados'], size: 16, rows: [
    ['LinkedIn · perfil', '+0,8 %', '**+2 %**', '+4 %', '+106'],
    ['LinkedIn · página', '+0,3 %', '**+1 %**', '+2 %', '+37'],
    ['Facebook', '+0,3 %', '**+1 %**', '+2 %', '+76'],
    ['Instagram', '+2 %', '**+5 %**', '+9 %', '+28'],
    ['TikTok', '+3 %', '**+8 %**', '+15 %', '+102'],
    ['YouTube', '+1 %', '**+3 %**', '+6 %', '+5'],
    [{ t: '**Con acceso hoy (3 cuentas)**', fill: 'F2F2F2' }, { t: '', fill: 'F2F2F2' }, { t: '**+1,3 %**', fill: 'F2F2F2' }, { t: '', fill: 'F2F2F2' }, { t: '**+219**', fill: 'F2F2F2' }],
    [{ t: '**Las 6 cuentas**', fill: 'F2F2F2' }, { t: '', fill: 'F2F2F2' }, { t: '**+1,9 %**', fill: 'F2F2F2' }, { t: '', fill: 'F2F2F2' }, { t: '**+354**', fill: 'F2F2F2' }],
  ] }),
  ...bullets([
    'Las cuentas grandes crecen poco en un mes: un punto son 50 a 76 personas.',
    'Las chicas suben más en porcentaje (TikTok, Instagram), pero necesitan acceso y constancia.',
    'Lo que más cambia en el primer mes es la frecuencia: de 1 a 3 publicaciones al mes en LinkedIn a unas 8.',
    'El alcance no se puede estimar hasta tener las estadísticas de administrador de los primeros 30 días.',
  ], { after: 60 }),
  P('Detalle de la investigación y el prompt de automatización: `docs/marketing/investigacion-noova-actual.md`.'.replace(/`/g, ''), { size: 17, color: K.gris, before: 40 }),
);

// ================== 9. DECISIONES ==================
add(seccion('9', 'Decisiones'));
add(
  H2('9.1 Decididas', { before: 0 }),
  tbl({ cols: [3000, 6638], head: ['Tema', 'Decisión'], size: 17, rows: [
    ['Dónde se aprueba', 'Todo se aprueba dentro de la sección Marketing del ERP.'],
    ['Presupuesto', 'Se mantiene en cero en lo que sea necesario.'],
    ['Repositorio', 'Git con GitHub Actions, como está.'],
    ['Accesos', 'Hay acceso a LinkedIn y Facebook. Instagram, TikTok y YouTube aún no.'],
    ['Fotos', 'Los permisos están aceptados: se usan todas las del banco.'],
    ['LinkedIn principal', 'El perfil con 5.308 seguidores, que es el que tiene movimiento.'],
  ] }),
  H2('9.2 Por definir'),
  tbl({ cols: [450, 5588, 2000, 1600], head: ['N.°', 'Pendiente', 'Quién', 'Estado'], size: 16, rows: [
    ['1', 'Quién aprueba cada pieza en el ERP.', 'Gerencia / sistemas', 'Por decidir'],
    ['2', 'Cuándo llega el acceso a Instagram, TikTok y YouTube.', 'Sistemas', 'Pendiente'],
    ['3', 'Reactivar la página de empresa de LinkedIn o dejar solo el perfil.', 'Sistemas', 'Por decidir'],
    ['4', 'Cuánto tiempo puede dedicar Christian Pimentel y quién más apoya.', 'Sistemas', 'Por decidir'],
  ] }),
);

// ================== 10. RIESGOS ==================
add(seccion('10', 'Riesgos', { salto: false }));
add(
  tbl({ cols: [2400, 4338, 1600, 1300], head: ['Riesgo', 'Qué hacemos', 'Quién', 'Nivel'], size: 16, rows: [
    ['**Poco tiempo del equipo**', 'Medir las horas reales las primeras 4 semanas y empezar con un solo formato fuerte por semana.', 'Michael / Luis', 'Alto'],
    ['**Contenido que se ve genérico**', 'Taller a mano, seis preguntas y diseños nuevos del equipo.', 'Michael / Luis', 'Alto'],
    ['**Sin acceso a Instagram, TikTok y YouTube**', 'Producir igual y publicar donde ya hay acceso.', 'Sistemas', 'Medio'],
    ['**Dos LinkedIn con el mismo nombre**', 'Decidir cuál es el principal y avisarlo.', 'Sistemas', 'Medio'],
    ['**Cifras de partida de lectura pública**', 'Reemplazarlas por las estadísticas de administrador al primer mes.', 'Michael / Luis', 'Bajo'],
  ] }),
);

// ================== 11. PRÓXIMOS PASOS ==================
add(seccion('11', 'Próximos pasos', { salto: false }));
add(
  tbl({ cols: [1700, 5638, 1500, 800], head: ['Cuándo', 'Qué', 'Quién', 'Estado'], size: 16, rows: [
    ['Esta semana', 'Desplegar monitoreo y aprobación (funciones, reglas de Firestore y hosting).', 'Michael / Luis', 'Pendiente'],
    ['Esta semana', 'Dar un rol que permita operar Marketing y cargar los primeros números.', 'Michael / Luis', 'Pendiente'],
    ['Hasta el 13/11', 'Probar Aprobar y Devolver con una pieza real y decidir quién aprueba.', 'Michael / Luis', 'Pendiente'],
    ['Cada lunes', 'Correr el estudio semanal y cargar las cifras.', 'Michael / Luis', 'Pendiente'],
  ] }),
);

// ================== ANEXO A ==================
ir('landscape');
add(
  H1('Anexo A. Diagramas de apoyo', { pageBreakBefore: nuevaHoja() }),
  P('Estos diagramas explican el proyecto desde otros ángulos. Se pueden leer en cualquier orden.', { align: AlignmentType.CENTER, after: 60 }),
  H2('A.1 Quién toca qué', { before: 0 }),
  ...fig('contexto', 'El sistema en su entorno: personas, servicios y redes.', { maxH: 450 }),
);
add(
  H2('A.2 Flujo actual', { before: 0, pageBreakBefore: true }),
  ...fig('flujo_hoy', 'Del pedido a la publicación hoy. En coral, lo que falta.', { maxH: 530 }),
);
add(
  H2('A.3 Flujo futuro', { before: 0, pageBreakBefore: true }),
  ...fig('flujo_objetivo', 'El ciclo completo: cada vuelta termina en un informe que ajusta la siguiente.', { maxH: 520 }),
);
add(
  H2('A.4 Matriz de riesgos', { before: 0, pageBreakBefore: true }),
  ...fig('riesgos', 'Cuanto más arriba y a la derecha, más urgente.', { maxH: 530 }),
);
add(
  H2('A.5 Indicadores', { before: 0, pageBreakBefore: true }),
  ...fig('kpis', 'Árbol de indicadores y de dónde sale cada dato.', { maxH: 540 }),
);
ir('portrait');
add(
  H2('A.6 Casos de uso actuales', { before: 0 }),
  ...fig('casos_hoy', 'Quién hace qué hoy en el módulo Publicaciones.', { maxH: 780, antes: 20 }),
);
add(
  H2('A.7 Casos de uso futuros (1 de 2)', { before: 0, pageBreakBefore: true }),
  ...fig('casos_futuro_a', 'Crear, mejorar los diseños, trabajar a mano y aprobar.', { maxH: 880, antes: 10 }),
);
add(
  H2('A.8 Casos de uso futuros (2 de 2)', { before: 0, pageBreakBefore: true }),
  ...fig('casos_futuro_b', 'Publicar, vigilar las redes, medir y aprender.', { maxH: 880, antes: 10 }),
);
add(
  H2('A.9 Estados de una publicación', { before: 0, pageBreakBefore: true }),
  P('Hoy el estado es un texto libre. Proponemos estados fijos para que nada se borre ni se publique por error.', { after: 80 }),
  ...fig('estados', 'Por qué estados pasa una pieza. Editar siempre anula la aprobación.', { maxH: 560 }),
);

// ================== ANEXO B ==================
ir('landscape');
add(
  H1('Anexo B. Diagramas técnicos', { pageBreakBefore: nuevaHoja() }),
  P('Para el equipo que construye. Quien solo lee el plan puede saltarlos.', { align: AlignmentType.CENTER, after: 60 }),
  H2('B.1 Arquitectura actual', { before: 0 }),
  ...fig('arquitectura_hoy', 'Piezas que funcionan hoy y cómo se conectan.', { maxH: 430 }),
);
add(
  H2('B.2 Arquitectura objetivo', { before: 0, pageBreakBefore: true }),
  ...fig('arquitectura_objetivo', 'Lo nuevo va en turquesa; el resto se reutiliza.', { maxH: 545 }),
);
add(
  H2('B.3 Clases', { before: 0, pageBreakBefore: true }),
  ...fig('clases', 'Los objetos principales y cómo se relacionan.', { maxH: 545 }),
);
add(
  H2('B.4 Datos en Firestore', { before: 0, pageBreakBefore: true }),
  ...fig('datos_firestore', 'Colecciones propuestas. Solo las observaciones existen hoy.', { maxH: 545 }),
);
ir('portrait');
add(
  H2('B.5 Secuencia: generar una pieza', { before: 0 }),
  ...fig('sec_generar', 'Qué pasa cuando alguien pulsa Generar.', { maxH: 820, antes: 20 }),
);
add(
  H2('B.6 Secuencia: descargar, editar y subir', { before: 0, pageBreakBefore: true }),
  ...fig('sec_taller', 'La versión editada vuelve a revisión.', { maxH: 780, antes: 20 }),
);
add(
  H2('B.7 Secuencia: aprobar, programar y publicar', { before: 0, pageBreakBefore: true }),
  ...fig('sec_aprobar', 'Los tres caminos para publicar.', { maxH: 800, antes: 20 }),
);
add(
  H2('B.8 Secuencia: medir y aprender', { before: 0, pageBreakBefore: true }),
  ...fig('sec_medir', 'Ciclo semanal y mensual.', { maxH: 760, antes: 20 }),
);

// ================== ANEXO C ==================
add(
  H1('Anexo C. Glosario y fuentes', { pageBreakBefore: true }),
  H2('Glosario', { before: 60 }),
  tbl({ cols: [2600, 7038], head: ['Palabra', 'Qué significa'], size: 17, rows: [
    ['**ERP**', 'El sistema de Noova donde está el módulo Publicaciones.'],
    ['**Fábrica de piezas**', 'El conjunto de reglas, plantillas y programas que prepara cada borrador.'],
    ['**Carpeta compartida**', 'SharePoint: donde se guardan las piezas y sus textos.'],
    ['**Pieza**', 'Una publicación: imagen, carrusel o video, con su texto.'],
    ['**Línea base**', 'La foto de las cifras de hoy, contra la que se compara todo lo demás.'],
    ['**Plantilla / diseño**', 'La estructura visual de una pieza, con espacios para foto, titular, dato y logo.'],
    ['**Regla 1**', 'Regla del repositorio de marketing: nada se publica sin aprobación humana, pieza por pieza.'],
  ] }),
  H2('Fuentes y límites'),
  P('Este plan sale del código del ERP, del repositorio de marketing y de la lectura pública de las cuentas de Noova el 30/10/2026.', { after: 80 }),
  ...bullets([
    'No hay cifras de alcance ni de clics: eso exige entrar como administrador de cada cuenta.',
    'Instagram, TikTok y YouTube se leyeron de forma pública; no hay acceso todavía.',
    'Los requisitos de Buffer, Meta, LinkedIn y TikTok vienen de la documentación del repositorio y de memoria: hay que confirmarlos.',
    'El crecimiento esperado y el tiempo de supervisión son estimaciones propias.',
  ]),
);

// ================== ENSAMBLE ==================
const doc = new Document({
  creator: 'Noova Consulting', title: 'Marketing automatizado de Noova', description: 'Planificación y documentación del proyecto',
  styles: {
    default: { document: { run: { font: F, size: 20, color: K.texto } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: F, size: 26, bold: true }, paragraph: { spacing: { before: 0, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: F, size: 21, bold: true, color: K.teal }, paragraph: { spacing: { before: 220, after: 90 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 240 } } } }] }] },
  sections: secciones.map((s) => {
    if (s.geo === 'portada') return { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 900, bottom: 900, left: 1800, right: 1800 } } }, children: s.children };
    return { properties: propsSeccion(s.geo), ...cabeceras(s.geo, LOGO), children: s.children };
  }),
});
const buf = await Packer.toBuffer(doc);
writeFileSync(SALIDA, buf);
console.log('Escrito', SALIDA, (buf.length / 1024).toFixed(0) + ' KB', 'diagramas:', nDiag);
