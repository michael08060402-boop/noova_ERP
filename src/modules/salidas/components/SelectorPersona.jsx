import { mismaPersona } from '../../../utils/nombres';

export default function SelectorPersona({ valor, personas, onCambiar, ...props }) {
  const elegida = personas.find((p) => mismaPersona(p, valor)) || valor || '';
  const opciones = elegida && !personas.includes(elegida) ? [elegida, ...personas] : personas;

  return (
    <select value={elegida} onChange={(e) => onCambiar(e.target.value)} {...props}>
      <option value="">—</option>
      {opciones.map((nombre) => <option key={nombre} value={nombre}>{nombre}</option>)}
    </select>
  );
}
