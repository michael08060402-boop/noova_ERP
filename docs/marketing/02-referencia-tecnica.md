# 02 · Referencia técnica

## Archivos

### Frontend — `src/modules/marketing/`

| Archivo | Función |
|---|---|
| `index.js` | Exporta página, hook y `listarPublicaciones` |
| `pages/PublicacionesPage.jsx` | Página: filtros, grilla, borrado, visor, modal |
| `pages/Publicaciones.css` | Estilos del módulo |
| `hooks/usePublicaciones.js` | Estado de la lista (cargar, actualizar una, quitar una) |
| `services/marketingService.js` | Llamadas a funciones: listar, actualizar texto, generar, eliminar. Traduce códigos de error a mensajes en español |
| `services/observacionesService.js` | Listar y crear observaciones |
| `components/TarjetaPublicacion.jsx` | Tarjeta de la grilla |
| `components/VisorPublicacion.jsx` | Visor modal + panel de observaciones (incluye trampa de foco y accesibilidad) |
| `components/VistaPreviaPost.jsx` | Maqueta del post y editor de texto/hashtags |
| `components/ModalGenerarPieza.jsx` | Formulario de generación |
| `components/redesSociales.js` | Lista de redes (`facebook`, `instagram`, `linkedin`) |
| `utils/textoPost.js` | Separa y recombina texto + hashtags (con prueba unitaria) |

Ruta y permiso: `App.jsx` registra `marketing/publicaciones` dentro de `RutaConPermiso modulo="marketing"`. Menú en `DashboardLayout.jsx`.

### Backend — `functions/`

| Archivo | Función |
|---|---|
| `index.js` (sección "MÓDULO MARKETING") | Las cinco Cloud Functions |
| `src/graph/graphDriveProvider.js` | `listarArchivosPublicacionCarpeta`, `listarPostsRed`, `actualizarTextoPublicacion`, `obtenerLinkDescarga` |
| `src/graph/graphClient.js` | Cliente HTTP de Microsoft Graph |
| `src/graph/graphDriveProvider.test.js` | Pruebas del proveedor |
| `src/accessControl.js` | Roles y permisos por módulo |

## Cloud Functions (región `us-central1`)

| Función | Quién | Qué hace | Secretos |
|---|---|---|---|
| `marketingListarPublicaciones` | Cualquiera con permiso `marketing` | Lee SharePoint y devuelve `items` | `GRAPH_*` |
| `marketingGenerarPieza` | `gerencia`, `administrador`, `responsable_marketing` | Valida `red/formato/tema/fecha?` y llama a `POST /repos/Luanho11/noova-marketing/actions/workflows/generar-pieza.yml/dispatches` (espera 204) | `MARKETING_GH_TOKEN` |
| `marketingActualizarTexto` | Mismos tres roles | Reescribe `texto` en `publicacion.json` con `If-Match` | `GRAPH_*` |
| `marketingEliminarPublicacion` | Mismos tres roles | Borra carpeta o archivo (papelera SharePoint) y sus observaciones. Rechaza si el estado coincide con `aprob|program|publicad` | `GRAPH_*` |
| `marketingListarObservaciones` / `marketingCrearObservacion` | Permiso `marketing` | Lee/crea notas en Firestore | `GRAPH_*` |

Validaciones relevantes:
- `publicacionId` debe cumplir `^[a-zA-Z0-9!._-]{1,300}$` y estar **dentro** de `BORRADORES IA` (se recorre la cadena de padres en Graph, máx. 100 niveles).
- Solo imágenes y PDF son observables.
- Observación: 1–500 caracteres, `solicitudId` de 16–80 caracteres alfanuméricos/guiones para idempotencia (reintento no duplica).
- Texto del post: 1–32 000 caracteres; el JSON no puede superar 128 KB.

## Opciones de generación (deben coincidir con el workflow)

- Redes: `linkedin`, `facebook`, `instagram`.
- Formatos: `flyer`, `carrusel`, `publicacion`, `vertical` (este último solo Instagram).
- Temas: `automatico`, `trayectoria`, `proyectos`, `operaciones`, `alcance`, `fases-ventilacion`, `metodo-bombeo`, `ductos`.
- El backend acepta además `fecha` (AAAA-MM-DD) pero la interfaz no lo envía.

La lista está **duplicada** en tres sitios: `ModalGenerarPieza.jsx`, `functions/index.js` y el workflow externo. Cambiar un tema exige tocar los tres.

## Esquema `publicacion.json` (versión 1)

```json
{
  "schema_version": 1,
  "archivo": "post.png",
  "titulo": "…",
  "texto": "Cuerpo del post…\n\n#Ventilación #Minería",
  "red": "linkedin",
  "estado": "borrador",
  "formato": "flyer",
  "portada": "portada.png",
  "paginas": 8,
  "revision": 0,
  "pendientes": ["…"],
  "actualizado_en": "2026-10-30T12:00:00.000Z",
  "aprobado_en": null
}
```

Obligatorios para que el ERP lo acepte: `schema_version: 1` y `archivo` apuntando a un archivo existente en la misma carpeta. `portada` solo aplica a PDF. Un campo `red` distinto al de la carpeta genera aviso. Los campos que el ERP no conoce se conservan al editar (se hace `{...datos, texto, …}`).

## Permisos

`accessControl.js` da a `responsable_marketing` solo `marketing: ['read']` más nube y mensajería; `gerencia` y `administrador` tienen acceso total. Las reglas de Firestore reconocen `responsable_marketing` y `marketing` (alias). Las escrituras de este módulo se controlan por rol dentro de cada función, no por la matriz `read/create/update`.

## Datos en Firestore

`marketingPublicaciones/{idArchivoSharePoint}/observaciones/{solicitudId}` → `{ texto, usuarioUid, usuarioNombre, fecha }`. Las reglas bloquean el acceso directo; solo lo usan las funciones.

## Despliegue

```
firebase deploy --only functions      # funciones marketing*
npm run build && firebase deploy --only hosting
```

Secretos necesarios: `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_DRIVE_TYPE`, `GRAPH_DRIVE_ID`, `MARKETING_GH_TOKEN` (token de GitHub con permiso para disparar workflows en el repo de marketing).

## Pruebas

`npm test` (frontend, incluye `textoPost.test.js`) y las pruebas de `functions/src/graph/`. No hay pruebas de las funciones `marketing*` en sí.
