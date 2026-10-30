import { useState } from 'react';
import Modal from '../../../components/Modal';
import { generarPieza } from '../services/marketingService';
import { REDES } from './redesSociales';
import PrevisualDiseno from './PrevisualDiseno';
import { FORMATOS, FORMATOS_POR_RED, disenosPara, getDiseno, moverDiseno, otroDiseno } from '../utils/disenos';

// Las opciones deben coincidir con los inputs del workflow generar-pieza.yml
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

const INICIAL = { red: 'linkedin', formato: 'flyer', tema: 'automatico', variante: 'automatico' };

export default function ModalGenerarPieza({ isOpen, onClose }) {
  const [form, setForm] = useState(INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [generadas, setGeneradas] = useState([]);

  const disenos = disenosPara(form.red, form.formato);
  const elegido = getDiseno(form.variante);

  const cambiar = (campo) => (event) => setForm((actual) => ({ ...actual, [campo]: event.target.value }));

  // Al cambiar red o formato se vuelve a la rotación automática: el diseño elegido puede no servir.
  const cambiarRed = (event) => {
    const red = event.target.value;
    setForm((actual) => ({
      ...actual, red, variante: 'automatico',
      formato: FORMATOS_POR_RED[red].includes(actual.formato) ? actual.formato : FORMATOS_POR_RED[red][0]
    }));
  };
  const cambiarFormato = (event) => setForm((actual) => ({ ...actual, formato: event.target.value, variante: 'automatico' }));
  const mover = (paso) => setForm((actual) => ({ ...actual, variante: moverDiseno(disenos, actual.variante, paso) }));

  const cerrar = () => {
    setForm(INICIAL);
    setError(null);
    setGeneradas([]);
    onClose();
  };

  const generar = async (datos) => {
    setEnviando(true);
    setError(null);
    try {
      await generarPieza(datos);
      setGeneradas((anteriores) => [...anteriores, getDiseno(datos.variante)?.nombre || 'Diseño automático']);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const enviar = (event) => {
    event.preventDefault();
    generar(form);
  };

  // «Otro boceto»: misma red, formato y tema, con el siguiente diseño de la lista.
  const otroBoceto = () => {
    const nuevo = { ...form, variante: otroDiseno(disenos, form.variante) };
    setForm(nuevo);
    generar(nuevo);
  };

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="Generar pieza" size="large">
      {generadas.length > 0 ? (
        <div>
          <p>
            La generación está en marcha. Tarda unos minutos y el borrador aparecerá en
            Piezas; pulsa <strong>Actualizar</strong> para verlo.
          </p>
          <p className="generar-resumen">Pedidas en esta sesión: {generadas.join(', ')}.</p>
          {error && <p className="publicaciones-error" role="alert">{error}</p>}
          <div className="acciones-form">
            <button type="button" className="btn-secundario" onClick={otroBoceto} disabled={enviando || disenos.length === 0}>
              {enviando ? 'Enviando...' : 'Generar otro boceto'}
            </button>
            <button type="button" className="btn-principal" onClick={cerrar}>Entendido</button>
          </div>
        </div>
      ) : (
        <form onSubmit={enviar} className="generar-formulario">
          <div className="generar-campos">
          <div className="campo">
            <span className="campo-titulo" id="gp-tipo">Tipo de pieza</span>
            <div className="mk-segmentos mk-tipo" role="tablist" aria-labelledby="gp-tipo">
              <button type="button" role="tab" aria-selected="true" className="mk-segmento">Imagen</button>
              <button type="button" role="tab" aria-selected="false" aria-disabled="true" disabled className="mk-segmento" title="Los videos llegarán en una próxima versión">
                Video <span className="mk-pronto">Próximamente</span>
              </button>
            </div>
          </div>
          <div className="campo">
            <label htmlFor="gp-red">Red social</label>
            <select id="gp-red" value={form.red} onChange={cambiarRed}>
              {REDES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="gp-formato">Formato</label>
            <select id="gp-formato" value={form.formato} onChange={cambiarFormato}>
              {FORMATOS_POR_RED[form.red].map((valor) => <option key={valor} value={valor}>{FORMATOS[valor]}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="gp-tema">Tema</label>
            <select id="gp-tema" value={form.tema} onChange={cambiar('tema')}>
              {TEMAS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="gp-diseno">Diseño</label>
            <select id="gp-diseno" value={form.variante} onChange={cambiar('variante')}>
              <option value="automatico">Automático (según rotación)</option>
              {disenos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>

          {error && <p className="publicaciones-error" role="alert">{error}</p>}

          <div className="acciones-form">
            <button type="button" className="btn-secundario" onClick={cerrar} disabled={enviando}>Cancelar</button>
            <button type="submit" className="btn-principal" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Generar'}
            </button>
          </div>
          </div>

          <div className="generar-previsualizacion" aria-live="polite">
            {elegido ? (
              <>
                <PrevisualDiseno id={elegido.id} nombre={elegido.nombre} />
                <div className="generar-previsualizacion-pie">
                  <strong>{elegido.nombre}</strong>
                  <span>Así se ve el diseño. El texto y la foto son de muestra. <em>Diseños de prueba: se reemplazarán por los finales.</em></span>
                  <div className="generar-previsualizacion-botones">
                    <button type="button" className="btn-secundario" onClick={() => mover(-1)}>◀ Anterior</button>
                    <button type="button" className="btn-secundario" onClick={() => mover(1)}>Siguiente ▶</button>
                  </div>
                </div>
              </>
            ) : (
              <div className="generar-previsualizacion-pie">
                <strong>Diseño automático</strong>
                <span>El sistema elige el diseño que menos se usó recientemente. Usa «Ver diseños» para ver cómo se ve cada uno y elegir.</span>
                <div className="generar-previsualizacion-botones">
                  <button type="button" className="btn-secundario" onClick={() => mover(1)} disabled={disenos.length === 0}>Ver diseños ▶</button>
                </div>
              </div>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}
