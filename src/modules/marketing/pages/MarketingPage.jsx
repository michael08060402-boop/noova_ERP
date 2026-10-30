import { useEffect, useMemo, useState } from 'react';
import usePublicaciones from '../hooks/usePublicaciones';
import useMonitoreo from '../hooks/useMonitoreo';
import ModalGenerarPieza from '../components/ModalGenerarPieza';
import VisorPublicacion from '../components/VisorPublicacion';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { useAuth } from '../../../context/AuthContext';
import { eliminarPublicacion } from '../services/marketingService';
import { actualizarRedesAhora } from '../services/monitoreoService';
import { fechaLima } from '../utils/calendario';
import TableroVista from './TableroVista';
import PublicacionesVista, { filtrarPublicaciones } from './PublicacionesPage';
import '../../../styles/shared.css';
import './Publicaciones.css';
import './Marketing.css';

const ROLES_ELIMINAR = ['gerencia', 'administrador', 'responsable_marketing'];
const ROLES_ACTUALIZAR = [...ROLES_ELIMINAR, 'soporte_ti'];

// Marketing es una sola pantalla: arriba el tablero de las redes y las piezas por revisar, abajo todas las piezas.
export default function MarketingPage() {
  const { publicaciones, cargando: cargandoPiezas, error, cargar, actualizarPublicacion, quitarPublicacion } = usePublicaciones();
  const { capturas, estado, cargando, error: errorMonitoreo } = useMonitoreo();
  const { userProfile } = useAuth();
  const [ahora] = useState(() => new Date());
  const hoy = fechaLima(ahora);

  const [periodo, setPeriodo] = useState('todo');
  const [red, setRed] = useState('todas');
  const [filtroRed, setFiltroRed] = useState('todo');
  const [filtroEstado, setFiltroEstado] = useState('todas');
  const [seleccionada, setSeleccionada] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [porEliminar, setPorEliminar] = useState(null);
  const [errorEliminar, setErrorEliminar] = useState(null);
  const [actualizando, setActualizando] = useState(false);
  const [avisoActualizar, setAvisoActualizar] = useState('');
  const [errorActualizar, setErrorActualizar] = useState('');

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(() => filtrarPublicaciones(publicaciones, filtroRed, filtroEstado), [publicaciones, filtroRed, filtroEstado]);
  // El visor recorre las piezas filtradas; si se abrió una que el filtro oculta, recorre solo esa.
  const recorrido = useMemo(
    () => (seleccionada && !visibles.some((p) => p.id === seleccionada.id) ? [seleccionada] : visibles),
    [visibles, seleccionada]
  );

  const cambiarPieza = (direccion) => {
    setSeleccionada((actual) => {
      if (!actual || recorrido.length < 2) return actual;
      const indice = recorrido.findIndex((p) => p.id === actual.id);
      return recorrido[(indice + direccion + recorrido.length) % recorrido.length];
    });
  };

  useEffect(() => {
    if (!seleccionada) return undefined;
    const manejarTecla = (event) => {
      if (event.key === 'Escape') setSeleccionada(null);
      if (event.target instanceof HTMLElement && (event.target.matches('textarea, input, select') || event.target.isContentEditable)) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      cambiarPieza(event.key === 'ArrowLeft' ? -1 : 1);
    };
    window.addEventListener('keydown', manejarTecla);
    return () => window.removeEventListener('keydown', manejarTecla);
  });

  const confirmarEliminacion = async () => {
    setErrorEliminar(null);
    try {
      await eliminarPublicacion(porEliminar.id);
      quitarPublicacion(porEliminar.id);
      setPorEliminar(null);
      return true;
    } catch (err) {
      setErrorEliminar(err.message);
      setPorEliminar(null);
      return false;
    }
  };

  const verBorradores = () => {
    setFiltroEstado('borrador');
    setFiltroRed('todo');
    window.requestAnimationFrame(() => document.getElementById('piezas')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const actualizarRedes = async () => {
    setActualizando(true);
    setAvisoActualizar('');
    setErrorActualizar('');
    try {
      const { resultados } = await actualizarRedesAhora();
      const leidas = resultados.filter((r) => r.estado === 'ok').length;
      const fallidas = resultados.filter((r) => r.estado === 'error').length;
      setAvisoActualizar(`Lectura lista: ${leidas} ${leidas === 1 ? 'cuenta actualizada' : 'cuentas actualizadas'}${fallidas ? `, ${fallidas} con error` : ''}.`);
    } catch (fallo) {
      setErrorActualizar(fallo.message);
    } finally {
      setActualizando(false);
    }
  };

  return (
    <div className="pagina mk">
      <TableroVista
        capturas={capturas} estado={estado} cargando={cargando} error={errorMonitoreo}
        piezas={publicaciones} cargandoPiezas={cargandoPiezas} hoy={hoy} ahora={ahora}
        periodo={periodo} red={red} onPeriodo={setPeriodo} onRed={setRed}
        puedeActualizar={ROLES_ACTUALIZAR.includes(userProfile?.role)} actualizando={actualizando}
        avisoActualizar={avisoActualizar} errorActualizar={errorActualizar} onActualizarRedes={actualizarRedes}
        onGenerar={() => setGenerando(true)} onVerBorradores={verBorradores} onAbrir={setSeleccionada}
      />

      <PublicacionesVista
        publicaciones={publicaciones} cargando={cargandoPiezas} error={error} errorEliminar={errorEliminar}
        filtroRed={filtroRed} filtroEstado={filtroEstado} onFiltroRed={setFiltroRed} onFiltroEstado={setFiltroEstado}
        onActualizar={cargar} onAbrir={setSeleccionada}
        onEliminar={ROLES_ELIMINAR.includes(userProfile?.role) ? setPorEliminar : undefined}
      />

      <ConfirmDialog
        isOpen={Boolean(porEliminar)}
        onClose={() => setPorEliminar(null)}
        onConfirm={confirmarEliminacion}
        title="¿Eliminar esta publicación?"
        message={`Se eliminará "${porEliminar?.titulo || porEliminar?.nombre || ''}" con todos sus archivos. Irá a la papelera de SharePoint.`}
      />

      <ModalGenerarPieza isOpen={generando} onClose={() => setGenerando(false)} />

      {seleccionada && (
        <VisorPublicacion
          publicacion={seleccionada}
          publicaciones={recorrido}
          onActualizada={(actualizada) => {
            actualizarPublicacion(actualizada);
            setSeleccionada(actualizada);
          }}
          onCambiar={cambiarPieza}
          onCerrar={() => setSeleccionada(null)}
        />
      )}
    </div>
  );
}
