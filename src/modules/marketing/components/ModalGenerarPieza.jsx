import { useState } from 'react';
import Modal from '../../../components/Modal';
import { generarPieza } from '../services/marketingService';

// Las opciones deben coincidir con los inputs del workflow generar-pieza.yml
const REDES = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' }
];
const FORMATOS = {
  flyer: 'Flyer',
  carrusel: 'Carrusel',
  publicacion: 'Publicación',
  vertical: 'Vertical (9:16)'
};
// Solo existen variantes para estas combinaciones (plantillas/variantes/catalogo.json del repo de marketing)
const FORMATOS_POR_RED = {
  linkedin: ['flyer', 'carrusel', 'publicacion'],
  facebook: ['flyer', 'carrusel', 'publicacion'],
  instagram: ['flyer', 'carrusel', 'publicacion', 'vertical']
};
const TEMAS = [
  { value: 'automatico', label: 'Automático (según historial)' },
  { value: 'trayectoria', label: 'Trayectoria' },
  { value: 'proyectos', label: 'Proyectos' },
  { value: 'operaciones', label: 'Operaciones' },
  { value: 'alcance', label: 'Alcance' },
  { value: 'fases-ventilacion', label: 'Fases de ventilación' },
  { value: 'metodo-bombeo', label: 'Método de bombeo' },
  { value: 'ductos', label: 'Ductos' }
];

const INICIAL = { red: 'linkedin', formato: 'flyer', tema: 'automatico' };

export default function ModalGenerarPieza({ isOpen, onClose }) {
  const [form, setForm] = useState(INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [iniciada, setIniciada] = useState(false);

  const cambiar = (campo) => (event) => setForm((actual) => ({ ...actual, [campo]: event.target.value }));

  const cambiarRed = (event) => {
    const red = event.target.value;
    setForm((actual) => ({
      ...actual,
      red,
      formato: FORMATOS_POR_RED[red].includes(actual.formato) ? actual.formato : FORMATOS_POR_RED[red][0]
    }));
  };

  const cerrar = () => {
    setForm(INICIAL);
    setError(null);
    setIniciada(false);
    onClose();
  };

  const enviar = async (event) => {
    event.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await generarPieza(form);
      setIniciada(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="Generar flyer" size="small">
      {iniciada ? (
        <div>
          <p>
            La generación está en marcha. Tarda unos minutos y el borrador aparecerá en
            Publicaciones; pulsa <strong>Actualizar</strong> para verlo.
          </p>
          <div className="acciones-form">
            <button type="button" className="btn-principal" onClick={cerrar}>Entendido</button>
          </div>
        </div>
      ) : (
        <form onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="gp-red">Red social</label>
            <select id="gp-red" value={form.red} onChange={cambiarRed}>
              {REDES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="gp-formato">Formato</label>
            <select id="gp-formato" value={form.formato} onChange={cambiar('formato')}>
              {FORMATOS_POR_RED[form.red].map((valor) => <option key={valor} value={valor}>{FORMATOS[valor]}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="gp-tema">Tema</label>
            <select id="gp-tema" value={form.tema} onChange={cambiar('tema')}>
              {TEMAS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {error && <p className="publicaciones-error" role="alert">{error}</p>}

          <div className="acciones-form">
            <button type="button" className="btn-secundario" onClick={cerrar} disabled={enviando}>Cancelar</button>
            <button type="submit" className="btn-principal" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Generar'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
