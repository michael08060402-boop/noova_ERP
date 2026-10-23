import { CONTENEDORES, ESTADOS_BIEN, SIN_DATO } from '../utils/salida';

const COLUMNAS = [
  { campo: 'descripcion', titulo: 'MODELO:', clase: 'fsx-col-modelo', multilinea: true },
  { campo: 'contenedor', titulo: 'MALETA / CAJA', clase: 'fsx-col-corta', opciones: CONTENEDORES },
  { campo: 'serie', titulo: 'N° DE SERIE:', clase: 'fsx-col-serie', vacio: SIN_DATO },
  { campo: 'cantidad', titulo: 'CANTIDAD:', clase: 'fsx-col-corta' },
  { campo: 'unidad', titulo: 'UNIDAD:', clase: 'fsx-col-corta' },
  { campo: 'marca', titulo: 'MARCA:', clase: 'fsx-col-media', vacio: SIN_DATO },
  { campo: 'tipo', titulo: 'TIPO:', clase: 'fsx-col-corta', vacio: SIN_DATO },
  { campo: 'estado', titulo: 'ESTADO:', clase: 'fsx-col-media', opciones: ESTADOS_BIEN }
];

function Celda({ item, columna, conError, soloLectura, onCambiar }) {
  const sugerida = columna.campo === 'serie' && item.origen === 'pdf' && item.serie;
  const props = {
    value: item[columna.campo] ?? '',
    onChange: (e) => onCambiar(item.id, columna.campo, e.target.value),
    disabled: soloLectura,
    'aria-label': columna.titulo.replace(':', ''),
    title: sugerida ? 'Serie leída de la descripción de la guía' : undefined
  };

  let control = <input placeholder={columna.vacio} {...props} />;
  if (columna.multilinea) control = <textarea rows={1} {...props} />;
  if (columna.opciones) {
    control = (
      <select {...props}>
        {columna.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  return (
    <td className={[columna.clase, conError && 'fsx-error', sugerida && 'fsx-sugerida'].filter(Boolean).join(' ')}>
      {control}
    </td>
  );
}

export default function TablaBienes({ items, errores, soloLectura, onCambiar }) {
  return (
    <table className="fsx-tabla fsx-items">
      <thead>
        <tr>{COLUMNAS.map((c) => <th key={c.campo} className={c.clase}>{c.titulo}</th>)}</tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            {COLUMNAS.map((c) => (
              <Celda key={c.campo} item={item} columna={c} conError={errores[item.id]?.includes(c.campo)} soloLectura={soloLectura} onCambiar={onCambiar} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
