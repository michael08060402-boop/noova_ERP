import { createRoot } from 'react-dom/client';
import { Chart } from 'chart.js';
import '../src/index.css';
import '../src/styles/shared.css';
import '../src/modules/marketing/pages/Publicaciones.css';
import '../src/modules/marketing/pages/Marketing.css';
import TableroVista from '../src/modules/marketing/pages/TableroVista';
import PublicacionesVista from '../src/modules/marketing/pages/PublicacionesPage';
import ModalGenerarPieza from '../src/modules/marketing/components/ModalGenerarPieza';
import { fechaLima } from '../src/modules/marketing/utils/calendario';
import { sumarDias } from '../src/modules/marketing/utils/calendario';

// Con datos de ejemplo se finge que hoy es 20/11/2026, después del punto de partida.
const conDatos = new URLSearchParams(location.search).get('datos') === '1';
const hoy = conDatos ? '2026-11-20' : fechaLima();
const ahora = conDatos ? new Date('2026-11-20T15:00:00Z') : new Date();
const p = (id, diseno, red, estado, extra = {}) => ({
  id, nombre: `${diseno}.png`, titulo: extra.titulo || 'Más de 65 proyectos ejecutados', red, tipo: 'imagen', fechaModificacion: extra.modificada || `${sumarDias(hoy, -2)}T10:00:00Z`,
  urlMiniatura: `/disenos/${diseno}.webp`, texto: 'Más de 65 proyectos ejecutados en minería subterránea.\n\nConsulte por el alcance de su estudio.',
  metadatos: { estado, jsonEtag: 'v1', pendientes: [], origen: extra.origen || 'generado', aprobacion: extra.aprobacion || null, publicadoEn: extra.publicadoEn || null, urlPublicada: extra.url || null }
});
const apr = (dias, hora, red) => ({ por: 'Gerencia', red, fecha: sumarDias(hoy, dias), hora });
const lista = () => [
  p('1', 'flyer-foto-dato', 'linkedin', 'borrador', { titulo: 'Seis países, un método', modificada: new Date(Date.now() - 3 * 3600e3).toISOString() }),
  p('2', 'flyer-superior', 'facebook', 'aprobado', { titulo: 'Las fases de un estudio de ventilación', aprobacion: apr(0, '12:07', 'facebook') }),
  p('3', 'vertical-foto-dato', 'tiktok', 'borrador', { titulo: 'Una jornada de campo', origen: 'manual', modificada: new Date(Date.now() - 26 * 3600e3).toISOString() }),
  p('4', 'flyer-lateral', 'linkedin', 'aprobado', { titulo: 'Qué se mide en un aforo', aprobacion: apr(-1, '09:07', 'linkedin') }),
  p('5', 'social-cuadrado', 'instagram', 'publicado', { titulo: 'Noovaduct: ductos flexibles', publicadoEn: `${sumarDias(hoy, -1)}T15:00:00Z`, url: 'https://example.com/p/1' }),
  p('7', 'flyer-foto-titular', 'facebook', 'borrador', { titulo: 'Bombeo y drenaje' }),
  p('9', 'vertical-campo', 'instagram', 'publicado', { titulo: 'Historia: aforo', publicadoEn: `${sumarDias(hoy, -3)}T15:00:00Z` })
];

Chart.defaults.animation = false; // la captura de página completa redimensiona y reinicia las animaciones
const params = new URLSearchParams(location.search);
const vista = params.get('v') || 'tablero';
const piezas = params.get('piezas') === '0' ? [] : lista();

const capturas = params.get('datos') === '1' ? [
  { id: 'a', cuenta: 'linkedin-perfil', fecha: sumarDias(hoy, -14), seguidores: 5342 },
  { id: 'b', cuenta: 'linkedin-perfil', fecha: sumarDias(hoy, -7), seguidores: 5391 },
  { id: 'c', cuenta: 'linkedin-perfil', fecha: hoy, seguidores: 5420 },
  { id: 'd', cuenta: 'facebook', fecha: sumarDias(hoy, -7), seguidores: 7622 },
  { id: 'e', cuenta: 'facebook', fecha: hoy, seguidores: 7660 },
  { id: 'f', cuenta: 'youtube', fecha: hoy, seguidores: 161 }
] : [];

const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const estado = params.get('estado') === 'ok' ? {
  actualizadoEn: hace(2),
  cuentas: {
    'linkedin-perfil': { estado: 'sin_api', mensaje: 'Un perfil personal de LinkedIn no tiene API. Solo una página de empresa puede leerse sola.' },
    'linkedin-empresa': { estado: 'sin_api', mensaje: 'LinkedIn exige acceso aprobado a su API de páginas de empresa. Pendiente.' },
    facebook: { estado: 'ok', mensaje: '', leidoEn: hace(2) },
    instagram: { estado: 'pendiente', mensaje: 'Falta el id de la cuenta profesional de Instagram (marketingConfig/redes).' },
    tiktok: { estado: 'sin_api', mensaje: 'TikTok exige una app aprobada para dar sus cifras por API. Pendiente.' },
    youtube: { estado: 'error', mensaje: 'API key not valid.', }
  }
} : params.get('estado') === 'pendiente' ? {
  actualizadoEn: hace(1),
  cuentas: { facebook: { estado: 'pendiente', mensaje: 'Falta el secreto META_ACCESS_TOKEN.' }, instagram: { estado: 'pendiente', mensaje: 'Falta el secreto META_ACCESS_TOKEN.' }, youtube: { estado: 'pendiente', mensaje: 'Falta el secreto YOUTUBE_API_KEY.' } }
} : null;

function Pagina() {
  return (
    <div className="pagina mk" style={{ maxWidth: 1180, margin: '0 auto' }}>
      <TableroVista
        capturas={capturas} estado={estado} cargando={false} error={null} piezas={piezas} cargandoPiezas={false} hoy={hoy} ahora={ahora}
        periodo={params.get('periodo') || 'todo'} red={params.get('red') || 'todas'} onPeriodo={() => {}} onRed={() => {}}
        puedeActualizar actualizando={false} avisoActualizar="" errorActualizar="" onActualizarRedes={() => {}}
        onGenerar={() => {}} onVerBorradores={() => {}} onAbrir={() => {}}
      />
      <PublicacionesVista
        publicaciones={piezas} cargando={false} error={null} errorEliminar={null}
        filtroRed="todo" filtroEstado={params.get('filtro') || 'todas'} onFiltroRed={() => {}} onFiltroEstado={() => {}}
        onActualizar={() => {}} onAbrir={() => {}} onEliminar={() => {}}
      />
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  vista === 'modal' ? <div className="pagina mk"><ModalGenerarPieza isOpen onClose={() => {}} /></div> : <Pagina />
);
