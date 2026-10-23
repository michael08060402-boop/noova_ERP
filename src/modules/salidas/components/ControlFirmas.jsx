import { firmantePorNombre } from '../../../data/firmantes';
import { FIRMAS_CONTROL } from '../utils/salida';
import SelectorPersona from './SelectorPersona';

export default function ControlFirmas({ control, datos, personas, soloLectura, onCambiar }) {
  return (
    <>
      <div className="fsx-barra">{control.titulo}</div>
      <table className="fsx-tabla fsx-control">
        <thead>
          <tr>{FIRMAS_CONTROL.map((f) => <th key={f.id} colSpan={2}>{f.titulo}</th>)}</tr>
        </thead>
        <tbody>
          <tr>
            {FIRMAS_CONTROL.map((f) => (
              <td key={f.id} colSpan={2}>
                <SelectorPersona
                  valor={datos[f.id].nombre}
                  personas={personas}
                  onCambiar={(nombre) => onCambiar(f.id, 'nombre', nombre)}
                  disabled={soloLectura}
                  aria-label={`${control.titulo} ${f.titulo}`}
                />
              </td>
            ))}
          </tr>
          <tr className="fsx-firmas">
            {FIRMAS_CONTROL.map((f) => {
              const firmante = firmantePorNombre(datos[f.id].nombre);
              return (
                <td key={f.id} colSpan={2}>
                  {firmante ? <img src={firmante.firma} alt={`Firma de ${firmante.nombre}`} /> : <span>Firma a mano</span>}
                </td>
              );
            })}
          </tr>
          {['fecha', 'hora'].map((dato) => (
            <tr key={dato}>
              {FIRMAS_CONTROL.map((f) => [
                <th key={`${f.id}-etiqueta`} className="fsx-etiqueta">{dato.toUpperCase()}:</th>,
                <td key={f.id}>
                  <input
                    type={dato === 'fecha' ? 'date' : 'time'}
                    value={datos[f.id][dato]}
                    onChange={(e) => onCambiar(f.id, dato, e.target.value)}
                    disabled={soloLectura}
                    aria-label={`${control.titulo} ${f.titulo} ${dato}`}
                  />
                </td>
              ])}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
