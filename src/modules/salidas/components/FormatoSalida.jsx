import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import logo from '../../../assets/noova-logo.png';
import { CONTROLES, MOTIVOS_SALIDA, crearItemSalida, formatearGuia, separarNumeroGuia } from '../utils/salida';
import { usePersonas } from '../hooks/usePersonas';
import TablaBienes from './TablaBienes';
import SelectorPersona from './SelectorPersona';
import ControlFirmas from './ControlFirmas';
import './FormatoSalida.css';

function anioFormato(fecha) {
  return `${/^(\d{4})-/.exec(fecha || '')?.[1] || new Date().getFullYear()}-NV - FSI`;
}

export default function FormatoSalida({ salida, onChange, validacion, mostrarErrores, soloLectura }) {
  const { formato, guia, items } = salida;
  const errores = mostrarErrores ? validacion.errores : {};
  const erroresBienes = mostrarErrores ? validacion.porItem : {};
  const [textoGuia, setTextoGuia] = useState(() => formatearGuia(guia));
  const faltan = Object.values(errores);
  const personas = usePersonas();

  function cambiarFormato(campo, valor) {
    onChange({ ...salida, formato: { ...formato, [campo]: valor } });
  }

  function cambiarFirma(control, rol, campo, valor) {
    const grupo = formato[control];
    onChange({ ...salida, formato: { ...formato, [control]: { ...grupo, [rol]: { ...grupo[rol], [campo]: valor } } } });
  }

  function cambiarGuia(texto) {
    setTextoGuia(texto);
    const partes = separarNumeroGuia(texto);
    onChange({ ...salida, guia: { ...guia, serie: partes?.serie || '', numero: partes?.numero || '' } });
  }

  function cambiarBien(id, campo, valor) {
    onChange({ ...salida, items: items.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)) });
  }

  const campo = (nombre, props = {}) => (
    <input
      className={errores[nombre] ? 'fsx-input-error' : undefined}
      value={formato[nombre] ?? ''}
      onChange={(e) => cambiarFormato(nombre, e.target.value)}
      disabled={soloLectura}
      {...props}
    />
  );

  const texto = (nombre, etiqueta, filas = 2) => (
    <textarea
      rows={filas}
      className={errores[nombre] ? 'fsx-input-error' : undefined}
      value={formato[nombre] ?? ''}
      onChange={(e) => cambiarFormato(nombre, e.target.value)}
      disabled={soloLectura}
      aria-label={etiqueta}
    />
  );

  return (
    <div className="fsx-hoja">
      <div className="fsx-cabecera">
        <div className="fsx-logo"><img src={logo} alt="NOOVA" /></div>
        <div className="fsx-titulo">FORMATO DE SALIDA / INGRESO DE INSTRUMENTOS Y BIEN DE LA EMPRESA CONTRATISTAS GENERALES NOOVA S.A.C.</div>
        <div className="fsx-codigo">
          <span>{anioFormato(formato.fechaSalida)}</span>
          <label className={errores.correlativo ? 'fsx-input-error' : undefined}>
            N° {campo('correlativo', { inputMode: 'numeric', 'aria-label': 'Número de formato' })}
          </label>
        </div>
      </div>

      <div className="fsx-barra">SALIDA / INGRESO DE INSTRUMENTOS Y BIEN DE LA EMPRESA NOOVA</div>
      <table className="fsx-tabla">
        <thead>
          <tr><th>DEPENDENCIA:</th><th className="fsx-ancha">LUGAR:</th><th>FECHA DE SALIDA:</th><th>FECHA DE INGRESO:</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>{campo('dependencia', { 'aria-label': 'Dependencia' })}</td>
            <td className="fsx-ancha">{texto('lugar', 'Lugar')}</td>
            <td>{campo('fechaSalida', { type: 'date', 'aria-label': 'Fecha de salida' })}</td>
            <td>{campo('fechaIngreso', { type: 'date', 'aria-label': 'Fecha de ingreso' })}</td>
          </tr>
        </tbody>
      </table>

      <table className="fsx-tabla fsx-separada">
        <thead>
          <tr><th>DESTINO:</th><th>PERSONA A QUIEN SE AUTORIZA:</th><th>JEFE QUE AUTORIZA:</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>{texto('destino', 'Destino')}</td>
            <td>
              <SelectorPersona valor={formato.personaAutorizada} personas={personas} onCambiar={(v) => cambiarFormato('personaAutorizada', v)} disabled={soloLectura} aria-label="Persona a quien se autoriza" />
            </td>
            <td>
              <SelectorPersona valor={formato.jefeAutoriza} personas={personas} onCambiar={(v) => cambiarFormato('jefeAutoriza', v)} disabled={soloLectura} aria-label="Jefe que autoriza" />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="fsx-fila-guia">
        <label className="fsx-paquete">PAQUETE Nº {campo('paquete', { 'aria-label': 'Paquete' })}</label>
        <label className={`fsx-guia ${errores.guia ? 'fsx-input-error' : ''}`}>
          N° GUÍA DE REMISIÓN
          <input value={textoGuia} onChange={(e) => cambiarGuia(e.target.value)} placeholder="EG07-00000108" disabled={soloLectura} aria-label="Número de guía de remisión" />
        </label>
      </div>
      <TablaBienes items={items} errores={erroresBienes} soloLectura={soloLectura} onCambiar={cambiarBien} />
      {!soloLectura && (
        <div className="fsx-pie-tabla">
          <button type="button" className="fsx-agregar" onClick={() => onChange({ ...salida, items: [...items, crearItemSalida()] })}>
            <FiPlus size={14} /> Agregar fila
          </button>
          <span>Para quitar un bien, borra el contenido de su fila.</span>
        </div>
      )}

      <fieldset className="fsx-motivos" disabled={soloLectura}>
        <legend>Motivo</legend>
        {MOTIVOS_SALIDA.map((m) => (
          <label key={m.id} className="fsx-motivo">
            <input type="checkbox" checked={formato.motivo === m.id} onChange={() => cambiarFormato('motivo', formato.motivo === m.id ? '' : m.id)} />
            <span className="fsx-casilla" aria-hidden="true">{formato.motivo === m.id ? 'X' : ''}</span>
            {m.label.toUpperCase()}
          </label>
        ))}
      </fieldset>

      {CONTROLES.map((control) => (
        <ControlFirmas
          key={control.id}
          control={control}
          datos={formato[control.id]}
          personas={personas}
          soloLectura={soloLectura}
          onCambiar={(rol, dato, valor) => cambiarFirma(control.id, rol, dato, valor)}
        />
      ))}

      <div className="fsx-observacion">
        <span>OBSERVACIÓN:</span>
        {texto('observacion', 'Observación', 3)}
      </div>

      {faltan.length > 0 && (
        <div className="fsx-faltan" role="alert">
          <strong>Para descargar el Excel falta:</strong>
          <ul>{faltan.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
