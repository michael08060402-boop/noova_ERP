const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const app = express();
const PUERTO = process.env.NUBE_API_PORT || 3100;

// Ruta raíz de la carpeta OneDrive sincronizada
const RAIZ_ONEDRIVE = process.env.ONEDRIVE_LOCAL_PATH || '';

if (!RAIZ_ONEDRIVE) {
  console.error('ERROR: Falta la variable ONEDRIVE_LOCAL_PATH');
  console.error('Ejemplo: set "ONEDRIVE_LOCAL_PATH=C:\\Users\\TuUsuario\\OneDrive - NOOVA S.A.C" && npm start');
  process.exit(1);
}

if (!fs.existsSync(RAIZ_ONEDRIVE)) {
  console.error(`ERROR: La ruta no existe: ${RAIZ_ONEDRIVE}`);
  process.exit(1);
}

// URL base de SharePoint/OneDrive para abrir documentos en el navegador
// Si se configura, cada item incluirá urlWeb con el enlace directo
// Ejemplo: set "ONEDRIVE_WEB_BASE_URL=https://tu-empresa.sharepoint.com/.../Documents/NOOVA SAC"
const ONEDRIVE_WEB_BASE_URL = (process.env.ONEDRIVE_WEB_BASE_URL || '').replace(/\/+$/, '');

console.log(`Carpeta OneDrive: ${RAIZ_ONEDRIVE}`);
if (ONEDRIVE_WEB_BASE_URL) {
  console.log(`URL SharePoint: ${ONEDRIVE_WEB_BASE_URL}`);
} else {
  console.log('AVISO: ONEDRIVE_WEB_BASE_URL no configurada. Los archivos no tendrán enlace web.');
  console.log('  Para habilitar: set "ONEDRIVE_WEB_BASE_URL=https://tu-empresa.sharepoint.com/.../Documents/NOOVA SAC" && npm start');
}

app.use(cors());
app.use(express.json());

// ── UTILIDADES ──

// Codificar ruta relativa como ID (base64url seguro para URLs)
function codificarId(rutaRelativa) {
  if (!rutaRelativa) return 'root';
  return Buffer.from(rutaRelativa, 'utf8').toString('base64url');
}

// Decodificar ID a ruta relativa
function decodificarId(id) {
  if (!id || id === 'root') return '';
  try {
    return Buffer.from(id, 'base64url').toString('utf8');
  } catch (e) {
    console.error('Error decodificando ID:', id, e.message);
    return '';
  }
}

// Resolver ruta absoluta, validando que no salga de RAIZ_ONEDRIVE
function resolverRuta(rutaRelativa) {
  const absoluta = path.resolve(RAIZ_ONEDRIVE, rutaRelativa);
  const raizNormalizada = path.resolve(RAIZ_ONEDRIVE);
  if (!absoluta.startsWith(raizNormalizada)) {
    return null;
  }
  return absoluta;
}

// Obtener extensión de un archivo
function obtenerExtension(nombre) {
  const partes = nombre.split('.');
  if (partes.length < 2) return null;
  return partes.pop().toLowerCase();
}

// Verificar si un archivo es un placeholder de OneDrive (Files on Demand)
// OneDrive marca archivos solo-en-nube con atributo FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS (0x400000)
// y FILE_ATTRIBUTE_RECALL_ON_OPEN (0x40000). En Windows, estos archivos existen
// en el filesystem pero su contenido no está descargado.
function esArchivoLocal(rutaAbsoluta) {
  try {
    const stat = fs.statSync(rutaAbsoluta);
    // Archivos de 0 bytes en OneDrive suelen ser placeholders
    // Archivos muy grandes que OneDrive no descargó también fallan al leer
    // Por ahora, si stat funciona y tiene tamaño, asumimos que es local
    return stat.size >= 0;
  } catch (e) {
    return false;
  }
}

// Mapear un item del filesystem al formato estándar del módulo Nube
function mapearItem(dirent, rutaRelativa) {
  const rutaCompleta = path.join(RAIZ_ONEDRIVE, rutaRelativa, dirent.name);
  const esCarpeta = dirent.isDirectory();

  let stat = null;
  try {
    stat = fs.statSync(rutaCompleta);
  } catch (e) {
    // Archivo bloqueado o sin permisos — ignorar
  }

  const rutaRelItem = rutaRelativa ? `${rutaRelativa}/${dirent.name}` : dirent.name;

  // Construir URL web de SharePoint/OneDrive si hay base configurada
  // ?web=1 en archivos para que SharePoint abra vista previa en el navegador
  // En carpetas no hace falta, navega normalmente
  let urlWeb = null;
  if (ONEDRIVE_WEB_BASE_URL) {
    const segmentos = rutaRelItem.split('/').map(s => encodeURIComponent(s));
    urlWeb = ONEDRIVE_WEB_BASE_URL + '/' + segmentos.join('/');
    if (!esCarpeta) urlWeb += '?web=1';
  }

  return {
    id: codificarId(rutaRelItem),
    nombre: dirent.name,
    tipo: esCarpeta ? 'carpeta' : 'archivo',
    ruta: rutaRelItem,
    urlWeb,
    tamaño: esCarpeta ? 0 : (stat?.size || 0),
    fechaModificacion: stat?.mtime?.toISOString() || null,
    extension: esCarpeta ? null : obtenerExtension(dirent.name),
    mimeType: esCarpeta ? null : (mime.lookup(dirent.name) || 'application/octet-stream')
  };
}

// ── FILTRO DE ARCHIVOS/CARPETAS A IGNORAR ──

// OneDrive y Windows crean archivos/carpetas ocultos que no deben mostrarse
function debeIgnorar(nombre) {
  // Archivos/carpetas ocultos del sistema (punto al inicio)
  // OneDrive crea carpetas como .849C9593-..., .~, etc. que son metadata de sincronización
  if (nombre.startsWith('.')) return true;
  // Archivos temporales de Office (~$xxx.docx)
  if (/^~\$/.test(nombre)) return true;
  // Archivos temporales
  if (/\.tmp$/i.test(nombre)) return true;
  // Archivos de sistema de Windows
  if (/^desktop\.ini$/i.test(nombre)) return true;
  if (/^Thumbs\.db$/i.test(nombre)) return true;
  // Nombres tipo GUID sin punto (carpetas de sincronización de OneDrive)
  if (/^[{]?[0-9A-Fa-f]{8}[-]?([0-9A-Fa-f]{4}[-]?){3}[0-9A-Fa-f]{12}[}]?$/i.test(nombre)) return true;
  // Archivos con caracteres de control o nombres corruptos
  if (/[\x00-\x1F]/.test(nombre)) return true;
  return false;
}

// ── ENDPOINTS ──

// Listar contenido de una carpeta
app.get('/api/nube/carpeta', (req, res) => {
  try {
    const id = req.query.id || null;
    const rutaRelativa = id ? decodificarId(id) : '';
    const rutaAbsoluta = resolverRuta(rutaRelativa);

    if (!rutaAbsoluta) {
      return res.status(400).json({ error: 'Ruta inválida' });
    }

    if (!fs.existsSync(rutaAbsoluta)) {
      return res.status(404).json({ error: 'Carpeta no encontrada' });
    }

    const stat = fs.statSync(rutaAbsoluta);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'No es una carpeta' });
    }

    const dirents = fs.readdirSync(rutaAbsoluta, { withFileTypes: true });
    const items = dirents
      .filter(d => !debeIgnorar(d.name))
      .map(d => mapearItem(d, rutaRelativa));

    // Ordenar: carpetas primero, luego por nombre
    items.sort((a, b) => {
      if (a.tipo === 'carpeta' && b.tipo !== 'carpeta') return -1;
      if (a.tipo !== 'carpeta' && b.tipo === 'carpeta') return 1;
      return a.nombre.localeCompare(b.nombre, 'es');
    });

    res.json({ items });
  } catch (err) {
    console.error('Error leyendo carpeta:', err.message);
    res.status(500).json({ error: 'Error leyendo carpeta' });
  }
});

// Descargar / abrir un archivo
app.get('/api/nube/archivo/:id', (req, res) => {
  const { id } = req.params;
  const rutaRelativa = decodificarId(id);
  const rutaAbsoluta = resolverRuta(rutaRelativa);

  if (!rutaAbsoluta) {
    return res.status(400).json({ error: 'Ruta inválida' });
  }

  if (!fs.existsSync(rutaAbsoluta)) {
    return res.status(404).json({ error: 'Archivo no encontrado — puede que no esté sincronizado en este equipo' });
  }

  let stat;
  try {
    stat = fs.statSync(rutaAbsoluta);
  } catch (e) {
    return res.status(500).json({ error: 'No se pudo acceder al archivo' });
  }

  if (stat.isDirectory()) {
    return res.status(400).json({ error: 'Es una carpeta, no un archivo' });
  }

  // Verificar si el archivo está disponible localmente
  // OneDrive "Files on Demand": archivo de 0 bytes podría ser un placeholder
  if (stat.size === 0) {
    const ext = obtenerExtension(path.basename(rutaAbsoluta));
    // Solo alertar si es una extensión de documento (archivos vacíos legítimos existen)
    const extensionesDocumento = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'pdf'];
    if (extensionesDocumento.includes(ext)) {
      return res.status(503).json({
        error: 'Este archivo está solo en la nube. Ábrelo primero desde el Explorador de archivos para descargarlo, luego intenta de nuevo.'
      });
    }
  }

  const mimeType = mime.lookup(rutaAbsoluta) || 'application/octet-stream';
  const nombreArchivo = path.basename(rutaAbsoluta);
  const disposicion = req.query.disposicion || 'inline';

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', stat.size);
  res.setHeader(
    'Content-Disposition',
    `${disposicion}; filename="${encodeURIComponent(nombreArchivo)}"`
  );

  // Crear stream con manejo de errores para que no crashee el servidor
  const stream = fs.createReadStream(rutaAbsoluta);

  stream.on('error', (err) => {
    console.error('Error leyendo archivo:', rutaRelativa, err.message);
    // Si aún no se envió el header de respuesta, mandar error
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error leyendo el archivo — puede estar bloqueado por otra aplicación' });
    } else {
      // Si ya se empezó a enviar, cerrar la conexión
      res.end();
    }
  });

  // Si el cliente cierra la conexión (navegador navegó away), no crashear
  req.on('close', () => {
    stream.destroy();
  });

  stream.pipe(res);
});

// Obtener metadata de un archivo (sin descargar)
app.get('/api/nube/archivo/:id/info', (req, res) => {
  try {
    const { id } = req.params;
    const rutaRelativa = decodificarId(id);
    const rutaAbsoluta = resolverRuta(rutaRelativa);

    if (!rutaAbsoluta) {
      return res.status(400).json({ error: 'Ruta inválida' });
    }

    if (!fs.existsSync(rutaAbsoluta)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const stat = fs.statSync(rutaAbsoluta);
    const nombre = path.basename(rutaAbsoluta);

    // Construir URL web si hay base configurada
  const rutaRelItem = decodificarId(id);
  let urlWeb = null;
  if (ONEDRIVE_WEB_BASE_URL) {
    const segmentos = rutaRelItem.split('/').map(s => encodeURIComponent(s));
    urlWeb = ONEDRIVE_WEB_BASE_URL + '/' + segmentos.join('/') + '?web=1';
  }

  res.json({
      id,
      nombre,
      ruta: rutaRelItem,
      urlWeb,
      urlDescarga: `/api/nube/archivo/${id}?disposicion=inline`,
      tamaño: stat.size,
      mimeType: mime.lookup(rutaAbsoluta) || 'application/octet-stream'
    });
  } catch (err) {
    console.error('Error obteniendo info:', err.message);
    res.status(500).json({ error: 'Error obteniendo información del archivo' });
  }
});

// Buscar documentos por nombre
app.get('/api/nube/buscar', (req, res) => {
  try {
    const termino = (req.query.q || '').trim().toLowerCase();

    if (!termino || termino.length < 2) {
      return res.json({ items: [], total: 0 });
    }

    const resultados = [];
    const MAX_RESULTADOS = 50;

    function buscarRecursivo(rutaRelativa, profundidad) {
      if (profundidad > 10 || resultados.length >= MAX_RESULTADOS) return;

      const rutaAbsoluta = resolverRuta(rutaRelativa);
      if (!rutaAbsoluta || !fs.existsSync(rutaAbsoluta)) return;

      let dirents;
      try {
        dirents = fs.readdirSync(rutaAbsoluta, { withFileTypes: true });
      } catch (e) {
        return;
      }

      for (const dirent of dirents) {
        if (resultados.length >= MAX_RESULTADOS) break;
        if (debeIgnorar(dirent.name)) continue;

        if (dirent.name.toLowerCase().includes(termino)) {
          resultados.push(mapearItem(dirent, rutaRelativa));
        }

        if (dirent.isDirectory()) {
          const subRuta = rutaRelativa ? `${rutaRelativa}/${dirent.name}` : dirent.name;
          buscarRecursivo(subRuta, profundidad + 1);
        }
      }
    }

    buscarRecursivo('', 0);

    res.json({ items: resultados, total: resultados.length });
  } catch (err) {
    console.error('Error buscando:', err.message);
    res.status(500).json({ error: 'Error buscando documentos' });
  }
});

// ── MANEJO GLOBAL DE ERRORES ──
// Prevenir que cualquier error no manejado crashee el servidor
process.on('uncaughtException', (err) => {
  console.error('Error no manejado (servidor continúa):', err.message);
});

// ── INICIAR SERVIDOR ──
const servidor = app.listen(PUERTO, () => {
  console.log(`API local Nube iniciada en http://localhost:${PUERTO}`);
  console.log(`Raíz OneDrive: ${RAIZ_ONEDRIVE}`);
  console.log(`URL SharePoint: ${ONEDRIVE_WEB_BASE_URL || '(no configurada)'}`);
  console.log(`Endpoints:`);
  console.log(`  GET /api/nube/carpeta?id=<base64path>`);
  console.log(`  GET /api/nube/archivo/:id?disposicion=inline|attachment`);
  console.log(`  GET /api/nube/archivo/:id/info`);
  console.log(`  GET /api/nube/buscar?q=<termino>`);
});

// Manejar errores del servidor HTTP
servidor.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`ERROR: Puerto ${PUERTO} en uso. Cambia con set NUBE_API_PORT=3200`);
  } else {
    console.error('Error del servidor:', err.message);
  }
});
