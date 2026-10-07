import { useRef, useState } from 'react';
import {
  FiArrowDown, FiArrowLeft, FiArrowRight, FiArrowUp, FiCopy, FiMenu, FiPaperclip, FiPlus, FiTrash2, FiType, FiUploadCloud
} from 'react-icons/fi';
import {
  CAMPOS_AUTOMATICOS, TIPOS_BLOQUE, TIPOS_CAMPO, TIPOS_COLUMNA,
  clonarBloques, crearBloque, crearCampo, crearColumna, crearFila, valorAutomatico
} from '../../utils/plantillasSolicitud';
import { UNIDADES_SOLICITUD, interpretarTextoSolicitud } from '../../utils/solicitudCotizacion';
import './EditorSolicitud.css';

const ETIQUETA_TIPO = Object.fromEntries(TIPOS_BLOQUE.map((t) => [t.tipo, t.label]));

function mover(lista, desde, hasta) {
  if (hasta < 0 || hasta >= lista.length) return lista;
  const copia = [...lista];
  const [x] = copia.splice(desde, 1);
  copia.splice(hasta, 0, x);
  return copia;
}

function BotonIcono({ titulo, onClick, children, peligro, disabled }) {
  return (
    <button type="button" className={`editor-icono${peligro ? ' editor-icono-peligro' : ''}`} title={titulo} aria-label={titulo} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function EditorCampos({ bloque, actualizar, contexto }) {
  const campos = bloque.campos || [];
  const setCampos = (nuevos) => actualizar({ campos: nuevos });
  const setCampo = (i, cambios) => setCampos(campos.map((c, k) => (k === i ? { ...c, ...cambios } : c)));
  const disponibles = CAMPOS_AUTOMATICOS.filter((a) => !campos.some((c) => c.auto === a.auto));

  return (
    <div className="editor-campos">
      {campos.map((c, i) => (
        <div key={c.id} className="editor-campo-fila">
          <input
            className="editor-campo-etiqueta"
            value={c.etiqueta}
            onChange={(e) => setCampo(i, { etiqueta: e.target.value })}
            placeholder="Etiqueta"
            aria-label="Etiqueta del dato"
          />
          {c.auto ? (
            <div className="editor-campo-auto" title="Se completa automáticamente">
              {valorAutomatico(c.auto, contexto) || 'Automático'}
            </div>
          ) : c.tipo === 'textoLargo' ? (
            <textarea value={c.valor} onChange={(e) => setCampo(i, { valor: e.target.value })} rows={2} aria-label={c.etiqueta || 'Valor'} />
          ) : (
            <input
              type={c.tipo === 'fecha' ? 'date' : c.tipo === 'numero' ? 'number' : 'text'}
              value={c.valor}
              onChange={(e) => setCampo(i, { valor: e.target.value })}
              aria-label={c.etiqueta || 'Valor'}
            />
          )}
          {c.auto ? (
            <span className="editor-campo-etiqueta-auto">Automático</span>
          ) : (
            <select value={c.tipo} onChange={(e) => setCampo(i, { tipo: e.target.value })} aria-label="Tipo de dato">
              {TIPOS_CAMPO.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </select>
          )}
          <select value={c.ancho || 'completo'} onChange={(e) => setCampo(i, { ancho: e.target.value })} aria-label="Ancho del dato">
            <option value="completo">Fila completa</option>
            <option value="mitad">Media fila</option>
          </select>
          <div className="editor-acciones-fila">
            <BotonIcono titulo="Subir" onClick={() => setCampos(mover(campos, i, i - 1))} disabled={i === 0}><FiArrowUp /></BotonIcono>
            <BotonIcono titulo="Bajar" onClick={() => setCampos(mover(campos, i, i + 1))} disabled={i === campos.length - 1}><FiArrowDown /></BotonIcono>
            <BotonIcono titulo="Quitar dato" peligro onClick={() => setCampos(campos.filter((_, k) => k !== i))}><FiTrash2 /></BotonIcono>
          </div>
        </div>
      ))}
      <div className="editor-pie-bloque">
        <button type="button" className="btn-secundario btn-pequeno" onClick={() => setCampos([...campos, crearCampo({ etiqueta: 'Nuevo dato' })])}>
          <FiPlus size={14} /> Agregar dato
        </button>
        {disponibles.length > 0 && (
          <select
            className="editor-select-auto"
            value=""
            onChange={(e) => {
              const a = CAMPOS_AUTOMATICOS.find((x) => x.auto === e.target.value);
              if (a) setCampos([...campos, crearCampo(a)]);
            }}
            aria-label="Agregar dato automático"
          >
            <option value="">+ Dato automático…</option>
            {disponibles.map((a) => <option key={a.auto} value={a.auto}>{a.etiqueta}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

function filasImportadas(items, columnas) {
  const porRol = Object.fromEntries(columnas.filter((c) => c.rol).map((c) => [c.rol, c.id]));
  const colDescripcion = porRol.descripcion || columnas.find((c) => c.tipo === 'texto')?.id;
  return items.map((it) => {
    const valores = {};
    if (porRol.codigo) valores[porRol.codigo] = it.codigo || '';
    const detalle = porRol.especificaciones ? it.descripcion : [it.descripcion, it.especificaciones].filter(Boolean).join('\n');
    if (colDescripcion) valores[colDescripcion] = detalle || '';
    if (porRol.especificaciones) valores[porRol.especificaciones] = it.especificaciones || '';
    if (porRol.unidad) valores[porRol.unidad] = it.unidadMedida || 'UNIDAD';
    if (porRol.cantidad) valores[porRol.cantidad] = it.cantidad ?? '';
    return crearFila(columnas, valores);
  });
}

function filasTexto(valor) {
  const texto = String(valor ?? '');
  return Math.min(6, Math.max(1, texto.split('\n').reduce((t, linea) => t + Math.max(1, Math.ceil(linea.length / 24)), 0)));
}

function filaVacia(fila, columnas) {
  return !columnas.some((c) => c.tipo !== 'unidad' && String(fila.valores?.[c.id] ?? '').trim());
}

function EditorTabla({ bloque, actualizar, onDatosImportados }) {
  const columnas = bloque.columnas || [];
  const filas = bloque.filas || [];
  const inputArchivo = useRef(null);
  const [pegar, setPegar] = useState(false);
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState(null);
  const [leyendo, setLeyendo] = useState(false);

  const setFilas = (nuevas) => actualizar({ filas: nuevas });
  const setColumnas = (nuevas, nuevasFilas = filas) => actualizar({ columnas: nuevas, filas: nuevasFilas });
  const setValor = (i, colId, valor) => setFilas(filas.map((f, k) => (k === i ? { ...f, valores: { ...f.valores, [colId]: valor } } : f)));
  const setColumna = (i, cambios) => setColumnas(columnas.map((c, k) => (k === i ? { ...c, ...cambios } : c)));

  function agregarImportados({ items, datos }, origen) {
    if (!items.length) {
      setAviso({ tipo: 'error', texto: `No se encontraron ítems en ${origen}.` });
      return false;
    }
    setFilas([...filas.filter((f) => !filaVacia(f, columnas)), ...filasImportadas(items, columnas)]);
    if (onDatosImportados) onDatosImportados(datos);
    setAviso({ tipo: 'ok', texto: `Se agregaron ${items.length} fila${items.length === 1 ? '' : 's'} desde ${origen}. Revísalas antes de guardar.` });
    return true;
  }

  async function importarArchivo(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setLeyendo(true);
    setAviso(null);
    try {
      const { leerArchivoSolicitud } = await import('../../utils/leerArchivoSolicitud');
      agregarImportados(await leerArchivoSolicitud(archivo), `"${archivo.name}"`);
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.message || 'No se pudo leer el archivo.' });
    } finally {
      setLeyendo(false);
    }
  }

  return (
    <div className="editor-tabla">
      <div className="editor-tabla-barra">
        <button type="button" className="btn-secundario btn-pequeno" onClick={() => setFilas([...filas, crearFila(columnas)])}>
          <FiPlus size={14} /> Fila
        </button>
        <button
          type="button"
          className="btn-secundario btn-pequeno"
          onClick={() => {
            const col = crearColumna({ etiqueta: 'Nueva columna' });
            setColumnas([...columnas, col], filas.map((f) => ({ ...f, valores: { ...f.valores, [col.id]: '' } })));
          }}
        >
          <FiPlus size={14} /> Columna
        </button>
        <input ref={inputArchivo} type="file" accept=".xlsx,.docx,.pdf,.csv,.txt" hidden onChange={importarArchivo} />
        <button type="button" className="btn-secundario btn-pequeno" onClick={() => inputArchivo.current?.click()} disabled={leyendo}>
          <FiPaperclip size={14} /> {leyendo ? 'Leyendo…' : 'Importar archivo'}
        </button>
        <button type="button" className="btn-secundario btn-pequeno" onClick={() => setPegar((v) => !v)}>
          <FiType size={14} /> Pegar lista
        </button>
        <label className="editor-check">
          <input type="checkbox" checked={bloque.numerar !== false} onChange={(e) => actualizar({ numerar: e.target.checked })} />
          Numerar ítems
        </label>
      </div>

      {pegar && (
        <div className="editor-pegar">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            placeholder={'Una línea por ítem, por ejemplo:\n2 camionetas 4x4 doble cabina\n    Año 2022 o superior, con conductor\nMinibús 15 pasajeros x 1'}
          />
          <button
            type="button"
            className="btn-principal btn-pequeno"
            disabled={!texto.trim()}
            onClick={() => { if (agregarImportados(interpretarTextoSolicitud(texto), 'el texto pegado')) { setTexto(''); setPegar(false); } }}
          >
            <FiUploadCloud size={14} /> Agregar ítems
          </button>
        </div>
      )}
      {aviso && <div className={`editor-aviso editor-aviso-${aviso.tipo}`} role="status">{aviso.texto}</div>}

      <div className="editor-tabla-scroll">
        <table className="editor-tabla-grid">
          <thead>
            <tr>
              {bloque.numerar !== false && <th className="editor-col-num">#</th>}
              {columnas.map((c, i) => (
                <th key={c.id} style={{ width: `${(Number(c.ancho) || 1) * 8}%` }}>
                  <input value={c.etiqueta} onChange={(e) => setColumna(i, { etiqueta: e.target.value })} aria-label="Nombre de la columna" />
                  <div className="editor-col-controles">
                    <select value={c.tipo} onChange={(e) => setColumna(i, { tipo: e.target.value })} aria-label="Tipo de columna">
                      {TIPOS_COLUMNA.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
                    </select>
                    <select value={c.ancho || 2} onChange={(e) => setColumna(i, { ancho: Number(e.target.value) })} aria-label="Ancho de la columna" title="Ancho en el PDF">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>Ancho {n}</option>)}
                    </select>
                    <BotonIcono titulo="Mover a la izquierda" onClick={() => setColumnas(mover(columnas, i, i - 1))} disabled={i === 0}><FiArrowLeft /></BotonIcono>
                    <BotonIcono titulo="Mover a la derecha" onClick={() => setColumnas(mover(columnas, i, i + 1))} disabled={i === columnas.length - 1}><FiArrowRight /></BotonIcono>
                    <BotonIcono titulo="Quitar columna" peligro disabled={columnas.length <= 1} onClick={() => setColumnas(columnas.filter((_, k) => k !== i))}><FiTrash2 /></BotonIcono>
                  </div>
                </th>
              ))}
              <th className="editor-col-acciones" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.id}>
                {bloque.numerar !== false && <td className="editor-col-num">{String(i + 1).padStart(2, '0')}</td>}
                {columnas.map((c) => (
                  <td key={c.id}>
                    {c.tipo === 'unidad' ? (
                      <select value={f.valores?.[c.id] || 'UNIDAD'} onChange={(e) => setValor(i, c.id, e.target.value)} aria-label={c.etiqueta}>
                        {!UNIDADES_SOLICITUD.includes(f.valores?.[c.id] || 'UNIDAD') && <option value={f.valores[c.id]}>{f.valores[c.id]}</option>}
                        {UNIDADES_SOLICITUD.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    ) : c.tipo === 'numero' ? (
                      <input type="number" min="0" step="any" value={f.valores?.[c.id] ?? ''} onChange={(e) => setValor(i, c.id, e.target.value)} aria-label={c.etiqueta} />
                    ) : (
                      <textarea rows={filasTexto(f.valores?.[c.id])} value={f.valores?.[c.id] ?? ''} onChange={(e) => setValor(i, c.id, e.target.value)} aria-label={c.etiqueta} />
                    )}
                  </td>
                ))}
                <td className="editor-col-acciones">
                  <div className="editor-acciones-fila">
                    <BotonIcono titulo="Subir fila" onClick={() => setFilas(mover(filas, i, i - 1))} disabled={i === 0}><FiArrowUp /></BotonIcono>
                    <BotonIcono titulo="Bajar fila" onClick={() => setFilas(mover(filas, i, i + 1))} disabled={i === filas.length - 1}><FiArrowDown /></BotonIcono>
                    <BotonIcono titulo="Quitar fila" peligro disabled={filas.length <= 1} onClick={() => setFilas(filas.filter((_, k) => k !== i))}><FiTrash2 /></BotonIcono>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditorLista({ bloque, actualizar }) {
  const elementos = bloque.elementos || [];
  const setElementos = (nuevos) => actualizar({ elementos: nuevos });
  return (
    <div className="editor-lista">
      {elementos.map((t, i) => (
        <div key={i} className="editor-lista-fila">
          <span className="editor-vineta" aria-hidden="true">•</span>
          <input value={t} onChange={(e) => setElementos(elementos.map((x, k) => (k === i ? e.target.value : x)))} placeholder="Escribe un requisito o condición" aria-label={`Elemento ${i + 1}`} />
          <div className="editor-acciones-fila">
            <BotonIcono titulo="Subir" onClick={() => setElementos(mover(elementos, i, i - 1))} disabled={i === 0}><FiArrowUp /></BotonIcono>
            <BotonIcono titulo="Bajar" onClick={() => setElementos(mover(elementos, i, i + 1))} disabled={i === elementos.length - 1}><FiArrowDown /></BotonIcono>
            <BotonIcono titulo="Quitar" peligro onClick={() => setElementos(elementos.filter((_, k) => k !== i))}><FiTrash2 /></BotonIcono>
          </div>
        </div>
      ))}
      <div className="editor-pie-bloque">
        <button type="button" className="btn-secundario btn-pequeno" onClick={() => setElementos([...elementos, ''])}>
          <FiPlus size={14} /> Agregar elemento
        </button>
        <select value={bloque.estilo || 'vinetas'} onChange={(e) => actualizar({ estilo: e.target.value })} aria-label="Estilo de la lista">
          <option value="vinetas">Estilo: viñetas</option>
          <option value="tarjeta">Estilo: tarjeta</option>
        </select>
      </div>
    </div>
  );
}

export default function EditorBloques({ bloques, onChange, contexto = {}, onDatosImportados }) {
  const [arrastrando, setArrastrando] = useState(null);
  const [destino, setDestino] = useState(null);

  const actualizarBloque = (i, cambios) => onChange(bloques.map((b, k) => (k === i ? { ...b, ...cambios } : b)));

  function soltar(i) {
    if (arrastrando !== null && arrastrando !== i) onChange(mover(bloques, arrastrando, i));
    setArrastrando(null);
    setDestino(null);
  }

  return (
    <div className="editor-bloques">
      {bloques.map((b, i) => (
        <section
          key={b.id}
          className={`editor-bloque${destino === i ? ' editor-bloque-destino' : ''}${arrastrando === i ? ' editor-bloque-arrastrando' : ''}`}
          onDragOver={(e) => { if (arrastrando !== null) { e.preventDefault(); setDestino(i); } }}
          onDragLeave={() => setDestino((d) => (d === i ? null : d))}
          onDrop={(e) => { e.preventDefault(); soltar(i); }}
        >
          <header className="editor-bloque-cabecera">
            <span
              className="editor-arrastre"
              draggable
              title="Arrastra para reordenar"
              onDragStart={(e) => { setArrastrando(i); e.dataTransfer.effectAllowed = 'move'; }}
              onDragEnd={() => { setArrastrando(null); setDestino(null); }}
            >
              <FiMenu />
            </span>
            <span className="editor-bloque-tipo">{ETIQUETA_TIPO[b.tipo]}</span>
            <input className="editor-bloque-titulo" value={b.titulo} onChange={(e) => actualizarBloque(i, { titulo: e.target.value })} placeholder="Título de la sección" aria-label="Título de la sección" />
            <div className="editor-bloque-opciones">
              {!(b.tipo === 'lista' && b.estilo === 'tarjeta') && (
                <label className="editor-check" title="Mostrar el título en el PDF">
                  <input type="checkbox" checked={!!b.mostrarTitulo} onChange={(e) => actualizarBloque(i, { mostrarTitulo: e.target.checked })} />
                  Título en PDF
                </label>
              )}
              {b.tipo !== 'tabla' && (
                <select value={b.ancho || 'completo'} onChange={(e) => actualizarBloque(i, { ancho: e.target.value })} aria-label="Ancho de la sección">
                  <option value="completo">Ancho completo</option>
                  <option value="mitad">Media página</option>
                </select>
              )}
              <BotonIcono titulo="Subir sección" onClick={() => onChange(mover(bloques, i, i - 1))} disabled={i === 0}><FiArrowUp /></BotonIcono>
              <BotonIcono titulo="Bajar sección" onClick={() => onChange(mover(bloques, i, i + 1))} disabled={i === bloques.length - 1}><FiArrowDown /></BotonIcono>
              <BotonIcono titulo="Duplicar sección" onClick={() => onChange([...bloques.slice(0, i + 1), ...clonarBloques([b]), ...bloques.slice(i + 1)])}><FiCopy /></BotonIcono>
              <BotonIcono titulo="Eliminar sección" peligro onClick={() => onChange(bloques.filter((_, k) => k !== i))}><FiTrash2 /></BotonIcono>
            </div>
          </header>
          <div className="editor-bloque-cuerpo">
            {b.tipo === 'campos' && <EditorCampos bloque={b} actualizar={(c) => actualizarBloque(i, c)} contexto={contexto} />}
            {b.tipo === 'tabla' && <EditorTabla bloque={b} actualizar={(c) => actualizarBloque(i, c)} onDatosImportados={onDatosImportados} />}
            {b.tipo === 'lista' && <EditorLista bloque={b} actualizar={(c) => actualizarBloque(i, c)} />}
            {b.tipo === 'texto' && (
              <textarea className="editor-texto" value={b.contenido} onChange={(e) => actualizarBloque(i, { contenido: e.target.value })} rows={4} placeholder="Describe el alcance, condiciones o cualquier detalle para el proveedor" />
            )}
          </div>
        </section>
      ))}

      <div className="editor-agregar">
        <span>Agregar sección:</span>
        {TIPOS_BLOQUE.map((t) => (
          <button key={t.tipo} type="button" className="btn-secundario btn-pequeno" title={t.descripcion} onClick={() => onChange([...bloques, crearBloque(t.tipo)])}>
            <FiPlus size={14} /> {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
