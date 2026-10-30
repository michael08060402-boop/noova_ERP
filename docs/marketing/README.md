# Módulo de Marketing (Publicaciones) — Documentación

**Documento principal: [Noova-Marketing-Documentacion.docx](Noova-Marketing-Documentacion.docx)** (34 páginas: 11 secciones cortas y tres anexos con todos los diagramas). Los PNG de cada diagrama están en [diagramas/](diagramas/) y los scripts que lo generan en [_fuentes/](_fuentes/LEEME.md).

> Los cuatro archivos `.md` de abajo son la primera versión, escrita sin acceso al repositorio `noova-marketing`. El Word los amplía y corrige: el botón del ERP arma las piezas con recetas y no con IA, la regla 1 impide publicar sin aprobación humana, y la hoja de ruta cambia de orden.

Estado documentado: **2026-10-30**, rama `main`, commit `db63977`.

Investigación de las cuentas actuales, estimación de crecimiento y prompt de automatización: [investigacion-noova-actual.md](investigacion-noova-actual.md).

## Índice

| Documento | Para qué sirve |
|---|---|
| [01-como-funciona.md](01-como-funciona.md) | Qué hace hoy el módulo, de punta a punta, y qué no hace |
| [02-referencia-tecnica.md](02-referencia-tecnica.md) | Archivos, Cloud Functions, esquema `publicacion.json`, permisos, límites |
| [03-hoja-de-ruta.md](03-hoja-de-ruta.md) | Cómo convertirlo en un "personal de marketing" completo: video TikTok, imágenes, frases, programación, métricas |
| [04-medicion-de-impacto.md](04-medicion-de-impacto.md) | Línea base desde hoy, KPIs, y cómo demostrar lo que aportó el proyecto |

## Resumen en cinco líneas

1. Hoy el módulo es un **revisor de borradores**: lista imágenes y PDF que un proceso externo deja en SharePoint, permite verlos como se verían en Facebook, Instagram o LinkedIn, editar texto y hashtags, comentar y borrar.
2. La **generación** no ocurre en este repositorio. El botón "Generar flyer" dispara un workflow de GitHub Actions en `Luanho11/noova-marketing` (copia local en `Desktop/noova-marketing`), que arma la pieza con recetas y plantillas, sin IA, y la sube a SharePoint.
3. **No publica** en ninguna red, **no programa** y **no mide** nada. No hay integración con Meta, LinkedIn ni TikTok.
4. No hay estado "aprobado" que se pueda marcar desde el ERP; solo existe como texto en el JSON, y editar el texto lo devuelve a `borrador`.
5. La hoja de ruta propone cerrar el ciclo **generar → aprobar → programar → publicar → medir → aprender**, en fases, empezando por lo que ya se puede hacer con lo que existe.

## Qué no se verificó

- La ejecución real del workflow y el ERP desplegado: se describe el código y la documentación.
- `preparar_pieza.py` no se leyó. Que el botón no use IA se deduce de que el workflow solo guarda claves de SharePoint.
- Los requisitos vigentes de Buffer, Meta, LinkedIn y TikTok.
- El rol de Luis en el ERP, el costo de un puesto de marketing y las horas libres del equipo.

La lista completa está en el Anexo B del Word.
