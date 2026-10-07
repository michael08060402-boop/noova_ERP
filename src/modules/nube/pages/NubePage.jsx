import { useEffect } from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import useNube from '../hooks/useNube';
import Explorador from '../components/Explorador';
import '../../../styles/shared.css';
import './Nube.css';

export default function NubePage() {
  const {
    items,
    cargando,
    buscando,
    error,
    ruta,
    enBusqueda,
    terminoBusqueda,
    carpetaArea,
    procesando,
    cargarCarpeta,
    navegarA,
    abrirArchivo,
    buscar,
    limpiarBusqueda,
    refrescar,
    crearCarpeta,
    subirArchivo,
    renombrarItem,
    eliminarItem
  } = useNube();

  useEffect(() => {
    cargarCarpeta(null);
  }, [cargarCarpeta]);

  const errorConfiguracion = Boolean(error && /Microsoft Graph|OneDrive|SharePoint|credenciales|Cloud Functions|GRAPH_/i.test(error));

  return (
    <div className="pagina nube-pagina">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Nube</h1>
          <p className="pagina-subtitulo">
            OneDrive corporativo mediante Microsoft Graph
          </p>
        </div>
      </div>

      {errorConfiguracion && (
        <section className="nube-config-aviso" aria-live="polite">
          <FiAlertCircle size={18} />
          <div>
            <strong>Nube todavía no está activada en Microsoft Graph.</strong>
            <p>El ERP ya está preparado. Falta completar la app de Microsoft Entra, guardar los secretos GRAPH_* en Firebase y desplegar las Functions de Nube. El detalle técnico está en <code>ONEDRIVE_SETUP.md</code>.</p>
          </div>
        </section>
      )}

      <Explorador
        items={items}
        cargando={cargando}
        buscando={buscando}
        error={error}
        ruta={ruta}
        enBusqueda={enBusqueda}
        terminoBusqueda={terminoBusqueda}
        carpetaArea={carpetaArea}
        procesando={procesando}
        cargarCarpeta={cargarCarpeta}
        navegarA={navegarA}
        abrirArchivo={abrirArchivo}
        buscar={buscar}
        limpiarBusqueda={limpiarBusqueda}
        refrescar={refrescar}
        crearCarpeta={crearCarpeta}
        subirArchivo={subirArchivo}
        renombrarItem={renombrarItem}
        eliminarItem={eliminarItem}
      />
    </div>
  );
}
