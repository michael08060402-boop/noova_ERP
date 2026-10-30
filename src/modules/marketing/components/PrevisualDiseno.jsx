// Imagen real del diseño: se genera con las mismas plantillas, tipografías y logo que las piezas
// (script previsualizar_variantes.py del repositorio noova-marketing). Solo el texto y la foto son de muestra.
// Para actualizarlas: `python scripts/previsualizar_variantes.py --salida <ERP>/public/disenos`.
export default function PrevisualDiseno({ id, nombre }) {
  return (
    <img
      className="previsual-diseno"
      src={`/disenos/${id}.webp`}
      alt={`Vista previa del diseño ${nombre}, con texto y foto de muestra`}
      loading="lazy"
    />
  );
}
