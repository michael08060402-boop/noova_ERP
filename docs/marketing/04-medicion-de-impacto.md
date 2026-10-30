# 04 · Medición de impacto: línea base desde hoy y aporte del proyecto

**Fecha de línea base: 2026-10-30.** Todo lo que se mida después se compara contra este punto.

## Principio

Para decir "esto creció gracias al proyecto" hacen falta tres cosas: un **antes** documentado, un **después** medido igual, y una forma de separar el efecto del proyecto de otros factores (temporada, ferias, campañas pagadas, noticias del sector). Con la audiencia pequeña y el ciclo de venta largo de una empresa de servicios mineros, los números semanales son ruidosos: se compara a **28 y 90 días**, no día a día.

## Paso 1 — Congelar el "antes" (hacerlo hoy)

Las plataformas guardan datos por tiempo limitado. Exportar y guardar en `NOOVA SAC/04. MARKETING/LINEA BASE 2026-10-30/`:

| Red | Qué exportar | Dónde |
|---|---|---|
| Facebook / Instagram | Resumen y contenido de los últimos 90 días o el máximo disponible: alcance, impresiones, interacciones, seguidores, clics | Meta Business Suite → Estadísticas → Exportar datos |
| LinkedIn | Visitantes, seguidores, actualizaciones (impresiones, clics, reacciones, tasa de interacción) del máximo periodo disponible | Página → Analíticas → Exportar |
| TikTok | Si existe cuenta: vistas, seguidores, interacción | TikTok Studio → Analíticas |
| Sitio web | Visitas por origen (redes sociales, directo, búsqueda), páginas de contacto/cotización | Google Analytics o el que se use |
| ERP | Consultas y cotizaciones de los últimos 6–12 meses, con cómo llegó cada cliente si se registró | Colecciones `clientes`, `cotizaciones` |

Además, anotar en una hoja (`linea-base.md` o Excel) los datos de ese día:

| Dato | Facebook | Instagram | LinkedIn | TikTok |
|---|---|---|---|---|
| Seguidores al 2026-10-30 | | | | |
| Publicaciones en los últimos 90 días | | | | |
| Alcance medio por publicación (90 d) | | | | |
| Tasa de interacción media (90 d) | | | | |
| Clics a la web (90 d) | | | | |
| Mensajes / consultas recibidas por la red (90 d) | | | | |

Más la línea base **de proceso** (cuánto cuesta producir hoy):

| Dato | Valor |
|---|---|
| Piezas publicadas por mes (promedio) | |
| Horas de trabajo por pieza (idea → publicada) | |
| Personas involucradas | |
| Gasto en diseño, herramientas o pauta por mes | |

Si algún valor no se conoce, escribir "no medido" en lugar de estimar; así queda claro qué se empezó a medir ese día.

## Paso 2 — Qué medir a partir de hoy

### Resultados de audiencia (por red, semanal)
- Seguidores y variación neta.
- Alcance e impresiones.
- Interacciones por publicación y **tasa de interacción** (interacciones ÷ alcance).
- Clics al sitio o a contacto.
- Visitas al perfil.

### Resultados por pieza (a 24 h, 7 d y 28 d)
- Red, formato, tema, día y hora, si usó foto real o generada, si tuvo video.
- Alcance, interacciones, clics, guardados/compartidos, retención en video.
- Si el texto fue editado por una persona antes de aprobar, y cuántas revisiones tuvo.

### Resultados de negocio (lo que realmente importa)
- **Consultas que llegan desde redes**: mensajes directos, formulario del sitio con parámetros UTM en los enlaces, y la pregunta "¿cómo nos conoció?" al registrar un cliente o cotización.
- Cotizaciones emitidas con origen "redes" y su resultado (ganada/perdida/monto).
- Esto requiere un campo `origen` en el cliente o la cotización del ERP. Es un cambio pequeño y es lo que permite pasar de "me gusta" a "ventas".

### Resultados del proceso (el aporte del proyecto en eficiencia)
| Indicador | Cómo se calcula |
|---|---|
| Piezas publicadas por mes | Conteo de estado `publicado` |
| Horas por pieza | Tiempo registrado vs línea base |
| Tiempo idea → publicada | Fecha de generación a fecha de publicación |
| % aprobadas sin edición | Piezas sin cambio de `revision` |
| Costo por pieza | Herramientas + horas ÷ piezas |
| Consistencia | Semanas del mes con al menos 2 publicaciones por red |

## Paso 3 — Cómo guardar los datos

**Ahora (sin integración)**: una hoja con una fila por red y semana, y otra con una fila por publicación; se llena cada lunes desde las exportaciones.

**Cuando el ERP lo soporte** (Fase 1 y 5 de la hoja de ruta), en Firestore, accesible solo vía funciones como las observaciones:

```
marketingMetricasRed/{red}_{AAAA-MM-DD}
  { red, fecha, seguidores, alcance, impresiones, interacciones, clics, visitasPerfil }

marketingPublicaciones/{id}/metricas/{dias}      // "1d", "7d", "28d"
  { alcance, impresiones, interacciones, clics, guardados, compartidos,
    retencionVideo?, capturadoEn }
```

Captura diaria con una función programada que consulta las APIs de cada red una vez conectadas. Hasta entonces, un formulario simple en el ERP puede registrar los números a mano en el mismo formato, para que el cambio posterior no pierda historia.

## Paso 4 — Reportes

**Panel dentro de Marketing**
- Seguidores por red en el tiempo, con una marca vertical en la fecha de línea base.
- Tabla de piezas ordenable por alcance, interacción y clics.
- Resumen por formato y por tema: qué rinde más.
- Origen de consultas y cotizaciones atribuidas a redes.

**Informe mensual** (el primero el 2026-11-30, luego uno por mes). Estructura fija:
1. Qué se publicó (cantidad, redes, formatos).
2. Audiencia: valor actual, línea base, diferencia absoluta y en %.
3. Mejores y peores 3 piezas y por qué se cree que fue así.
4. Consultas y cotizaciones con origen en redes.
5. Proceso: horas ahorradas y costo por pieza vs línea base.
6. Qué se cambia el mes siguiente.

## Paso 5 — Cómo demostrar lo que aportó el proyecto

Presentar tres bloques separados, sin mezclarlos:

1. **Eficiencia (la más defendible)**: horas y dinero por pieza antes vs después, y volumen publicado. Es directamente atribuible al sistema.
2. **Audiencia**: crecimiento de seguidores, alcance e interacción frente a la línea base y frente a los 90 días previos. Atribución parcial: el sistema aumenta frecuencia y consistencia, pero también influyen temporada y eventos.
3. **Negocio**: consultas y ventas con origen en redes. Es lo que más pesa para gerencia, pero con volúmenes bajos hay que mostrar los casos concretos junto al porcentaje.

Técnicas para fortalecer la conclusión:
- **Comparar ventanas iguales** (por ejemplo, los 90 días siguientes contra los 90 anteriores) y, si hay dato, contra el mismo periodo del año anterior.
- **Probar de a una variable**: dos semanas con foto real vs generada, o con y sin video, manteniendo el resto; así se mide el efecto de cada mejora.
- **Marcar en la línea de tiempo** cada hito (primera publicación programada, primer video, nueva guía de voz) para ver su efecto.
- **Aclarar la limitación**: correlación no es causalidad; si hubo campaña pagada o feria en el periodo, mencionarlo.

## Metas de partida (a ajustar con la línea base)

No se fijan cifras hasta ver los números del 2026-10-30. Una vez medidos, definir metas del tipo:
- Frecuencia: de X a Y piezas por mes.
- Tasa de interacción: +N puntos sobre la línea base a 90 días.
- Origen redes: al menos Z consultas por trimestre.
- Horas por pieza: reducir en N %.

## Calendario de revisión

| Fecha | Qué |
|---|---|
| 2026-10-30 | Línea base congelada |
| Cada lunes | Captura semanal y revisión de 15 minutos |
| 2026-11-30 | Primer informe mensual |
| 2027-01-28 | Primera comparación a 90 días |
| 2027-04-30 | Informe semestral del aporte del proyecto |
