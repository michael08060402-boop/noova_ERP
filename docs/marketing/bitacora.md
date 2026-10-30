# Bitácora del proyecto Marketing

Cada avance se anota aquí con **qué se hizo**, **cómo se hizo**, **cómo se verificó** y **qué falta**. Lo más reciente va arriba.
Estado de despliegue: lo anterior al 2026-10-30 en la tarde está pendiente de desplegar; Luis indicó que dará el deploy. Cada vez que se despliegue, anotarlo aquí.

> **Importante: los diseños actuales son de prueba.** Los 17 diseños del catálogo, sus imágenes de previsualización (`public/disenos/`) y el texto y las fotos de muestra se usan solo para probar la interfaz. **No son los diseños finales.** Los finales los hará el equipo (o marketing) y se subirán con el flujo «Subir un diseño nuevo». Cuando existan, hay que regenerar o reemplazar las imágenes de `public/disenos/`.

## Avance de la construcción (al 2026-10-30)
Porcentaje estimado por área: lo que ya está **escrito en el código y con pruebas**, sin contar el despliegue ni la prueba en producción.

| Área | Avance | Qué falta |
|---|---|---|
| Aprobar, devolver e historial | 85 % | Desplegar y probar con una pieza real; decidir quién aprueba |
| Tablero y monitoreo de redes | 75 % | Desplegar; cargar los secretos (YouTube, Meta); LinkedIn perfil y TikTok no se pueden automatizar hoy |
| Taller manual | 60 % | Videos (la opción ya está en «Generar pieza» como «Próximamente»); probar la subida en SharePoint real |
| Diseños | 55 % | Subir un diseño nuevo y convertirlo en plantilla; los diseños finales (los actuales son de prueba) |
| Publicar con ayuda (copiar texto, marcar publicada, programar) | 40 % | «Programar» es solo diseño; Buffer o APIs de las redes |
| Estudio semanal del sector | 40 % | Crear la rutina con el prompt ya escrito |
| Medición y balance mensual | 20 % | Informe mensual y balance a 30 días |
| Pruebas, despliegue y ajustes | 5 % | Todo: aún no se despliega nada |
| **Total** | **≈ 50 %** | |

Contra el cronograma (construcción del 30/10 al 31/12/2026) va adelantado: los hitos de aprobar y de taller manual estaban previstos para el 13/11 y el 27/11.

## Cómo está organizado el trabajo
- ERP: `src/modules/marketing/` (pantallas), `functions/index.js` y `functions/src/` (funciones en la nube), `firestore.rules`.
- Fábrica de piezas: repositorio `noova-marketing` (workflow, plantillas, reglas de marca).
- Documento principal: `Noova-Marketing-Documentacion.docx`. Investigación: `investigacion-noova-actual.md`.

---

## 2026-10-30 · Tablero como portada, calendario eliminado y monitoreo automático
**Qué cambió, por pedido del equipo:**
- **Sin pestañas.** Marketing es una sola pantalla. Arriba, el **tablero** (monitoreo de redes) y los borradores por revisar; abajo, las **piezas**. La primera pantalla es el monitoreo, y los borradores salen en el indicador «Por revisar» (un clic lleva a ellos), en el panel «Para revisar» y en el filtro Borradores de Piezas.
- **Calendario eliminado.** Salía vacío y no aportaba. Lo útil se conservó: las piezas aprobadas con fecha salen en el panel «Próximas a publicar» (solo si hay) y, en el visor de una pieza aprobada, están «Copiar texto» y «Marcar publicada».
- **Monitoreo estilo Power BI.** Lienzo gris con mosaicos blancos; segmentadores de periodo (7 días, 30 días, Todo) y de red; seis indicadores (seguidores, crecimiento, avance a la meta con anillo, por revisar, por publicar, publicadas); gráfico de evolución (índice base 100 por cuenta, con total y trayectoria esperada hasta el 31/01/2027, en eje de tiempo real); dona de audiencia por red; barras de avance hacia la meta; tarjetas por cuenta con su estado de conexión.
- **Nada se escribe a mano.** Se quitó «Registrar números», la tabla «Últimas capturas» y la función `marketingRegistrarMetricas`.
- **Piezas:** «Ver más» (de 10 en 10). **Leyenda del gráfico** clara: cada línea con su trazo, su nombre y su cambio en %. **Facebook pasó a verde azulado** para no confundirlo con LinkedIn (el azul quedó solo para LinkedIn; las dos cuentas de LinkedIn se separan por tono y trazo).
- **Preparado para después, sin función:** opción **Video** en «Generar pieza» (marcada «Próximamente») y botón **Programar** en el visor de las piezas aprobadas (desactivado).
**Cómo se hizo el monitoreo automático:**
- `functions/src/monitoreoRedes.js` lee solo con **APIs oficiales**: YouTube Data API (secreto `YOUTUBE_API_KEY`), Facebook e Instagram por la Graph API de Meta (secreto `META_ACCESS_TOKEN`; Instagram además necesita el id de la cuenta profesional en `marketingConfig/redes.instagramUserId`).
- `marketingMonitoreoDiario` corre cada día a las 7:00 (hora de Lima) y guarda `marketingRedes/{cuenta}_{fecha}` y el estado de cada conexión en `marketingEstadoRedes/actual`. `marketingActualizarRedes` es el botón «Actualizar redes» (gerencia, administrador, responsable de marketing y soporte TI; mínimo 5 minutos entre lecturas). Los mensajes de error ocultan los secretos.
- La pantalla muestra por cuenta: **Automático**, **Conexión pendiente**, **Sin API** o **Error de lectura**. Mientras no haya lectura se muestra el punto de partida del 30/10/2026; una lectura automática de ese mismo día lo reemplaza.
- Cálculos del tablero en `utils/tablero.js`, con pruebas.
**Límite que se respeta:** no se leen páginas públicas de las redes ni se simula un navegador; el sistema de seguridad lo bloqueó y es lo correcto. LinkedIn **perfil** (el activo, 5.308) no tiene API y **no se puede automatizar**; LinkedIn **página de empresa** exige acceso aprobado a su API; TikTok exige una app aprobada. Hasta entonces esas cuentas quedan en el punto de partida.
**Verificación:** 94 pruebas del ERP y 28 del servidor, lint y compilación. Capturas con Chrome del tablero y del modal: `captura-tablero.png`, `captura-generar-pieza.png`. Se probó con datos de ejemplo; **no** con lecturas reales ni en celular.
**Último repaso del diseño:** el encabezado es el mismo de las demás páginas (se quitó la banda azul y el lienzo gris); la pantalla tiene tres secciones, **Cuentas** (primero, cada una en una tarjeta del color de su red), **Resumen** (indicadores, evolución, audiencia, para revisar y próximas) y **Piezas**; filtros y tarjetas en blanco con borde fino; indicadores neutros (solo «Por revisar» se destaca cuando hay borradores); se quitaron los textos explicativos, los mini gráficos repetidos y el gráfico de avance (cada cuenta ya muestra su barra de meta); la evolución se lee en % de cambio, con leyenda de solo nombres; cada tarjeta de cuenta muestra cifra, cambio, barra de meta y estado de conexión.
**Cómo repetir las capturas:** ver `_fuentes/LEEME.md` (sección harness-visual).
**Antes de desplegar:** `firebase functions:secrets:set YOUTUBE_API_KEY` y `META_ACCESS_TOKEN` (puede escribirse `pendiente` hasta tener la credencial), y desplegar funciones y reglas (`marketingEstadoRedes`).
**Pendiente:** credenciales de YouTube y Meta; id de Instagram; acceso a la API de páginas de LinkedIn y app de TikTok; función real de Video y de Programar.

## 2026-10-30 · Rediseño visual de las tres pestañas (reemplazado por el tablero de arriba)
**Qué:** Publicaciones, Calendario y Monitoreo se rehicieron para que se entiendan de un vistazo: sobrios, con una sola paleta (azul y turquesa de la marca), estados con color y gráficos en lugar de tablas. La previsualización del diseño en «Generar pieza» se achicó (de unos 560 px de alto a 280 px).
- **Marketing (cabecera):** título y pestañas subrayadas con icono, sin tarjetas alrededor.
- **Publicaciones:** filtro por **estado** (Todas, Borradores, Aprobadas, Publicadas, con conteo) y por **red** (con su icono de color y conteo). Las tarjetas muestran la imagen limpia, una insignia de estado (punto de color), el título y la fecha; el botón de eliminar aparece al pasar el cursor. Carga con esqueletos y estado vacío con mensaje.
- **Calendario:** vista de **semana** (lunes a domingo) con las piezas de cada día en miniatura, aviso de piezas atrasadas, y debajo la **agenda del día seleccionado** con tarjetas grandes (hora, red, texto, «Copiar texto» y «Marcar publicada»). Navegación por semanas y botón «Hoy».
- **Monitoreo:** tres indicadores arriba (seguidores totales con variación, meta esperada a 30 días, cuentas con acceso); una tarjeta por cuenta con el icono de su red, cifra, variación, mini gráfico de línea y una **barra de metas** (partida → conservador → esperado → optimista con el valor actual marcado); gráfico de evolución, los tres escenarios en números y tabla de capturas.
**Cómo:**
- Un solo sistema de estilos con prefijo `mk-` en `pages/Marketing.css` (se borraron `Monitoreo.css` y `Calendario.css`). Colores por red en `components/redesSociales.js`.
- Cada pestaña se separó en una **vista pura** (`PublicacionesVista`, `CalendarioVista`, `MonitoreoVista`) que solo recibe datos, y un contenedor que habla con Firebase. Eso permite probar el aspecto sin iniciar sesión.
- Utilidades nuevas con pruebas: semana, rango y fecha larga (`calendario.js`), rango de metas y posición (`metricasRedes.js`), y `claveEstado` (`aprobacion.js`).
**Cómo se verificó el aspecto:** levanté el ERP con una página de prueba (`docs/marketing/_fuentes/harness-visual/`) que monta las vistas con datos de ejemplo y saqué capturas con Chrome de las tres pestañas y del modal. Corregí la leyenda del gráfico, que salía con círculos grandes. Quedaron 86 pruebas del ERP y 23 del servidor, lint y compilación.
**Cómo repetirlo:** copiar `harness-visual/` a una carpeta `.harness/` en la raíz del ERP, correr `npx vite --port 5199` y `node captura.mjs <nombre> "?v=pub|cal|mon|modal"` (necesita `puppeteer-core`).
**No se vio:** el aspecto con datos reales de SharePoint ni en celular; las capturas fueron de 1280 px de ancho.

## 2026-10-30 · Previsualización real del diseño, a la derecha
**Qué:** al elegir un diseño en «Generar pieza» se ve **una imagen real de ese diseño** (colores, tipografía y composición finales), no un esquema. El modal ahora tiene dos columnas: formulario a la izquierda y la imagen grande a la derecha. **Los diseños son de prueba** (ver el aviso de arriba).
**Cómo:**
- Script nuevo en `noova-marketing`: `scripts/previsualizar_variantes.py`. Toma cada plantilla de `plantillas/variantes/`, la rellena con texto y foto de muestra (cifras de `afirmaciones-aprobadas.md`, fotos autorizadas), la renderiza con el mismo Chrome/Edge del exportador y la guarda como WebP de 540 px de ancho. Los carruseles salen como una tira con todas sus láminas. Oculta la marca «BORRADOR DE PLANTILLA».
- Tres diseños pensados para titulares cortos (`flyer-foto-palabra`, `flyer-foto-cifras`, `flyer-foto-apertura`) usan un texto de muestra más corto para que no se desborden.
- ERP: las 17 imágenes están en `public/disenos/<id>.webp` (552 KB en total); `PrevisualDiseno.jsx` ahora es un `<img>`; el modal usa tamaño grande con una cuadrícula de dos columnas.
**Para regenerarlas:** `python scripts/previsualizar_variantes.py --salida <carpeta del ERP>/public/disenos`.
**Pendiente:** reemplazar por los diseños finales cuando existan.

## 2026-10-30 · Calendario y publicación con ayuda (el calendario se eliminó; quedan copiar texto y marcar publicada en el visor)
**Qué:** pestaña **Calendario** dentro de Marketing. Lista lo aprobado por día y hora de Lima (Atrasadas, Hoy, Mañana, fechas), con «Copiar texto» para pegarlo en la red y «Marcar publicada» con el enlace opcional. Abajo, las últimas publicadas con su enlace. Es el camino 1 («asistida») del documento: una persona publica en la red y el ERP deja el registro.
**Cómo:**
- Estado nuevo `publicado` en `publicacion.json` (`publicado_en`, `url_publicada`). `cambiarEstadoPublicacion` ganó la acción `publicar`: solo desde aprobado, enlace opcional que debe empezar con `https://`. Una pieza publicada **no se puede devolver** a borrador ni eliminar (la regla de borrado ya bloqueaba `publicad`).
- Función `marketingMarcarPublicada` (mismos roles que aprueban) que también anota en el historial.
- Pantalla: `CalendarioPage.jsx`; `utils/calendario.js` ordena por momento previsto, marca lo atrasado con la hora de Lima y agrupa por día.
**Verificación:** 2 pruebas del servidor (estados permitidos y enlace inválido, no devolver lo publicado) y 4 del calendario.
**Pendiente:** conectar Buffer o las redes por API (camino 2 y 3 del documento) cuando haya acceso a Instagram, TikTok y YouTube; hoy la publicación en la red la hace una persona.

## 2026-10-30 · Taller manual: descargar el paquete y subir la versión editada
**Qué:** en el visor de una pieza, «Descargar paquete» muestra los archivos de la carpeta de la pieza para editarlos, y «Subir versión editada» reemplaza la imagen o el PDF por la versión hecha a mano. La pieza vuelve a borrador, se anula la aprobación y queda anotado «editada a mano» y en el historial. Pueden usarlo gerencia, administrador, responsable de marketing y soporte TI (quienes hoy editan a mano).
**Cómo:**
- La versión **reemplaza el contenido del mismo archivo** en SharePoint (sesión de subida con `replace`). Así conserva su id —con él las observaciones y el historial— y SharePoint guarda la versión anterior en su historial de versiones.
- Por eso la versión debe tener la **misma extensión** que el archivo actual (PNG por PNG, PDF por PDF). Un video no cabe en este camino: sería una pieza nueva, que es el siguiente paso del taller.
- La subida va **por trozos de 3,1 MB** a través de una función (`marketingIniciarSubida`, `marketingSubirParte`, `marketingRegistrarVersion`), porque una llamada directa solo admite 4 MB. Máximo 25 MB por archivo. La función solo acepta direcciones de sesión de SharePoint con https y comprueba que el trozo mida lo declarado.
- `registrarVersionManual` escribe en `publicacion.json` con el mismo control de versión (ETag), guarda `origen: manual` y una lista de versiones anteriores (las últimas 20).
- Pantalla: `ModalTaller.jsx` (paquete y subida con barra de avance), reglas en `utils/archivosVersion.js`.
**Verificación:** 3 pruebas del servidor (tipo y tamaño, direcciones válidas y trozos, registro de la versión) y 4 de reglas de pantalla. Para probar el entorno aislado hubo que darle `URL` al sandbox de pruebas.
**Pendiente:** videos (crear una pieza nueva desde un archivo) y probar la subida contra SharePoint real; Graph exige trozos múltiplos de 320 KiB y no pude comprobarlo en vivo.

## 2026-10-30 · Diseños, TikTok y «Otro boceto»
**Qué:** el botón Generar ahora es «Generar pieza», con selector de diseño, previsualización y «Generar otro boceto». TikTok se puede pedir (solo vertical). El workflow acepta la entrada `variante`.
**Cómo:**
- `noova-marketing`: `scripts/preparar_pieza.py` recibe `--variante`; si el diseño no sirve para la red y el formato falla con mensaje claro. El workflow `generar-pieza.yml` pasa la entrada. Dos pruebas nuevas.
- ERP: `functions/src/marketingPiezas.js` valida red, formato, tema, fecha y diseño. `data/catalogoDiseno.js` lista los 17 diseños; `PrevisualDiseno.jsx` dibuja el esquema; `ModalGenerarPieza.jsx` junta todo.
**Verificación:** 73 pruebas del ERP, 15 del planificador, lint y compilación.
**No hecho:** el folleto no se puede pedir desde el ERP (su red es «impreso»). La lista de diseños está duplicada en el ERP y en las funciones.

## 2026-10-30 · Aprobar y devolver con historial
**Qué:** botones Aprobar y Devolver con motivo; estado visible en la tarjeta y en la vista previa; historial de cambios.
**Cómo:**
- `graphDriveProvider.js`: `cambiarEstadoPublicacion` escribe en `publicacion.json` con control de versión (ETag). Aprobar exige el texto exacto que se vio y cero pendientes. Editar un texto aprobado anula la aprobación.
- `functions/index.js`: `marketingAprobar`, `marketingDevolver`, `marketingListarHistorial`. El historial vive en `marketingPublicaciones/{id}/historial`.
- Pantalla: `ModalAprobar.jsx`, `HistorialPublicacion.jsx`, reglas en `utils/aprobacion.js`.
**Verificación:** 5 pruebas del proveedor y 5 de reglas.
**Pendiente:** definir quién aprueba. Hoy pueden gerencia, administrador y responsable de marketing.

## 2026-10-30 · Monitoreo de redes dentro de Marketing (la carga a mano se reemplazó por lectura automática)
**Qué:** Marketing es una sola página con pestañas (Publicaciones y Monitoreo de redes). El monitoreo muestra las 6 cuentas con sus números reales del 30/10/2026, la meta a 30 días y un gráfico; se actualiza en vivo.
**Cómo:** `MarketingPage.jsx` con pestañas por `?tab=`; `MonitoreoPage.jsx`; `useMonitoreo` escucha Firestore con `onSnapshot`; la función `marketingRegistrarMetricas` guarda en `marketingRedes/{cuenta}_{fecha}`; regla de lectura en `firestore.rules`. Los números de partida están en `utils/metricasRedes.js`.
**Verificación:** 5 pruebas de cálculo y validación.
**Pendiente:** conectar las cuentas por API cuando haya acceso; hoy los números se cargan a mano.

## 2026-10-30 · Investigación de Noova en redes
Lectura pública de las 6 cuentas con el Chrome del equipo. Resultado y estimación de crecimiento en `investigacion-noova-actual.md`, con el prompt para automatizar el estudio semanal.

## 2026-10-30 · Documentación
Word de planificación (34 páginas) con diagramas de contexto, arquitectura, casos de uso, flujos, secuencia, estados, clases y datos. Los scripts que lo generan están en `_fuentes/`.
