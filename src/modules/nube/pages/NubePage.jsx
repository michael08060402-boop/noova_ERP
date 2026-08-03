import { useEffect } from 'react';
import useNube from '../hooks/useNube';
import Explorador from '../components/Explorador';
import '../../../styles/shared.css';
import './Nube.css';

// Página principal del módulo Nube
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

  // Cargar raíz al montar
  useEffect(() => {
    cargarCarpeta(null);
  }, [cargarCarpeta]);

  return (
    <div className="pagina nube-pagina">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Nube</h1>
          <p className="pagina-subtitulo">
            Explorador de documentos de NOOVA S.A.C.
          </p>
        </div>
      </div>

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
