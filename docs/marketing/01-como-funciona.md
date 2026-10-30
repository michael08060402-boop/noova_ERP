# 01 · Cómo funciona hoy el módulo

> **Actualización (2026-10-30).** Este archivo se escribió antes de revisar el repositorio `noova-marketing`. Lo que dice del ERP sigue vigente. Lo que dice de la generación de piezas, de la publicación automática y de un generador de textos con IA queda reemplazado por el plan en Word: [Noova-Marketing-Documentacion.docx](Noova-Marketing-Documentacion.docx).


## Flujo completo

```
 ┌─────────────────────────┐   dispara   ┌───────────────────────────────┐
 │ ERP: botón "Generar     │────────────▶│ GitHub Actions                 │
 │ flyer" (red/formato/    │  (Cloud     │ repo Luanho11/noova-marketing  │
 │ tema)                   │  Function)  │ workflow generar-pieza.yml     │
 └─────────────────────────┘             └───────────────┬───────────────┘
                                                         │ deja archivos
                                                         ▼
                                  ┌──────────────────────────────────────────┐
                                  │ SharePoint (vía Microsoft Graph)          │
                                  │ NOOVA SAC/04. MARKETING/BORRADORES IA/    │
                                  │   FACEBOOK | INSTAGRAM | LINKEDIN /       │
                                  │     <post>/ imagen o PDF + publicacion.json│
                                  └───────────────────┬──────────────────────┘
                                                      │ lee (solo servidor)
                                                      ▼
 ┌────────────────────┐  lista, edita, borra  ┌───────────────────────────┐
 │ ERP: Publicaciones │◀─────────────────────▶│ Cloud Functions marketing* │
 │ tarjetas + visor   │                        │ + Firestore (observaciones)│
 └────────────────────┘                        └───────────────────────────┘
```

Todo el tráfico con SharePoint pasa por Cloud Functions; el navegador nunca habla con Graph ni con GitHub y no ve ningún token.

## Qué ve y hace el usuario

**Pantalla Publicaciones** (`/marketing/publicaciones`)
- Cuadrícula de tarjetas con miniatura, título, fecha, insignia PDF e icono de red.
- Filtros Todo / Facebook / Instagram / LinkedIn con conteo.
- **Actualizar** vuelve a leer SharePoint (puede tardar varios segundos).
- **Generar flyer** abre el modal: red, formato (flyer, carrusel, publicación, vertical 9:16 solo en Instagram) y tema (automático o uno de siete). Avisa que tarda unos minutos y que hay que pulsar Actualizar; no hay seguimiento del avance.
- Borrar (solo `gerencia`, `administrador`, `responsable_marketing`): va a la papelera de SharePoint.

**Visor de revisión** (clic en una tarjeta)
- Maqueta aproximada del post en la red elegida (cabecera "Noova Consulting", Me gusta/Comentar/Compartir, o corazón en Instagram).
- Imágenes: se muestran grandes. PDF (carruseles): portada más enlace "Abrir PDF para visualizar carrusel".
- Editar texto y hashtags (mismos tres roles). Se guarda en el JSON de SharePoint con control de versión.
- Observaciones: hilo de comentarios de hasta 500 caracteres, visible para quien tenga acceso al módulo.
- Teclado: ← → para recorrer, Esc para cerrar.

## Cómo se construye cada publicación (lectura)

1. `marketingListarPublicaciones` obtiene la carpeta `BORRADORES IA` y sus hijos.
2. Cada subcarpeta cuyo nombre contiene facebook/fb, instagram/ig o linkedin define la red. Los archivos sueltos en la raíz quedan "sin red".
3. Dentro de cada carpeta de red, cada subcarpeta es un post; también se leen archivos sueltos antiguos.
4. En cada carpeta de post se busca `publicacion.json` (o el único JSON presente), se valida (`schema_version: 1`, el campo `archivo` debe existir) y se une con su imagen/PDF, miniatura y, para PDF, un enlace temporal de descarga.
5. Si el JSON falla, se muestra el archivo con un aviso en vez de ocultarlo.
6. Resultado ordenado por fecha de modificación, más reciente primero.

## Cómo se edita el texto

Guardar reescribe `publicacion.json` en SharePoint con `If-Match: <eTag>`. Si alguien (otra persona o el workflow) lo cambió antes, SharePoint responde 412 y el ERP muestra "El post cambió en SharePoint", conservando el texto escrito. Cada guardado sube `revision`, fija `actualizado_en`, devuelve `estado` a `borrador` y vacía `aprobado_en`.

## Qué NO hace hoy

| Falta | Consecuencia |
|---|---|
| Aprobar desde el ERP | No hay botón ni función que ponga `aprobado`. Guardar ya borra `aprobado_en`, así que el flujo de aprobación está a medias. |
| Publicar en redes | Alguien descarga y sube a mano a cada red. |
| Programar | No existe calendario ni fecha de publicación. |
| Video / TikTok | Solo imagen y PDF. TikTok no aparece en la lista de redes. |
| Métricas | Cero datos de alcance, clics, seguidores. |
| Aprendizaje | El tema "automático (según historial)" depende de lo que haga el repo externo; el ERP no le entrega datos de desempeño. |
| Seguimiento de generación | El modal no sabe si el workflow terminó o falló. |
| Comentarios → regeneración | Las observaciones se guardan pero nadie ni nada las convierte en una nueva versión de la pieza. |

## Hallazgos de la revisión del código

1. **Rendimiento al crecer**: por cada post se hacen varias llamadas a Graph (listar carpeta, leer JSON, miniaturas, enlace de PDF). Con decenas de posts la función se acerca a su límite de 120 s. Conviene un índice en Firestore (ver hoja de ruta, Fase 1).
2. **Dependencia personal**: el workflow vive bajo una cuenta personal de GitHub (`Luanho11`) y el token `MARKETING_GH_TOKEN` es un secreto de Firebase. Si esa cuenta cambia, el módulo deja de generar. Conviene mover el repo a una organización de Noova.
3. **Lógica duplicada** en `PublicacionesPage.jsx`: el cálculo de "siguiente/anterior" está escrito dos veces (`cambiarImagen` y el manejador de teclado).
4. **Sin reglas Firestore específicas**: `marketingPublicaciones` no tiene regla propia y cae en la denegación general, que es lo deseado porque solo se accede desde funciones. Debe mantenerse así.
5. **El estado es texto libre** en el JSON; el ERP lo interpreta con una expresión regular (`aprob|program|publicad`). Un typo en el workflow permitiría borrar un post ya publicado.
