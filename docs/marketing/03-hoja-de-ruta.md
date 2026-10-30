# 03 · Hoja de ruta: de revisor de borradores a personal de marketing completo

> **Actualización (2026-10-30).** Este archivo se escribió antes de revisar el repositorio `noova-marketing`. Lo que dice del ERP sigue vigente. Lo que dice de la generación de piezas, de la publicación automática y de un generador de textos con IA queda reemplazado por el plan en Word: [Noova-Marketing-Documentacion.docx](Noova-Marketing-Documentacion.docx).


## Objetivo

Que el sistema cubra el ciclo completo con una persona de Noova como aprobadora, no como operadora:

```
 Planificar ─▶ Crear ─▶ Aprobar ─▶ Programar ─▶ Publicar ─▶ Medir ─▶ Aprender
     ▲                                                                  │
     └──────────────────────────────────────────────────────────────────┘
```

Hoy solo existen "Crear" (en un repo externo) y "Aprobar" a medias (revisar y comentar). Las seis capacidades que pediste se reparten así:

| Capacidad pedida | Fase | Dependencia principal |
|---|---|---|
| Programar publicaciones automáticamente | 2 | Fase 1 (estados y calendario) y credenciales de cada red |
| Mejores frases y contenido de Noova | 3 | Guía de voz + banco de hechos verificados |
| Imágenes más orgánicas | 3 | Banco de fotos reales de Noova |
| Videos de TikTok | 4 | Fase 3 (guiones y material) y acceso a la API de TikTok |
| Analizar métricas desde hoy | 0 y 5 | Nada para empezar: se puede hacer manual hoy |
| Ver crecimiento y aporte del proyecto | 0 y 5 | La línea base de la Fase 0 |

**Orden recomendado**: 0 → 1 → 5 (mínimo) → 2 → 3 → 4. Medir antes de automatizar permite saber si cada mejora sirvió. Video va último porque es lo más caro de producir y el que más depende de material real.

---

## Fase 0 — Esta semana, sin programar

Objetivo: dejar fijada la línea base y las reglas de contenido.

1. **Exportar ahora todo el histórico disponible** de Facebook, Instagram y LinkedIn (y TikTok si hay cuenta). Las plataformas conservan solo una ventana limitada; lo que no se exporte hoy se pierde y con ello el "antes". Detalle en `04-medicion-de-impacto.md`.
2. **Guía de voz de Noova** (una página): tono, qué decimos, qué nunca decimos, vocabulario técnico correcto (ventilación de minas, ductos, bombeo, mangas). Es el insumo de todo lo que genere IA.
3. **Banco de hechos verificados**: trayectoria, cifras, proyectos que se pueden nombrar, clientes que autorizaron aparecer. La IA solo puede afirmar lo que esté ahí.
4. **Pilares de contenido** (3–5), por ejemplo: método técnico, operaciones en campo, seguridad, casos, equipo. Hoy los 7 temas del modal son un buen punto de partida.
5. **Inventario de material real**: fotos y videos propios de operaciones, con permiso de las personas que salen y de la mina donde se grabó.

## Fase 1 — Cimientos en el ERP (1–2 semanas)

Sin esto, programar y medir se vuelven frágiles.

| Cambio | Por qué |
|---|---|
| **Un documento por publicación en Firestore** (`marketingPublicaciones/{id}`) con red, formato, tema, estado, fecha programada, ids de SharePoint y, luego, ids de la publicación real | Hoy cada listado hace decenas de llamadas a Graph. Con un índice la pantalla carga al instante y se puede filtrar por estado y fecha |
| **Máquina de estados real**: `borrador → en_revision → aprobado → programado → publicado` (y `descartado`, `error`) con quién y cuándo en cada paso | Hoy es texto libre; un error de tipeo permite borrar algo ya publicado |
| **Botón Aprobar** (y Devolver con motivo) | Cierra el hueco actual: aprobación solo existe como campo vacío |
| **Observaciones que reabren la pieza**: un comentario de tipo "corregir" pasa el estado a `en_revision` y avisa al generador | Hoy los comentarios no cambian nada |
| **Seguimiento de la generación**: consultar el run del workflow (`GET /actions/runs`) y mostrar "en cola / generando / listo / falló" | Hoy el usuario no sabe si falló |
| **Catálogo único** de redes, formatos y temas (un JSON compartido por ERP, funciones y generador) | Hoy está copiado en tres lugares |
| **Mover el repo de marketing a una organización de Noova** y rotar `MARKETING_GH_TOKEN` | Hoy depende de una cuenta personal |

## Fase 2 — Calendario y publicación automática (2–3 semanas)

**Calendario** en la página: vista mensual/semanal con las piezas por estado y red; arrastrar para reprogramar; sugerencia de huecos ("no hay nada en LinkedIn la semana del 17").

**Publicador**: una función programada (`onSchedule`, cada 5–15 min, igual que `backupFirestoreDiario`) que toma piezas `aprobado` con fecha vencida, publica y guarda el id resultante. Reglas de seguridad:
- Solo publica lo `aprobado`; nunca una pieza editada después de aprobarse (editar vuelve a `borrador`, como ya hace el código).
- Idempotencia: marcar `publicando` antes de llamar a la red para no duplicar si la función se reintenta.
- Tras fallo, estado `error` con motivo visible y notificación por la mensajería del ERP.

| Red | Vía | A confirmar en la documentación vigente antes de empezar |
|---|---|---|
| Facebook (página) | Graph API de Meta, publicación de fotos y programación nativa | Permisos de página, revisión de la app, token de página de larga duración |
| Instagram (cuenta profesional) | API de publicación de contenido de Instagram (crear contenedor y publicar) | La programación debe hacerla nuestro publicador; límites diarios; carruseles solo con imágenes, no con PDF |
| LinkedIn (página) | API de publicaciones de LinkedIn | Acceso al producto de gestión de comunidad requiere solicitud y aprobación; vigencia de tokens |
| TikTok | API de publicación de contenido | Ver Fase 4 |

Consecuencia de diseño: **los carruseles hoy son PDF**. LinkedIn los acepta como documento; Instagram y Facebook necesitan una imagen por página. El generador debe exportar también las páginas como PNG.

Credenciales: guardarlas en Secret Manager (como los `GRAPH_*`), con aviso en el ERP cuando un token esté por vencer. Empezar con una sola red (LinkedIn o Facebook, la de más audiencia hoy) y ampliar.

Mientras la Fase 2 no esté lista, un paso intermedio útil: el ERP muestra "Hoy toca publicar X en Y" con el texto y la imagen listos para copiar.

## Fase 3 — Mejor contenido: frases e imágenes (continuo)

### Frases y textos de Noova
- Un **generador de textos** (API de Claude) alimentado con: guía de voz, banco de hechos, pilar, red y 3–5 posts propios de mejor desempeño como ejemplos.
- Reglas duras en el prompt y validación posterior: sin cifras ni clientes fuera del banco de hechos; longitud por red; hashtags de una lista curada; sin muletillas típicas de texto automático.
- Salida de **3 variantes** por pieza para que la persona elija; guardar cuál eligió (señal de aprendizaje).
- Banco de frases cortas para flyers: 50–100 frases revisadas por una persona técnica, etiquetadas por pilar, con rotación para no repetir.
- Revisión técnica obligatoria de la primera tanda: en ventilación minera un dato mal puesto daña la credibilidad más que un post flojo.

### Imágenes más orgánicas
- **Base real**: fotos propias de campo, equipos y personal (con permiso), almacenadas en una carpeta etiquetada de SharePoint. El generador compone sobre ellas en lugar de crear escenas inventadas.
- Usar imagen generada por IA solo para fondos, texturas o ilustración conceptual; **no** para mostrar equipos, personas o instalaciones que parezcan reales pero no lo son.
- Plantillas con más variedad (hoy hay un catálogo de variantes): alternar foto a sangre, cita sobre fondo liso, dato destacado, antes/después.
- Mantener texto dentro de la imagen corto y legible en celular; probar contraste en miniatura.
- Variar la hora y el formato para evitar un feed "de plantilla".

## Fase 4 — Video para TikTok (3–5 semanas; empezar con piloto)

Pipeline propuesto, ejecutado en GitHub Actions o Cloud Run Jobs:

```
Tema + hecho verificado
   └─▶ Guion de 15–40 s (gancho en 2 s, un solo mensaje, llamada a la acción)
         └─▶ Plano a plano: qué clip real o animación va en cada segundo
               └─▶ Ensamblado 9:16 (ffmpeg o Remotion): clips + texto en pantalla + subtítulos + música libre
                     └─▶ Voz en off opcional (voz sintética o grabada por una persona del equipo)
                           └─▶ Borrador en SharePoint + publicacion.json → revisión humana en el ERP
```

Decisiones:
- **Material**: clips reales de campo primero; animaciones simples (esquemas de flujo de aire, ductos, fases) hechas con plantillas para lo que no se puede filmar. Video generativo completo solo como experimento: en B2B minero una escena falsa resta confianza.
- **Reutilizar** el mismo video como Reel de Instagram, Short, y video en LinkedIn/Facebook. Así el costo se reparte en cuatro redes.
- **Publicación**: la API de TikTok exige registrar una app y pasar auditoría para publicar de forma pública; sin auditoría suele limitarse a visibilidad privada o a dejar el video como borrador en la app. Plan realista: empezar subiendo a la bandeja y publicar con un toque desde el celular, y pedir la auditoría en paralelo. **Confirmar condiciones vigentes** antes de comprometer fechas.
- **Etiquetado**: las plataformas piden marcar contenido generado o editado con IA. El módulo debe guardar ese indicador por pieza.
- **Piloto**: 8–12 videos en 6 semanas con la medición de la Fase 5 y luego decidir si TikTok vale la inversión para una empresa de ventilación minera. Puede resultar que LinkedIn y Reels rindan más para el público comprador.
- En el ERP: nuevo `tipo: 'video'`, reproductor en el visor, miniatura y red `tiktok` en `redesSociales.js`, `OPCIONES_PIEZA` y el workflow.

## Fase 5 — Analítica y aprendizaje (empieza en la Fase 1 con captura mínima)

Resumen; el detalle está en `04-medicion-de-impacto.md`.

1. **Captura**: primero manual por plantilla (semana 1), luego automática con las APIs de cada red una vez conectadas.
2. **Panel** dentro de Marketing: seguidores en el tiempo, alcance, interacción, clics, top y peor piezas, por red y por formato/tema.
3. **Reporte mensual** automático: comparación con la línea base y con el mes anterior.
4. **Bucle de aprendizaje**: cada lunes, un resumen de qué temas, formatos y horas funcionaron, que alimenta la sugerencia de "tema automático" del generador y propone el calendario de las dos semanas siguientes para aprobación humana.

## Agente orquestador (visión final)

Una función semanal que: lee métricas → propone calendario de 2 semanas (temas, redes, formatos, fechas) → dispara la generación de las piezas → las deja en `en_revision` → avisa por mensajería. La persona solo aprueba, corrige o descarta. Nada se publica sin aprobación humana explícita.

## Riesgos y reglas

| Riesgo | Mitigación |
|---|---|
| Publicar datos falsos o confidenciales | Banco de hechos cerrado; aprobación humana obligatoria; lista de clientes que no se nombran |
| Contenido que "suena a IA" | Guía de voz, ejemplos reales, 3 variantes, revisión técnica |
| Personas o minas en fotos y video sin permiso | Registro de autorizaciones junto al material |
| Cambios en APIs y vencimiento de tokens | Aviso de vencimiento, publicación manual como respaldo, versiones de API fijadas |
| Cuentas bloqueadas por publicar de forma automática | Cumplir límites, usar solo APIs oficiales, ritmo humano (1 pieza por red por día como máximo al inicio) |
| Complejidad creciente | Fases cortas, cada una con su indicador de éxito; no empezar la siguiente sin medir la anterior |
| Dependencia de una persona | Repo en organización, secretos en Secret Manager, documentación (esta carpeta) |
